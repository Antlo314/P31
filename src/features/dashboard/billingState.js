// How a vendor storefront plan stands (curator_data billing fields from v42), shared by the
// studio banner and the Plan & billing page.
export const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');
export const daysLeft = (iso) => (iso ? Math.ceil((new Date(iso) - Date.now()) / 864e5) : null);
export const dollars = (c) => `$${(c / 100).toFixed(2)}`;

/** How a vendor's storefront plan stands, in one sentence (also used for the studio banner). */
export function billingState(c) {
  if (!c || !('subscription_status' in c)) return null;
  const d = daysLeft(c.trial_ends_at);
  switch (c.subscription_status) {
    case 'trial': return { tone: d <= 14 ? 'warn' : 'calm', title: d > 0 ? `${d} day${d === 1 ? '' : 's'} left in your free period` : 'Your free period ends today', text: `Your complimentary storefront period ends on ${fmt(c.trial_ends_at)}.`, act: 'subscribe' };
    case 'ended': return { tone: 'alert', title: 'Your free period has ended', text: `It ended on ${fmt(c.trial_ends_at)}. Start your subscription to keep your storefront open.`, act: 'subscribe' };
    case 'active': return { tone: 'ok', title: 'Your storefront subscription is active', text: c.subscription_current_end ? `Next renewal: ${fmt(c.subscription_current_end)}.` : 'Thank you for building with us.', act: 'manage' };
    case 'past_due': return { tone: 'alert', title: 'Your last payment did not go through', text: 'Stripe will try again over the next few days. Update your card to keep your storefront open.', act: 'manage' };
    case 'canceled': return { tone: 'alert', title: 'Your subscription is canceled', text: 'Start it again any time to keep your storefront open.', act: 'subscribe' };
    case 'comp': return { tone: 'ok', title: 'Your storefront is complimentary', text: 'There is nothing to pay. Thank you for being part of P31 from the start.', act: null };
    default: return { tone: 'calm', title: 'Your storefront plan', text: 'Your storefront is free for now. We will email you before anything changes.', act: null };
  }
}

