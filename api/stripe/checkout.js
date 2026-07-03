import { stripe, supabaseAdmin, siteUrl, assertConfigured } from '../_lib/shared.js';

// POST /api/stripe/checkout  { productId, quantity? }
// Public endpoint: creates a Stripe Checkout Session for a product. Funds are
// routed to the vendor's connected account (destination charge); the optional
// PLATFORM_FEE_PERCENT is kept by the platform.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!assertConfigured(res)) return;

  try {
    const { productId, quantity: rawQty } = req.body || {};
    const quantity = Math.min(Math.max(parseInt(rawQty, 10) || 1, 1), 10);
    if (!productId) return res.status(400).json({ error: 'productId is required.' });

    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('id, curator_id, name, description, price, image_url, stock_status')
      .eq('id', productId)
      .single();

    if (productError || !product) return res.status(404).json({ error: 'Product not found.' });
    if (product.stock_status === 'out_of_stock') {
      return res.status(400).json({ error: 'This item is sold out.' });
    }

    const { data: curator } = await supabaseAdmin
      .from('curator_data')
      .select('id, slug, business_name, stripe_account_id, stripe_charges_enabled')
      .eq('id', product.curator_id)
      .single();

    if (!curator?.stripe_account_id || !curator.stripe_charges_enabled) {
      return res.status(400).json({ error: 'This shop is not accepting card payments yet.' });
    }

    const unitAmount = Math.round(parseFloat(product.price) * 100);
    if (!Number.isFinite(unitAmount) || unitAmount < 50) {
      return res.status(400).json({ error: 'This item does not have a valid price for checkout.' });
    }

    const feePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '0');
    const applicationFee = feePercent > 0
      ? Math.round((unitAmount * quantity * feePercent) / 100)
      : 0;

    const base = siteUrl(req);
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
            ...(product.description ? { description: product.description.slice(0, 500) } : {}),
            ...(product.image_url && product.image_url.startsWith('http')
              ? { images: [product.image_url] }
              : {})
          }
        }
      }],
      payment_intent_data: {
        transfer_data: { destination: curator.stripe_account_id },
        ...(applicationFee > 0 ? { application_fee_amount: applicationFee } : {}),
        metadata: {
          product_id: String(product.id),
          curator_id: curator.id
        }
      },
      metadata: {
        product_id: String(product.id),
        product_name: product.name,
        curator_id: curator.id,
        quantity: String(quantity),
        application_fee: String(applicationFee)
      },
      shipping_address_collection: { allowed_countries: ['US'] },
      success_url: `${base}${shopPath}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${shopPath}?purchase=cancelled`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message || 'Failed to start checkout.' });
  }
}
