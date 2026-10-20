// Supabase Edge Function: academy-checkout
// Turns a private enrollment invite (sent after the intro call) into a Stripe
// Checkout session. The signed-in person's email must match the invite.
// Prices live only in academy_plans (never public) and reach the browser only
// through the invite link.
//   supabase secrets set COLLECTIVE_STRIPE_SECRET_KEY=sk_live_...   (the Collective's own Stripe account; STRIPE_SECRET_KEY also works)   ACADEMY_URL=https://www.thep31collective.org (optional; that's the default)
//   supabase functions deploy academy-checkout
// Body: { token }  →  { url } | { already: true } | { error }
//       { action: 'sync' }  →  copies each plan's price and billing from its Stripe Payment Link (v54);
//                              no sign-in needed, it only reads Stripe. Run daily by job p31-plan-sync.
//                              It answers with counts only ({ synced, missing, links_on_account }): plan
//                              names and prices go to the function log, never to the caller.
// Plans with a Stripe Payment Link (Melanie's own links, v54) are charged with the product and price
// behind that link, so every sale shows under her products in Stripe and she sets the price there.
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { stripeKey } from '../_shared/stripe.ts';

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

// deno-lint-ignore no-explicit-any
type Any = any;
const BILLING_OF = (p: Stripe.Price) => {
  if (p.type !== 'recurring') return 'one_time';
  const { interval, interval_count: n } = p.recurring || { interval: '', interval_count: 0 };
  if (interval === 'week' && n === 1) return 'week';
  if (interval === 'month' && n === 1) return 'month';
  if (interval === 'month' && n === 6) return 'six_months';
  return null; // a cadence the site does not label; the plan keeps its billing, Stripe still charges correctly
};
const linkKey = (u: string) => String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();

/** Every active Payment Link on the account, by its public URL. */
async function paymentLinks(stripe: Stripe) {
  const map = new Map<string, Stripe.PaymentLink>();
  for await (const l of stripe.paymentLinks.list({ limit: 100, active: true })) map.set(linkKey(l.url), l);
  return map;
}

/** The price behind one plan's Payment Link, copied onto the plan. Null when the link is not on this account. */
async function syncPlan(stripe: Stripe, db: Any, plan: Any, links?: Map<string, Stripe.PaymentLink>) {
  const link = (links || await paymentLinks(stripe)).get(linkKey(plan.stripe_payment_link));
  if (!link) return null;
  const items = await stripe.paymentLinks.listLineItems(link.id, { limit: 1, expand: ['data.price'] });
  const price = items.data[0]?.price as Stripe.Price | undefined;
  if (!price?.unit_amount) return null;
  const billing = BILLING_OF(price);
  await db.from('academy_plans').update({
    price_cents: price.unit_amount, stripe_price_id: price.id, price_synced_at: new Date().toISOString(),
    ...(billing ? { billing } : {}), updated_at: new Date().toISOString(),
  }).eq('id', plan.id);
  return price;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const raw = await req.clone().json().catch(() => ({}));
  if (raw?.action === 'sync') {
    if (!stripeKey('collective')) return json({ error: 'The Collective Stripe key is not set.' }, 503);
    const stripe = new Stripe(stripeKey('collective'));
    const { data: plans } = await admin.from('academy_plans').select('id, label, package, price_cents, billing, stripe_payment_link').not('stripe_payment_link', 'is', null);
    const links = await paymentLinks(stripe);
    const synced: Any[] = []; const missing: string[] = [];
    for (const p of plans || []) {
      try {
        const price = await syncPlan(stripe, admin, p, links);
        if (price) synced.push({ plan: p.label, cents: price.unit_amount, billing: BILLING_OF(price) || p.billing, changed: price.unit_amount !== p.price_cents });
        else missing.push(p.label);
      } catch (e) { missing.push(`${p.label}: ${(e as Error).message}`); }
    }
    // Anyone can call this, so the details (plan names and prices) stay in the function log.
    console.log('academy-checkout sync', JSON.stringify({ source: raw?.source || '', synced, missing, links_on_account: links.size }));
    return json({ synced: synced.length, missing: missing.length, links_on_account: links.size });
  }
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: 'Please sign in to continue.' }, 401);

  let body: { token?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  if (!body.token) return json({ error: 'This enrollment link is incomplete.' }, 400);

  const { data: invite } = await admin.from('academy_invites')
    .select('id, email, full_name, expires_at, used_at, inquiry_id, program:academy_programs(id, slug, title), plan:academy_plans(id, billing, label, price_cents, access_days, is_active, stripe_payment_link)')
    .eq('token', body.token).maybeSingle();
  if (!invite) return json({ error: 'This enrollment link isn’t valid. Please contact members@thep31collective.org.' }, 404);
  if (invite.used_at) return json({ error: 'This enrollment link has already been used.' }, 409);
  if (new Date(invite.expires_at) < new Date()) return json({ error: 'This enrollment link has expired — ask your mentor for a new one.' }, 410);
  if ((user.email || '').toLowerCase() !== invite.email.toLowerCase()) {
    return json({ error: `This invitation was sent to a different email. Sign in with the address your mentor used.` }, 403);
  }
  // deno-lint-ignore no-explicit-any
  const plan = invite.plan as any; const program = invite.program as any;
  if (!plan?.is_active || !plan?.price_cents) return json({ error: 'This plan isn’t available yet — please contact your mentor.' }, 409);
  // Enrollment workflow step 4: Faith Mentorship, Business Coaching and Couples Private Mentorship (v58)
  // need all three forms signed before checkout.
  if (['business', 'faith', 'couples'].includes(program?.slug)) {
    const { data: intakes } = await admin.from('coaching_intakes').select('id, token').ilike('email', invite.email).neq('status', 'revoked');
    let signed = false; let formsToken = '';
    for (const i of intakes || []) {
      const { data: forms } = await admin.from('coaching_forms').select('kind').eq('intake_id', i.id);
      if (new Set((forms || []).map((f: { kind: string }) => f.kind)).size >= 3) { signed = true; break; }
      formsToken ||= i.token;
    }
    if (!signed) {
      return json({ error: 'Please complete your three enrollment forms first (Business Coaching Agreement, Confidentiality Agreement, Client Safety & Emergency).', forms: formsToken ? `/coaching/forms/${formsToken}` : null }, 409);
    }
  }

  const { data: existing } = await admin.from('academy_enrollments')
    .select('id, status, access_until, stripe_customer_id').eq('user_id', user.id).eq('program_id', program.id).maybeSingle();
  const stillActive = existing && ((existing.access_until === null && existing.status === 'active') ||
    (existing.access_until && new Date(existing.access_until) > new Date() && existing.status === 'active'));
  if (stillActive) return json({ already: true, program: program.slug });

  if (!stripeKey('collective')) {
    return json({ error: 'Card payments aren’t connected yet. Please email members@thep31collective.org and we’ll help you enroll.' }, 503);
  }
  const stripe = new Stripe(stripeKey('collective'));
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
  // Her own product and price when the plan has her Payment Link; otherwise the price on file.
  let price: Stripe.Price | null = null;
  if (plan.stripe_payment_link) {
    try { price = await syncPlan(stripe, admin, plan); } catch (e) { console.error('academy-checkout payment link', plan.id, e); }
    if (!price) console.error('academy-checkout: payment link not found on the Collective Stripe account', plan.stripe_payment_link);
  }
  const recurring = price ? price.type === 'recurring' : !!RECURRING[plan.billing];
  const session = await stripe.checkout.sessions.create({
    mode: recurring ? 'subscription' : 'payment',
    customer,
    client_reference_id: user.id,
    line_items: [price ? { quantity: 1, price: price.id } : {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: plan.price_cents,
        product_data: { name: `${program.title} — ${plan.label}` },
        ...(RECURRING[plan.billing] ? { recurring: RECURRING[plan.billing] } : {}),
      },
    }],
    metadata: meta,
    ...(recurring ? { subscription_data: { metadata: meta } } : { payment_intent_data: { metadata: meta } }),
    allow_promotion_codes: true,
    success_url: `${appUrl}/enroll/${body.token}?status=success`,
    cancel_url: `${appUrl}/enroll/${body.token}?status=cancelled`,
  });
  return json({ url: session.url });
});
