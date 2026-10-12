// Supabase Edge Function: vendor-billing
// The storefront subscription promised in the Storefront Agreement: a free period after a shop is
// approved, then a monthly subscription (price and terms in app_settings 'billing', v42).
//   { action: 'checkout' }  a signed-in vendor: a Stripe Checkout link for her subscription. During the
//                           free period her card is saved now and the first charge waits for its end.
//   { action: 'portal' }    a signed-in vendor: a Stripe billing-portal link to change card or cancel.
//   { action: 'sweep' }     the scheduler (daily): a reminder before the free period ends, a note when it
//                           ends, an optional pause after the grace days, and a note when a payment fails.
// Stripe events (checkout completed, invoices, subscription changes) arrive at academy-webhook, which
// already listens for them on this Stripe account.
// Secrets: STRIPE_SECRET_KEY, RESEND_API_KEY, MARKET_EMAIL_FROM or EMAIL_FROM
// Deploy: supabase functions deploy vendor-billing --no-verify-jwt
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const SITE = 'https://www.p31market.com';
const BILLING = `${SITE}/dashboard/billing`;
const FOOT = 'p31market.com · Where her gifts make room.';
const VENDOR_EMAIL = 'vendor@p31market.com';
const DEFAULTS = { price_cents: 1499, free_months: 3, remind_days: 14, grace_days: 7, auto_pause: false };
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' });
const dollars = (c: number) => `$${(c / 100).toFixed(2)}`;
const button = (href: string, label: string) => `<p style="margin:22px 0 0"><a href="${href}" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">${esc(label)}</a></p>`;

// deno-lint-ignore no-explicit-any
async function settings(db: any) {
  const { data } = await db.from('app_settings').select('value').eq('key', 'billing').maybeSingle();
  return { ...DEFAULTS, ...(data?.value || {}) };
}

// deno-lint-ignore no-explicit-any
async function vendorEmail(db: any, shop: Row) {
  if (shop.public_email) return shop.public_email as string;
  const { data } = await db.auth.admin.getUserById(shop.id);
  return data?.user?.email || null;
}

// deno-lint-ignore no-explicit-any
async function logSystem(db: any, shop: Row, change: Row) {
  await db.from('admin_activity').insert({ actor_name: 'P31 Systems', area: 'curator_data', action: 'update', target_id: shop.id, target_label: shop.business_name, changes: change });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  let b: Row = {};
  try { b = await req.json(); } catch { /* empty body */ }
  const s = await settings(db);

  // ── The vendor's own links ──
  if (b.action === 'checkout' || b.action === 'portal') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: who } = await db.auth.getUser(token);
    const user = who?.user;
    if (!user) return json({ error: 'Please sign in to your curator studio first.' }, 401);
    const { data: shop } = await db.from('curator_data').select('*').eq('id', user.id).maybeSingle();
    if (!shop) return json({ error: 'This account does not have a storefront yet.' }, 404);
    if (!env('STRIPE_SECRET_KEY')) return json({ error: `Card payments are not connected yet. Write to ${VENDOR_EMAIL} and we will help.` }, 503);
    const stripe = new Stripe(env('STRIPE_SECRET_KEY'));

    if (b.action === 'portal') {
      if (!shop.stripe_billing_customer_id) return json({ error: 'There is no subscription to manage yet.' }, 409);
      try {
        const portal = await stripe.billingPortal.sessions.create({ customer: shop.stripe_billing_customer_id, return_url: BILLING });
        return json({ url: portal.url });
      } catch (e) {
        return json({ error: `The billing page is not set up yet (${(e as Error).message}). Write to ${VENDOR_EMAIL} to change your card or cancel.` }, 503);
      }
    }

    if (['active', 'past_due'].includes(shop.subscription_status) && shop.stripe_subscription_id) return json({ already: true });
    if (shop.subscription_status === 'comp') return json({ error: 'Your storefront is complimentary; there is nothing to pay.' }, 409);

    let customer = shop.stripe_billing_customer_id || undefined;
    if (!customer) {
      const c = await stripe.customers.create({ email: user.email, name: shop.business_name || undefined, metadata: { curator_id: shop.id, source: 'p31-storefront' } });
      customer = c.id;
      await db.from('curator_data').update({ stripe_billing_customer_id: customer }).eq('id', shop.id);
    }
    const meta = { kind: 'storefront', curator_id: shop.id };
    // Still in the free period (at least two days left): save the card now, first charge when it ends.
    const trialEnd = shop.trial_ends_at ? Math.floor(new Date(shop.trial_ends_at).getTime() / 1000) : 0;
    const keepTrial = trialEnd > Math.floor(Date.now() / 1000) + 2 * 86400;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: shop.id,
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Number(s.price_cents) || 1499, recurring: { interval: 'month', interval_count: 1 }, product_data: { name: 'P31 Marketplace storefront' } } }],
      metadata: meta,
      subscription_data: { metadata: meta, ...(keepTrial ? { trial_end: trialEnd } : {}) },
      allow_promotion_codes: true,
      success_url: `${BILLING}?status=success`,
      cancel_url: `${BILLING}?status=cancelled`,
    });
    return json({ url: session.url });
  }

  // ── The daily sweep ──
  if (b.action !== 'sweep') return json({ error: 'Unknown action' }, 400);
  if (!emailConfigured()) return json({ ok: false, waiting: 'email' });
  const from = env('MARKET_EMAIL_FROM') || env('EMAIL_FROM') || undefined;
  const now = Date.now();
  const price = dollars(Number(s.price_cents) || 1499);
  const out = { reminded: 0, ended: 0, paused: 0, past_due: 0 };
  const { data: shops } = await db.from('curator_data')
    .select('id, business_name, slug, status, public_email, subscription_status, trial_ends_at, billing_notice, billing_notice_at')
    .in('subscription_status', ['trial', 'ended', 'past_due']).limit(500);

  for (const shop of shops || []) {
    const to = await vendorEmail(db, shop);
    const name = shop.business_name || 'your shop';
    const end = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : null;
    const send = async (subject: string, title: string, body: string, notice: string, patch: Row = {}) => {
      if (to) {
        const res = await sendEmail(to, subject, layout(title, body, FOOT), VENDOR_EMAIL, from);
        if (!res.ok && !res.skipped) return false;
      }
      await db.from('curator_data').update({ billing_notice: notice, billing_notice_at: new Date().toISOString(), ...patch }).eq('id', shop.id);
      return true;
    };

    if (shop.subscription_status === 'trial' && end) {
      const daysLeft = Math.ceil((end - now) / 864e5);
      if (end <= now) {
        if (await send(`Your free storefront period has ended: ${name}`, 'Your free period has ended',
          `<p>Thank you for building <b>${esc(name)}</b> on the Proverbs 31 Marketplace. Your complimentary period ended on ${esc(longDate(shop.trial_ends_at))}.</p>
<p>To keep your storefront open, start your subscription: ${esc(price)} a month, and the 5% fee per sale stays the same. You can cancel any time with two weeks’ notice.</p>
${button(BILLING, 'Keep my storefront open')}
<p style="margin-top:18px;font-size:13px;color:#74657A">Questions? Reply to this email or write to ${VENDOR_EMAIL}.</p>`, 'ended', { subscription_status: 'ended' })) out.ended += 1;
      } else if (daysLeft <= Number(s.remind_days) && shop.billing_notice !== 'reminder') {
        if (await send(`${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your free storefront period`, 'Your free period ends soon',
          `<p>Your complimentary storefront period for <b>${esc(name)}</b> ends on <b>${esc(longDate(shop.trial_ends_at))}</b>.</p>
<p>To keep your storefront open after that, set up your subscription now: ${esc(price)} a month, with the 5% fee per sale as before. Your card is saved today and the first charge waits until your free period ends.</p>
${button(BILLING, 'Set up my subscription')}
<p style="margin-top:18px;font-size:13px;color:#74657A">Questions? Reply to this email or write to ${VENDOR_EMAIL}.</p>`, 'reminder')) out.reminded += 1;
      }
    } else if (shop.subscription_status === 'ended' && end && s.auto_pause && shop.status === 'approved' && now > end + Number(s.grace_days) * 864e5) {
      if (await send(`Your storefront is paused: ${name}`, 'Your storefront is paused',
        `<p>Your free period for <b>${esc(name)}</b> ended on ${esc(longDate(shop.trial_ends_at))}, so your storefront is paused and hidden from the marketplace for now. Your products and settings are all kept.</p>
<p>Start your subscription and your storefront opens again straight away.</p>
${button(BILLING, 'Reopen my storefront')}`, 'paused', { status: 'paused' })) {
        await logSystem(db, shop, { status: ['approved', 'paused'], reason: ['', 'free period ended without a subscription'] });
        out.paused += 1;
      }
    } else if (shop.subscription_status === 'past_due' && shop.billing_notice !== 'past_due') {
      if (await send(`We could not take your storefront payment: ${name}`, 'Your payment did not go through',
        `<p>Your latest storefront payment for <b>${esc(name)}</b> did not go through. Stripe will try again over the next few days.</p>
<p>To update your card, open your billing page.</p>${button(BILLING, 'Update my card')}`, 'past_due')) out.past_due += 1;
    }
  }
  return json({ ok: true, ...out });
});
