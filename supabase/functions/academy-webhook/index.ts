// Supabase Edge Function: academy-webhook
// Keeps mentorship enrollments in step with Stripe. Its own Stripe endpoint and
// signing secret, separate from the curator-orders webhook.
//   supabase secrets set ACADEMY_STRIPE_WEBHOOK_SECRET=whsec_...
//   supabase functions deploy academy-webhook          (verify_jwt = false in config.toml)
// Stripe → Developers → Webhooks → endpoint https://<project>.supabase.co/functions/v1/academy-webhook
// Events: checkout.session.completed, invoice.paid, invoice.payment_failed,
//         customer.subscription.updated, customer.subscription.deleted
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRACE_DAYS = 3; // renewals can land a little after the period ends
const env = (k: string) => Deno.env.get(k) || '';
const iso = (unixSeconds?: number | null, plusDays = 0) =>
  unixSeconds ? new Date(unixSeconds * 1000 + plusDays * 86400_000).toISOString() : null;
// deno-lint-ignore no-explicit-any
const periodEnd = (sub: any) => sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!env('STRIPE_SECRET_KEY') || !env('ACADEMY_STRIPE_WEBHOOK_SECRET')) {
    console.error('academy-webhook: missing STRIPE_SECRET_KEY or ACADEMY_STRIPE_WEBHOOK_SECRET');
    return new Response('Not configured', { status: 500 });
  }
  const stripe = new Stripe(env('STRIPE_SECRET_KEY'));
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, req.headers.get('stripe-signature') || '',
      env('ACADEMY_STRIPE_WEBHOOK_SECRET'), undefined, Stripe.createSubtleCryptoProvider());
  } catch (err) {
    return new Response(`Signature error: ${(err as Error).message}`, { status: 400 });
  }

  const now = new Date().toISOString();
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const m = s.metadata || {};
        if (m.kind !== 'academy') break;
        let accessUntil: string | null = null;
        let subscriptionId: string | null = null;
        if (s.mode === 'subscription' && s.subscription) {
          subscriptionId = typeof s.subscription === 'string' ? s.subscription : s.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          accessUntil = iso(periodEnd(sub), GRACE_DAYS);
        } else {
          const { data: plan } = await db.from('academy_plans').select('access_days').eq('id', m.plan_id).maybeSingle();
          accessUntil = new Date(Date.now() + (plan?.access_days || 30) * 86400_000).toISOString();
        }
        const { error } = await db.from('academy_enrollments').upsert({
          user_id: m.user_id, program_id: m.program_id, plan_id: m.plan_id, status: 'active', source: 'stripe',
          stripe_customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id || null,
          stripe_subscription_id: subscriptionId, stripe_session_id: s.id, access_until: accessUntil, updated_at: now,
        }, { onConflict: 'user_id,program_id' });
        if (error) throw error;
        if (m.invite_id) {
          const { data: inv } = await db.from('academy_invites').update({ used_at: now, used_by: m.user_id })
            .eq('id', m.invite_id).is('used_at', null).select('inquiry_id').maybeSingle();
          if (inv?.inquiry_id) await db.from('academy_inquiries').update({ status: 'enrolled', updated_at: now }).eq('id', inv.inquiry_id);
        }
        break;
      }

      case 'invoice.paid': {
        // deno-lint-ignore no-explicit-any
        const inv = event.data.object as any;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id || inv.parent?.subscription_details?.subscription;
        if (!subId) break;
        const end = inv.lines?.data?.[0]?.period?.end;
        await db.from('academy_enrollments').update({ status: 'active', access_until: iso(end, GRACE_DAYS), updated_at: now })
          .eq('stripe_subscription_id', subId);
        break;
      }

      case 'invoice.payment_failed': {
        // deno-lint-ignore no-explicit-any
        const inv = event.data.object as any;
        const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id || inv.parent?.subscription_details?.subscription;
        if (subId) await db.from('academy_enrollments').update({ status: 'past_due', updated_at: now }).eq('stripe_subscription_id', subId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === 'canceled' ? 'canceled'
          : ['past_due', 'unpaid', 'incomplete'].includes(sub.status) ? 'past_due' : 'active';
        await db.from('academy_enrollments').update({ status, access_until: iso(periodEnd(sub), GRACE_DAYS), updated_at: now })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await db.from('academy_enrollments')
          .update({ status: 'canceled', access_until: iso(sub.ended_at || Math.floor(Date.now() / 1000)), updated_at: now })
          .eq('stripe_subscription_id', sub.id);
        break;
      }
    }
  } catch (err) {
    console.error('academy-webhook error:', event.type, err);
    return new Response('Handler error', { status: 500 }); // Stripe will retry
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
