// Supabase Edge Function: academy-billing
// Opens Stripe's customer portal so a student can update their card, see
// receipts or cancel. (Turn the portal on in Stripe → Settings → Billing.)
//   supabase functions deploy academy-billing
// Body: { program }  →  { url } | { error }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env('STRIPE_SECRET_KEY')) return json({ error: 'Billing isn’t connected yet — email members@thep31collective.org.' }, 503);

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data: userData } = await db.auth.getUser((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''));
  const user = userData?.user;
  if (!user) return json({ error: 'Please sign in.' }, 401);

  let program = '';
  try { program = String((await req.json()).program || ''); } catch { /* empty */ }
  const { data: row } = await db.from('academy_enrollments')
    .select('stripe_customer_id, program:academy_programs!inner(slug)')
    .eq('user_id', user.id).eq('program.slug', program).maybeSingle();
  if (!row?.stripe_customer_id) return json({ error: 'There’s no card on file for this mentorship.' }, 404);

  const stripe = new Stripe(env('STRIPE_SECRET_KEY'));
  const appUrl = (env('APP_URL') || 'https://www.p31market.com').replace(/\/$/, '');
  const portal = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id, return_url: `${appUrl}/academy/${program}/billing`,
  });
  return json({ url: portal.url });
});
