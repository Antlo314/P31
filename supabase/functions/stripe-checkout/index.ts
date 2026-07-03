// Supabase Edge Function: stripe-checkout
// Public: creates a Stripe Checkout Session for a product. The charge is created
// on the platform account and transferred to the vendor's connected account
// (destination charge); an optional PLATFORM_FEE_PERCENT is kept by the platform.
// Deploy: supabase functions deploy stripe-checkout
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

    const { productId, quantity: rawQty } = await req.json().catch(() => ({}));
    const quantity = Math.min(Math.max(parseInt(rawQty, 10) || 1, 1), 10);
    if (!productId) return json({ error: 'productId is required.' }, 400);

    const { data: product } = await admin
      .from('products')
      .select('id, curator_id, name, description, price, image_url, stock_status')
      .eq('id', productId)
      .single();
    if (!product) return json({ error: 'Product not found.' }, 404);
    if (product.stock_status === 'out_of_stock') return json({ error: 'This item is sold out.' }, 400);

    const { data: curator } = await admin
      .from('curator_data')
      .select('id, slug, business_name, stripe_account_id, stripe_charges_enabled')
      .eq('id', product.curator_id)
      .single();
    if (!curator?.stripe_account_id || !curator.stripe_charges_enabled) {
      return json({ error: 'This shop is not accepting card payments yet.' }, 400);
    }

    const unitAmount = Math.round(parseFloat(product.price) * 100);
    if (!Number.isFinite(unitAmount) || unitAmount < 50) {
      return json({ error: 'This item does not have a valid price for checkout.' }, 400);
    }

    // Fee must be a sane percentage and strictly less than the charge total,
    // or Stripe rejects the PaymentIntent and no checkout is possible.
    const rawFeePercent = parseFloat(Deno.env.get('PLATFORM_FEE_PERCENT') || '0');
    const feePercent = Number.isFinite(rawFeePercent) ? Math.min(Math.max(rawFeePercent, 0), 50) : 0;
    const applicationFee = feePercent > 0
      ? Math.min(Math.round((unitAmount * quantity * feePercent) / 100), unitAmount * quantity - 1)
      : 0;

    const origin = (Deno.env.get('APP_URL') || req.headers.get('origin') || '').replace(/\/$/, '');
    const shopPath = `/${curator.slug || curator.id}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity,
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          product_data: {
            name: product.name,
            ...(product.description ? { description: String(product.description).slice(0, 500) } : {}),
            ...(product.image_url && String(product.image_url).startsWith('http')
              ? { images: [product.image_url] }
              : {}),
          },
        },
      }],
      payment_intent_data: {
        transfer_data: { destination: curator.stripe_account_id },
        ...(applicationFee > 0 ? { application_fee_amount: applicationFee } : {}),
        metadata: { product_id: String(product.id), curator_id: curator.id },
      },
      metadata: {
        product_id: String(product.id),
        product_name: product.name,
        curator_id: curator.id,
        quantity: String(quantity),
        application_fee: String(applicationFee),
      },
      shipping_address_collection: { allowed_countries: ['US'] },
      success_url: `${origin}${shopPath}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${shopPath}?purchase=cancelled`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error('stripe-checkout error:', err);
    return json({ error: (err as Error).message || 'Failed to start checkout.' }, 500);
  }
});
