// Supabase Edge Function: academy-checkout
// Turns a private enrollment invite (sent after the intro call) into a Stripe
// Checkout session. The signed-in person's email must match the invite.
// Prices live only in academy_plans (never public) and reach the browser only
// through the invite link.
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...   ACADEMY_URL=https://www.thep31collective.org (optional; that's the default)
//   supabase functions deploy academy-checkout
// Body: { token }  →  { url } | { already: true } | { error }
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) || '';

const RECURRING: Record<string, { interval: 'week' | 'month'; interval_count: number }> = {
  week: { interval: 'week', interval_count: 1 },
  month: { interval: 'month', interval_count: 1 },
  six_months: { interval: 'month', interval_count: 6 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: 'Please sign in to continue.' }, 401);

  let body: { token?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  if (!body.token) return json({ error: 'This enrollment link is incomplete.' }, 400);

  const { data: invite } = await admin.from('academy_invites')
    .select('id, email, full_name, expires_at, used_at, inquiry_id, program:academy_programs(id, slug, title), plan:academy_plans(id, billing, label, price_cents, access_days, is_active)')
    .eq('token', body.token).maybeSingle();
  if (!invite) return json({ error: 'This enrollment link isn’t valid. Please contact member@thep31collective.org.' }, 404);
  if (invite.used_at) return json({ error: 'This enrollment link has already been used.' }, 409);
  if (new Date(invite.expires_at) < new Date()) return json({ error: 'This enrollment link has expired — ask your mentor for a new one.' }, 410);
  if ((user.email || '').toLowerCase() !== invite.email.toLowerCase()) {
    return json({ error: `This invitation was sent to a different email. Sign in with the address your mentor used.` }, 403);
  }
  // deno-lint-ignore no-explicit-any
  const plan = invite.plan as any; const program = invite.program as any;
  if (!plan?.is_active || !plan?.price_cents) return json({ error: 'This plan isn’t available yet — please contact your mentor.' }, 409);

  const { data: existing } = await admin.from('academy_enrollments')
    .select('id, status, access_until, stripe_customer_id').eq('user_id', user.id).eq('program_id', program.id).maybeSingle();
  const stillActive = existing && ((existing.access_until === null && existing.status === 'active') ||
    (existing.access_until && new Date(existing.access_until) > new Date() && existing.status === 'active'));
  if (stillActive) return json({ already: true, program: program.slug });

  if (!env('STRIPE_SECRET_KEY')) {
    return json({ error: 'Card payments aren’t connected yet. Please email member@thep31collective.org and we’ll help you enroll.' }, 503);
  }
  const stripe = new Stripe(env('STRIPE_SECRET_KEY'));
  const appUrl = (env('ACADEMY_URL') || 'https://www.thep31collective.org').replace(/\/$/, '');

  let customer = existing?.stripe_customer_id || undefined;
  if (!customer) {
    const c = await stripe.customers.create({
      email: user.email, name: invite.full_name || user.user_metadata?.full_name || undefined,
      metadata: { user_id: user.id, source: 'p31-academy' },
    });
    customer = c.id;
  }

  const meta = { kind: 'academy', invite_id: invite.id, program_id: program.id, plan_id: plan.id, user_id: user.id };
  const recurring = RECURRING[plan.billing];
  const session = await stripe.checkout.sessions.create({
    mode: recurring ? 'subscription' : 'payment',
    customer,
    client_reference_id: user.id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: plan.price_cents,
        product_data: { name: `${program.title} — ${plan.label}` },
        ...(recurring ? { recurring } : {}),
      },
    }],
    metadata: meta,
    ...(recurring ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta } }),
    allow_promotion_codes: false,
    success_url: `${appUrl}/enroll/${body.token}?status=success`,
    cancel_url: `${appUrl}/enroll/${body.token}?status=cancelled`,
  });
  return json({ url: session.url });
});
