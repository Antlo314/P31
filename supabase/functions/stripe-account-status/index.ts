// Supabase Edge Function: stripe-account-status
// Syncs the vendor's Stripe account status into curator_data and returns it.
// Pass { action: 'dashboard' } to also get an Express dashboard login link.
// Deploy: supabase functions deploy stripe-account-status
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Payments not configured (missing STRIPE_SECRET_KEY).' }, 500);

  try {
    const stripe = new Stripe(stripeKey);
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'You must be signed in.' }, 401);

    const { data: curator } = await admin
      .from('curator_data')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (!curator?.stripe_account_id) return json({ connected: false });

    const account = await stripe.accounts.retrieve(curator.stripe_account_id);
    const status = {
      connected: true,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
    };

    await admin
      .from('curator_data')
      .update({
        stripe_charges_enabled: status.charges_enabled,
        stripe_payouts_enabled: status.payouts_enabled,
        stripe_details_submitted: status.details_submitted,
      })
      .eq('id', user.id);

    let dashboardUrl: string | null = null;
    let action: string | undefined;
    try {
      action = (await req.json())?.action;
    } catch { /* no body */ }
    if (action === 'dashboard' && account.details_submitted) {
      const loginLink = await stripe.accounts.createLoginLink(curator.stripe_account_id);
      dashboardUrl = loginLink.url;
    }

    return json({ ...status, dashboardUrl });
  } catch (err) {
    console.error('stripe-account-status error:', err);
    return json({ error: (err as Error).message || 'Failed to fetch Stripe status.' }, 500);
  }
});
