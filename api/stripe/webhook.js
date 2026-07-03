import { stripe, supabaseAdmin } from '../_lib/shared.js';

// Stripe needs the raw request body to verify the webhook signature.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// POST /api/stripe/webhook
// Configure in Stripe Dashboard → Developers → Webhooks with events:
//   checkout.session.completed, account.updated
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const meta = session.metadata || {};

        const { error } = await supabaseAdmin.from('orders').upsert({
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id || null,
          curator_id: meta.curator_id || null,
          product_id: meta.product_id ? parseInt(meta.product_id, 10) : null,
          product_name: meta.product_name || null,
          quantity: meta.quantity ? parseInt(meta.quantity, 10) : 1,
          amount_subtotal: session.amount_subtotal,
          amount_total: session.amount_total,
          application_fee: meta.application_fee ? parseInt(meta.application_fee, 10) : 0,
          currency: session.currency || 'usd',
          buyer_email: session.customer_details?.email || null,
          buyer_name: session.customer_details?.name || null,
          shipping_address: session.shipping_details || session.customer_details?.address
            ? (session.shipping_details || { address: session.customer_details.address })
            : null,
          payment_status: session.payment_status === 'paid' ? 'paid' : 'pending'
        }, { onConflict: 'stripe_session_id' });

        if (error) {
          console.error('Order insert failed:', error.message);
          // Return 500 so Stripe retries the delivery
          return res.status(500).json({ error: 'Order recording failed' });
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        const { error } = await supabaseAdmin
          .from('curator_data')
          .update({
            stripe_charges_enabled: !!account.charges_enabled,
            stripe_payouts_enabled: !!account.payouts_enabled,
            stripe_details_submitted: !!account.details_submitted
          })
          .eq('stripe_account_id', account.id);
        if (error) console.error('Account status sync failed:', error.message);
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
