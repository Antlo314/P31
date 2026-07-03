import { stripe, supabaseAdmin, getAuthedUser, assertConfigured } from '../_lib/shared.js';

// POST /api/stripe/account-status
// Syncs the vendor's Stripe account status into curator_data and returns it.
// Pass { action: 'dashboard' } to also get an Express dashboard login link.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!assertConfigured(res)) return;

  try {
    const user = await getAuthedUser(req);
    if (!user) return res.status(401).json({ error: 'You must be signed in.' });

    const { data: curator } = await supabaseAdmin
      .from('curator_data')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .single();

    if (!curator?.stripe_account_id) {
      return res.status(200).json({ connected: false });
    }

    const account = await stripe.accounts.retrieve(curator.stripe_account_id);

    const status = {
      connected: true,
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted
    };

    await supabaseAdmin
      .from('curator_data')
      .update({
        stripe_charges_enabled: status.charges_enabled,
        stripe_payouts_enabled: status.payouts_enabled,
        stripe_details_submitted: status.details_submitted
      })
      .eq('id', user.id);

    let dashboardUrl = null;
    const { action } = req.body || {};
    if (action === 'dashboard' && account.details_submitted) {
      const loginLink = await stripe.accounts.createLoginLink(curator.stripe_account_id);
      dashboardUrl = loginLink.url;
    }

    return res.status(200).json({ ...status, dashboardUrl });
  } catch (err) {
    console.error('Stripe status error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch Stripe status.' });
  }
}
