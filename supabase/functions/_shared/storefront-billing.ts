// Storefront subscriptions (vendor-billing, v42) kept in step on curator_data. Called by the Market's
// webhook (stripe-webhook) and, when one Stripe account serves both sites, by academy-webhook too.
// Every update is by subscription id, so running it twice for the same event is harmless.
import Stripe from 'npm:stripe@17.7.0';

const iso = (unixSeconds?: number | null) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null);
// deno-lint-ignore no-explicit-any
const periodEnd = (sub: any) => sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;
// deno-lint-ignore no-explicit-any
const invoiceSub = (inv: any) => (typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id || inv.parent?.subscription_details?.subscription);

// deno-lint-ignore no-explicit-any
type Db = any;

// deno-lint-ignore no-explicit-any
async function patchShops(db: Db, subId: string, patch: Record<string, any>) {
  const { data: shops } = await db.from('curator_data').update(patch).eq('stripe_subscription_id', subId).select('id, status, billing_notice');
  // A shop paused for an unpaid subscription opens again once it is paid.
  for (const shop of shops || []) {
    if (patch.subscription_status === 'active' && shop.status === 'paused' && shop.billing_notice === 'paused') {
      await db.from('curator_data').update({ status: 'approved', billing_notice: null }).eq('id', shop.id);
    }
  }
}

/** Handle the event if it concerns a storefront subscription. */
export async function storefrontEvent(stripe: Stripe, db: Db, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const m = s.metadata || {};
      if (!(m.kind === 'storefront' && m.curator_id && s.mode === 'subscription' && s.subscription)) return;
      const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription.id;
      const sub = await stripe.subscriptions.retrieve(subId);
      const { data: shop } = await db.from('curator_data').update({
        subscription_status: 'active', stripe_subscription_id: subId,
        stripe_billing_customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id || null,
        subscription_current_end: iso(periodEnd(sub)), billing_notice: null, billing_notice_at: null,
      }).eq('id', m.curator_id).select('id, status').maybeSingle();
      if (shop?.status === 'paused') await db.from('curator_data').update({ status: 'approved' }).eq('id', shop.id);
      return;
    }
    case 'invoice.paid': {
      // deno-lint-ignore no-explicit-any
      const inv = event.data.object as any;
      const subId = invoiceSub(inv);
      if (subId) await patchShops(db, subId, { subscription_status: 'active', subscription_current_end: iso(inv.lines?.data?.[0]?.period?.end), billing_notice: null });
      return;
    }
    case 'invoice.payment_failed': {
      const subId = invoiceSub(event.data.object);
      if (subId) await patchShops(db, subId, { subscription_status: 'past_due' });
      return;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      // A Stripe trial (the vendor's free period) still counts as subscribed.
      const status = sub.status === 'canceled' ? 'canceled' : ['past_due', 'unpaid', 'incomplete'].includes(sub.status) ? 'past_due' : 'active';
      await patchShops(db, sub.id, { subscription_status: status, subscription_current_end: iso(periodEnd(sub)) });
      return;
    }
    case 'customer.subscription.deleted': {
      await patchShops(db, (event.data.object as Stripe.Subscription).id, { subscription_status: 'canceled' });
      return;
    }
  }
}
