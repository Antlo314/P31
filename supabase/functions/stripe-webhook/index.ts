// Supabase Edge Function: stripe-webhook
// Records paid orders and syncs connected-account status. Stripe calls this
// directly (no Supabase JWT), so it MUST be deployed with JWT verification off:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// (or set verify_jwt = false in supabase/config.toml / the dashboard toggle).
// The Market's Stripe account (MARKET_STRIPE_SECRET_KEY; see _shared/stripe.ts). Configure the endpoint with events:
//   checkout.session.completed, invoice.paid, invoice.payment_failed,
//   customer.subscription.updated, customer.subscription.deleted   (orders and storefront subscriptions)
// and a second, "connected accounts" endpoint at the same address with account.updated (vendor payouts).
// Each has its own signing secret: MARKET_STRIPE_WEBHOOK_SECRET holds both, comma-separated: whsec_aaa,whsec_bbb
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { stripeFor, webhookSecrets, verifyEvent } from '../_shared/stripe.ts';
import { storefrontEvent } from '../_shared/storefront-billing.ts';
import { sendEmail, layout, itemsTable, money, esc } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const stripe = stripeFor('market');
  if (!stripe || !webhookSecrets('market').length) {
    console.error('stripe-webhook: missing MARKET_STRIPE_SECRET_KEY or MARKET_STRIPE_WEBHOOK_SECRET');
    return new Response('Webhook not configured', { status: 500 });
  }
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Signature verification needs the raw body + async SubtleCrypto in Deno.
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') || '';
  const { event, error: lastError } = await verifyEvent(stripe, 'market', body, signature);
  if (!event) {
    console.error('Webhook signature verification failed:', lastError);
    return new Response(`Webhook error: ${lastError}`, { status: 400 });
  }

  try {
    // Storefront subscriptions ($14.99 a month after the free period) live on the Market's account.
    await storefrontEvent(stripe, admin, event);
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = session.metadata || {};
        // Mentorship enrollments (academy-webhook) and storefront subscriptions (above) are not orders.
        if (meta.kind === 'academy' || meta.kind === 'storefront' || session.mode === 'subscription') break;
        const shipping =
          // deno-lint-ignore no-explicit-any
          (session as any).shipping_details ||
          // deno-lint-ignore no-explicit-any
          (session as any).collected_information?.shipping_details ||
          (session.customer_details?.address ? { address: session.customer_details.address } : null);

        // Was this order already recorded as paid? (Stripe can retry.)
        const { data: existing } = await admin
          .from('orders').select('id, payment_status, items, discount_code')
          .eq('stripe_session_id', session.id).maybeSingle();
        const wasPaid = existing?.payment_status === 'paid';
        const paid = session.payment_status === 'paid';

        const { data: order, error } = await admin.from('orders').upsert({
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
          buyer_phone: session.customer_details?.phone ?? null,
          shipping_address: shipping,
          payment_status: paid ? 'paid' : 'pending',
          order_type: 'card',
        }, { onConflict: 'stripe_session_id' }).select('id, items, discount_code, discount_amount, amount_total, curator_id, buyer_email, buyer_name').single();

        if (error) {
          console.error('Order upsert failed:', error.message);
          return new Response('Order recording failed', { status: 500 }); // let Stripe retry
        }

        // First time this order is paid: count stock down, redeem the code, send emails.
        if (paid && !wasPaid && order) {
          const lines = Array.isArray(order.items) && order.items.length
            ? order.items
            : (meta.product_id ? [{ product_id: parseInt(meta.product_id, 10), quantity: parseInt(meta.quantity || '1', 10), name: meta.product_name, price_cents: session.amount_subtotal || 0 }] : []);
          for (const l of lines) {
            await admin.rpc('decrement_inventory', { p_product_id: l.product_id, p_qty: l.quantity || 1 });
          }
          if (order.discount_code && order.curator_id) {
            await admin.rpc('redeem_discount', { p_curator_id: order.curator_id, p_code: order.discount_code });
          }

          try {
            const { data: curator } = await admin.from('curator_data').select('business_name, public_email').eq('id', order.curator_id).single();
            const { data: owner } = await admin.auth.admin.getUserById(order.curator_id);
            const curatorEmail = curator?.public_email || owner?.user?.email;
            const ref = String(order.id).slice(0, 8).toUpperCase();
            const appUrl = (Deno.env.get('APP_URL') || 'https://p31market.com').replace(/\/$/, '');
            const table = itemsTable(lines, order.discount_amount || 0, order.amount_total || 0);
            if (curatorEmail) {
              await sendEmail(curatorEmail, `New paid order #${ref} — ${money(order.amount_total || 0)}`, layout('You made a sale!', `
<p>${esc(order.buyer_name || 'A shopper')} just paid for an order.</p>${table}
<p><a href="${appUrl}/dashboard/orders" style="display:inline-block;background:#3A1C36;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Fulfil this order</a></p>`), order.buyer_email || undefined);
            }
            if (order.buyer_email) {
              await sendEmail(order.buyer_email, `Your order from ${curator?.business_name || 'P31 Marketplace'} (#${ref})`, layout('Thank you for your order', `
<p>Your payment went through. <strong>${esc(curator?.business_name || 'The shop')}</strong> will prepare your order and let you know when it ships.</p>${table}`), curatorEmail || undefined);
            }
          } catch (mailErr) {
            console.error('Order emails failed:', (mailErr as Error).message);
          }
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
