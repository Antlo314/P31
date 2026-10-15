// Two Stripe accounts, one per site:
//   market      p31market.com: shop checkout, vendor payouts (Connect), storefront subscriptions
//               MARKET_STRIPE_SECRET_KEY, MARKET_STRIPE_WEBHOOK_SECRET  (endpoint: stripe-webhook)
//   collective  thep31collective.org: mentorship and coaching
//               COLLECTIVE_STRIPE_SECRET_KEY, COLLECTIVE_STRIPE_WEBHOOK_SECRET  (endpoint: academy-webhook)
// Each falls back to the older single-account names (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// ACADEMY_STRIPE_WEBHOOK_SECRET), so one account for both sites keeps working.
// A webhook secret may hold several, comma-separated (e.g. the account endpoint and its
// connected-accounts endpoint).
import Stripe from 'npm:stripe@17.7.0';

export type StripeSide = 'market' | 'collective';
const env = (k: string) => Deno.env.get(k) || '';

export const stripeKey = (side: StripeSide) =>
  env(side === 'market' ? 'MARKET_STRIPE_SECRET_KEY' : 'COLLECTIVE_STRIPE_SECRET_KEY') || env('STRIPE_SECRET_KEY');

export const webhookSecrets = (side: StripeSide) =>
  (env(side === 'market' ? 'MARKET_STRIPE_WEBHOOK_SECRET' : 'COLLECTIVE_STRIPE_WEBHOOK_SECRET')
    || env(side === 'market' ? 'STRIPE_WEBHOOK_SECRET' : 'ACADEMY_STRIPE_WEBHOOK_SECRET'))
    .split(',').map((s) => s.trim()).filter(Boolean);

/** The Stripe client for one site, or null when that site is not connected yet. */
export const stripeFor = (side: StripeSide) => {
  const key = stripeKey(side);
  return key ? new Stripe(key) : null;
};

/** Check a webhook's signature against each of the site's secrets; the event, or the reason it failed. */
export async function verifyEvent(stripe: Stripe, side: StripeSide, body: string, signature: string) {
  let error = 'No webhook secret is set.';
  for (const secret of webhookSecrets(side)) {
    try {
      return { event: await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, Stripe.createSubtleCryptoProvider()), error: '' };
    } catch (err) { error = (err as Error).message; }
  }
  return { event: null, error };
}
