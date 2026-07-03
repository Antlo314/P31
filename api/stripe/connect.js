import { stripe, supabaseAdmin, getAuthedUser, siteUrl, assertConfigured } from '../_lib/shared.js';

// POST /api/stripe/connect
// Creates (or reuses) the vendor's Stripe Express account and returns an
// onboarding link where they enter their payout/bank details.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!assertConfigured(res)) return;

  try {
    const user = await getAuthedUser(req);
    if (!user) return res.status(401).json({ error: 'You must be signed in to connect Stripe.' });

    const { data: curator, error: curatorError } = await supabaseAdmin
      .from('curator_data')
      .select('id, business_name, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (curatorError || !curator) {
      return res.status(404).json({ error: 'Curator profile not found. Complete your shop identity first.' });
    }

    let accountId = curator.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        business_profile: { name: curator.business_name || undefined },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        metadata: { curator_id: user.id }
      });
      accountId = account.id;

      const { error: saveError } = await supabaseAdmin
        .from('curator_data')
        .update({ stripe_account_id: accountId })
        .eq('id', user.id);
      if (saveError) throw new Error('Could not save Stripe account: ' + saveError.message);
    }

    const base = siteUrl(req);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/dashboard/storefront?stripe=refresh`,
      return_url: `${base}/dashboard/storefront?stripe=return`,
      type: 'account_onboarding'
    });

    return res.status(200).json({ url: accountLink.url });
  } catch (err) {
    console.error('Stripe connect error:', err);
    return res.status(500).json({ error: err.message || 'Failed to start Stripe onboarding.' });
  }
}
