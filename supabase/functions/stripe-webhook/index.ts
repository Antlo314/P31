// Supabase Edge Function: stripe-webhook
// Records paid orders and syncs connected-account status. Stripe calls this
// directly (no Supabase JWT), so it MUST be deployed with JWT verification off:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// (or set verify_jwt = false in supabase/config.toml / the dashboard toggle).
// Configure the endpoint in Stripe with events:
//   checkout.session.completed, account.updated
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    console.error('Webhook missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return new Response('Webhook not configured', { status: 500 });
  }

  const stripe = new Stripe(stripeKey);
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Signature verification needs the raw body + async SubtleCrypto in Deno.
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') || '';
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', (err as Error).message);
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata || {};
        const shipping =
          // deno-lint-ignore no-explicit-any
          (session as any).shipping_details ||
          // deno-lint-ignore no-explicit-any
          (session as any).collected_information?.shipping_details ||
          (session.customer_details?.address ? { address: session.customer_details.address } : null);

        const { error } = await admin.from('orders').upsert({
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
          curator_id: meta.curator_id || null,
          product_id: meta.product_id ? parseInt(meta.product_id, 10) : null,
          product_name: meta.product_name || null,
          quantity: meta.quantity ? parseInt(meta.quantity, 10) : 1,
          amount_subtotal: session.amount_subtotal,
          amount_total: session.amount_total,
          application_fee: meta.application_fee ? parseInt(meta.application_fee, 10) : 0,
          currency: session.currency || 'usd',
          buyer_email: session.customer_details?.email ?? null,
          buyer_name: session.customer_details?.name ?? null,
          shipping_address: shipping,
          payment_status: session.payment_status === 'paid' ? 'paid' : 'pending',
        }, { onConflict: 'stripe_session_id' });

        if (error) {
          console.error('Order upsert failed:', error.message);
          return new Response('Order recording failed', { status: 500 }); // let Stripe retry
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const { error } = await admin
          .from('curator_data')
          .update({
            stripe_charges_enabled: !!account.charges_enabled,
            stripe_payouts_enabled: !!account.payouts_enabled,
            stripe_details_submitted: !!account.details_submitted,
          })
          .eq('stripe_account_id', account.id);
        if (error) console.error('Account status sync failed:', error.message);
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Webhook handler failed', { status: 500 });
  }
});
