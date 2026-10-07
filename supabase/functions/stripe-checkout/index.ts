// Supabase Edge Function: stripe-checkout
// Public: creates a Stripe Checkout Session for a shopper's bag (one shop per
// checkout). The charge is created on the platform account and transferred to
// the vendor's connected account (destination charge); an optional
// PLATFORM_FEE_PERCENT is kept by the platform.
// Accepts { items: [{ productId, quantity, options }], discountCode } — or the
// older { productId, quantity } for a single item.
// Deploy: supabase functions deploy stripe-checkout
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildLines, discountFor, CartError } from '../_shared/cart.ts';

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

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.items) && body.items.length
      ? body.items
      : body.productId ? [{ productId: body.productId, quantity: body.quantity }] : [];

    const { shop, lines, subtotal } = await buildLines(admin, null, items);

    const { data: curator } = await admin
      .from('curator_data')
      .select('id, slug, business_name, stripe_account_id, stripe_charges_enabled')
      .eq('id', shop)
      .single();
    if (!curator?.stripe_account_id || !curator.stripe_charges_enabled) {
      return json({ error: 'This shop is not accepting card payments yet.' }, 400);
    }

    const disc = await discountFor(admin, curator.id, body.discountCode, subtotal);
    const discount = disc.ok ? disc.amount_cents : 0;
    const total = subtotal - discount;
    if (total < 50) return json({ error: 'Card checkout needs a total of at least $0.50.' }, 400);

    // Fee must be a sane percentage and strictly less than the charge total.
    const rawFeePercent = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENT') || '0');
    const feePercent = Number.isFinite(rawFeePercent) ? Math.min(Math.max(rawFeePercent, 0), 50) : 0;
    const applicationFee = feePercent > 0 ? Math.min(Math.round((total * feePercent) / 100), total - 1) : 0;

    const origin = (Deno.env.get('APP_URL') || req.headers.get('origin') || '').replace(/\/$/, '');
    const shopPath = `/${curator.slug || curator.id}`;

    // A one-off coupon carries the discount so Stripe's receipt shows it.
    const discounts = discount > 0
      ? [{ coupon: (await stripe.coupons.create({ amount_off: discount, currency: 'usd', duration: 'once', name: disc.code || 'Discount' })).id }]
      : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lines.map((l) => {
        const opts = Object.entries(l.options).map(([k, v]) => `${k}: ${v}`).join(' · ');
        return {
          quantity: l.quantity,
          price_data: {
            currency: 'usd',
            unit_amount: l.price_cents,
            product_data: {
              name: l.name,
              ...(opts ? { description: opts } : {}),
              ...(l.image_url && l.image_url.startsWith('http') ? { images: [l.image_url] } : {}),
            },
          },
        };
      }),
      ...(discounts ? { discounts } : {}),
      payment_intent_data: {
        transfer_data: { destination: curator.stripe_account_id },
        ...(applicationFee > 0 ? { application_fee_amount: applicationFee } : {}),
        metadata: { curator_id: curator.id },
      },
      metadata: {
        curator_id: curator.id,
        product_id: String(lines[0].product_id),
        product_name: lines.length > 1 ? `${lines[0].name} + ${lines.length - 1} more` : lines[0].name,
        quantity: String(lines.reduce((s, l) => s + l.quantity, 0)),
        application_fee: String(applicationFee),
      },
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: ['US'] },
      success_url: `${origin}${shopPath}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${shopPath}?purchase=cancelled`,
    });

    // Record the pending order now (full line items); the webhook marks it paid.
    const { error: orderErr } = await admin.from('orders').upsert({
      stripe_session_id: session.id,
      curator_id: curator.id,
      order_type: 'card',
      payment_status: 'pending',
      items: lines,
      product_id: lines[0].product_id,
      product_name: lines.length > 1 ? `${lines[0].name} + ${lines.length - 1} more` : lines[0].name,
      quantity: lines.reduce((s, l) => s + l.quantity, 0),
      amount_subtotal: subtotal,
      amount_total: total,
      discount_code: disc.ok ? disc.code : null,
      discount_amount: discount,
      application_fee: applicationFee,
      fulfillment_method: 'ship',
    }, { onConflict: 'stripe_session_id' });
    if (orderErr) console.error('Pending order insert failed:', orderErr.message);

    return json({ url: session.url });
  } catch (err) {
    if (err instanceof CartError) return json({ error: err.message }, 400);
    console.error('stripe-checkout error:', err);
    return json({ error: (err as Error).message || 'Failed to start checkout.' }, 500);
  }
});
