// Supabase Edge Function: academy-webhook
// Keeps mentorship enrollments in step with the Collective's Stripe account (see _shared/stripe.ts).
//   supabase secrets set COLLECTIVE_STRIPE_SECRET_KEY=sk_...  COLLECTIVE_STRIPE_WEBHOOK_SECRET=whsec_...
//   (the older STRIPE_SECRET_KEY / ACADEMY_STRIPE_WEBHOOK_SECRET still work)
//   supabase functions deploy academy-webhook          (verify_jwt = false in config.toml)
// Stripe → Developers → Webhooks → endpoint https://<project>.supabase.co/functions/v1/academy-webhook
// Events: checkout.session.completed, invoice.paid, invoice.payment_failed,
//         customer.subscription.updated, customer.subscription.deleted
// Storefront subscriptions are the Market's (stripe-webhook); they are handled here too only when one
// Stripe account serves both sites.
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { stripeFor, webhookSecrets, verifyEvent } from '../_shared/stripe.ts';
import { storefrontEvent } from '../_shared/storefront-billing.ts';
import { sendEmail, layout, esc } from '../_shared/email.ts';

const SITE = 'https://www.thep31collective.org';
const SESSIONS = 'https://calendly.com/purposefullydriven7/privatementorship';
const MEMBERS = 'members@thep31collective.org';
const teamTo = () => [...new Set([...(Deno.env.get('INTRO_NOTIFY_TO') || `${MEMBERS},founder@thep31collective.org`).split(',').map((s) => s.trim()).filter(Boolean), 'ceo@p31market.com'])];
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

const GRACE_DAYS = 3; // renewals can land a little after the period ends
const env = (k: string) => Deno.env.get(k) || '';
const iso = (unixSeconds?: number | null, plusDays = 0) =>
  unixSeconds ? new Date(unixSeconds * 1000 + plusDays * 86400_000).toISOString() : null;
// deno-lint-ignore no-explicit-any
const periodEnd = (sub: any) => sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const stripe = stripeFor('collective');
  if (!stripe || !webhookSecrets('collective').length) {
    console.error('academy-webhook: missing COLLECTIVE_STRIPE_SECRET_KEY or COLLECTIVE_STRIPE_WEBHOOK_SECRET');
    return new Response('Not configured', { status: 500 });
  }
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  const raw = await req.text();
  const { event, error: sigError } = await verifyEvent(stripe, 'collective', raw, req.headers.get('stripe-signature') || '');
  if (!event) return new Response(`Signature error: ${sigError}`, { status: 400 });

  const now = new Date().toISOString();
  try {
    // When one Stripe account serves both sites, storefront subscriptions arrive here too.
    if (!Deno.env.get('MARKET_STRIPE_SECRET_KEY')) await storefrontEvent(stripe, db, event);
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
          // Workflow steps 8 and 9: the intake is enrolled; confirmation, receipt and onboarding to her, a note to the team.
          await db.from('coaching_intakes').update({ status: 'enrolled', enrolled_at: now }).eq('invite_id', m.invite_id);
        }
        try {
          const [{ data: prog }, { data: plan }, { data: profile }] = await Promise.all([
            db.from('academy_programs').select('title, slug').eq('id', m.program_id).maybeSingle(),
            db.from('academy_plans').select('label, price_cents, billing').eq('id', m.plan_id).maybeSingle(),
            db.from('profiles').select('full_name').eq('id', m.user_id).maybeSingle(),
          ]);
          const email = s.customer_details?.email || '';
          const name = profile?.full_name || s.customer_details?.name || '';
          const first = String(name).split(' ')[0] || 'there';
          const paid = money(s.amount_total ?? plan?.price_cents ?? 0);
          const classroom = `${SITE}/academy/${prog?.slug || 'business'}`;
          if (email) {
            await sendEmail(email, `Welcome to the ${prog?.title || 'P31 Collective'}: you are enrolled`, layout('You are enrolled', `<p>Hi ${esc(first)},</p>
<p>Your enrollment in the <b>${esc(prog?.title || 'program')}</b> is confirmed. Welcome.</p>
<p style="margin:12px 0 4px"><b>Your plan</b></p>
<p style="margin:0 0 12px">${esc(plan?.label || '')}<br>${paid} paid today${plan?.billing === 'month' ? ', then monthly on this date' : ''}. Stripe sends your card receipt separately.</p>
<p style="margin:16px 0 4px"><b>Your first steps</b></p>
<ol style="margin:6px 0 14px;padding-left:20px;line-height:1.6">
<li><b>Open your classroom:</b> your sessions, lessons, notes and messages with your mentor live there.</li>
<li><b>Book your first session</b> with Melanie JC on the calendar below.</li>
<li><b>Join the community:</b> The Gathering, the members' chat, is in your portal, with your P31 Collective member benefits and P31 vendor savings.</li>
</ol>
<p><a href="${classroom}" style="display:inline-block;background:#3A1C36;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Open my classroom</a>&nbsp;
<a href="${SESSIONS}" style="display:inline-block;background:#D9A93A;color:#21101E;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Book my first session</a></p>
<p>Questions? Reply to this email or write to founder@thep31collective.org.</p>`, 'thep31collective.org · The P31 Collective by NEBA', 'THE PROVERBS 31 COLLECTIVE'), 'founder@thep31collective.org');
          }
          await sendEmail(teamTo(), `New enrollment: ${name || email} (${prog?.title || 'program'}, ${plan?.label || ''})`, layout('New enrollment', `<p><b>${esc(name || email)}</b> (${esc(email)}) paid ${paid} and is enrolled in the <b>${esc(prog?.title || '')}</b>.</p>
<p>Plan: ${esc(plan?.label || '')}</p><p>She has been sent her welcome email with the classroom link and the session calendar. Next: her first session.</p>
<p><a href="${SITE}/academy/${prog?.slug || 'business'}/teach/agreements" style="color:#3A1C36">Open in the mentor console</a></p>`, 'thep31collective.org · The P31 Collective by NEBA', 'THE PROVERBS 31 COLLECTIVE'), email || undefined);
        } catch (e) { console.error('academy-webhook enrollment emails', e); }
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
        if (subId) {
          await db.from('academy_enrollments').update({ status: 'past_due', updated_at: now }).eq('stripe_subscription_id', subId);
        }
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
