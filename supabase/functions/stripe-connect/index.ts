// Supabase Edge Function: stripe-connect
// Creates (or reuses) the signed-in vendor's Stripe Express account and returns
// a hosted onboarding link where they enter their business + bank details.
// Deploy: supabase functions deploy stripe-connect
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { stripeKey as stripeKeyFor } from '../_shared/stripe.ts';

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

  const stripeKey = stripeKeyFor('market');
  if (!stripeKey) return json({ error: 'Payments not configured (missing MARKET_STRIPE_SECRET_KEY).' }, 500);

  try {
    const stripe = new Stripe(stripeKey);
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // Resolve the logged-in vendor from their JWT
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'You must be signed in to connect Stripe.' }, 401);

    const { data: curator } = await admin
      .from('curator_data')
      .select('id, business_name, stripe_account_id')
      .eq('id', user.id)
      .single();
    if (!curator) return json({ error: 'Curator profile not found. Complete your shop identity first.' }, 404);

    let accountId = curator.stripe_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        business_profile: curator.business_name ? { name: curator.business_name } : undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { curator_id: user.id },
      });
      accountId = account.id;

      const { error } = await admin
        .from('curator_data')
        .update({ stripe_account_id: accountId })
        .eq('id', user.id);
      if (error) return json({ error: 'Could not save Stripe account: ' + error.message }, 500);
    }

    const origin = (Deno.env.get('APP_URL') || req.headers.get('origin') || '').replace(/\/$/, '');
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/storefront?stripe=refresh`,
      return_url: `${origin}/dashboard/storefront?stripe=return`,
      type: 'account_onboarding',
    });

    return json({ url: link.url });
  } catch (err) {
    console.error('stripe-connect error:', err);
    const msg = (err as Error).message || '';
    // P31's own Stripe account has not switched on Connect yet: nothing the vendor can fix, so say so plainly.
    if (/signed up for Connect|dashboard\.stripe\.com\/connect/i.test(msg)) {
      return json({ error: 'Card payments for P31 shops are not switched on yet on our side. The P31 team has been told; please try again in a day or two. Everything else in your shop works in the meantime.', code: 'connect_off' }, 503);
    }
    return json({ error: msg || 'Failed to start Stripe onboarding.' }, 500);
  }
});
