// Supabase Edge Function: order-request
// Public. Lets a shopper place an order with a shop that isn't taking cards
// on the site (pays via the shop's Cash App / Venmo / link, or at pickup).
// Records the order, then emails the curator and the shopper (if Resend is set).
// Deploy: supabase functions deploy order-request --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildLines, discountFor, CartError } from '../_shared/cart.ts';
import { sendEmail, layout, itemsTable, money, esc } from '../_shared/email.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const METHODS = ['pickup', 'market', 'ship'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const body = await req.json().catch(() => ({}));
    const { curatorId, items, buyer = {}, method, note, discountCode, trap } = body;

    if (trap) return json({ ok: true }); // bot trap
    if (!buyer.name || String(buyer.name).trim().length < 2 || !EMAIL_RE.test(String(buyer.email || ''))) {
      return json({ error: 'Please add your name and a valid email.' }, 400);
    }
    if (!METHODS.includes(method)) return json({ error: 'Choose how you’d like to receive your order.' }, 400);

    const email = String(buyer.email).trim().toLowerCase();
    const { count } = await admin
      .from('orders').select('id', { count: 'exact', head: true })
      .eq('buyer_email', email).gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if ((count || 0) >= 5) return json({ error: 'You’ve placed several orders just now — please wait a few minutes.' }, 429);

    const { shop, lines, subtotal } = await buildLines(admin, curatorId, items);
    const { data: curator } = await admin
      .from('curator_data')
      .select('id, slug, business_name, status, public_email, cashapp_tag, venmo_handle, stripe_link, other_payment_link, other_payment_label')
      .eq('id', shop).single();
    if (!curator) return json({ error: 'Shop not found.' }, 404);

    const disc = await discountFor(admin, curator.id, discountCode, subtotal);
    const total = subtotal - (disc.ok ? disc.amount_cents : 0);

    const { data: order, error } = await admin.from('orders').insert({
      curator_id: curator.id,
      order_type: 'request',
      payment_status: 'requested',
      fulfillment_status: 'new',
      items: lines,
      product_id: lines[0].product_id,
      product_name: lines.length > 1 ? `${lines[0].name} + ${lines.length - 1} more` : lines[0].name,
      quantity: lines.reduce((s, l) => s + l.quantity, 0),
      amount_subtotal: subtotal,
      amount_total: total,
      discount_code: disc.ok ? disc.code : null,
      discount_amount: disc.ok ? disc.amount_cents : 0,
      buyer_name: String(buyer.name).trim().slice(0, 120),
      buyer_email: email,
      buyer_phone: buyer.phone ? String(buyer.phone).slice(0, 40) : null,
      buyer_note: note ? String(note).slice(0, 1000) : null,
      fulfillment_method: method,
    }).select('id').single();
    if (error) throw error;

    if (disc.ok) await admin.rpc('redeem_discount', { p_curator_id: curator.id, p_code: disc.code });

    // Emails (skipped quietly if Resend isn't configured).
    const { data: owner } = await admin.auth.admin.getUserById(curator.id);
    const curatorEmail = curator.public_email || owner?.user?.email;
    const methodLabel = { pickup: 'Local pickup', market: 'Pick up at the next market', ship: 'Shipping' }[method as string];
    const ref = String(order.id).slice(0, 8).toUpperCase();
    const appUrl = (Deno.env.get('APP_URL') || 'https://p31market.com').replace(/\/$/, '');

    if (curatorEmail) {
      await sendEmail(curatorEmail, `New order request #${ref} — ${money(total)}`, layout('You have a new order', `
<p>${esc(buyer.name)} would like to order from <strong>${esc(curator.business_name)}</strong>.</p>
${itemsTable(lines, disc.ok ? disc.amount_cents : 0, total)}
<p><strong>Delivery:</strong> ${methodLabel}<br><strong>Email:</strong> ${esc(email)}${buyer.phone ? `<br><strong>Phone:</strong> ${esc(buyer.phone)}` : ''}</p>
${note ? `<p><strong>Note:</strong> ${esc(note)}</p>` : ''}
<p><a href="${appUrl}/dashboard/orders" style="display:inline-block;background:#5E2A8C;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Open your orders</a></p>`), email);
    }

    const payWays = [
      curator.cashapp_tag && `Cash App: $${String(curator.cashapp_tag).replace('$', '')}`,
      curator.venmo_handle && `Venmo: @${String(curator.venmo_handle).replace('@', '')}`,
      curator.stripe_link && `Card: <a href="${esc(curator.stripe_link)}">pay online</a>`,
      curator.other_payment_link && `${esc(curator.other_payment_label || 'Other')}: ${esc(curator.other_payment_link)}`,
    ].filter(Boolean);
    await sendEmail(email, `Your order request with ${curator.business_name} (#${ref})`, layout('Order request received', `
<p>Thank you, ${esc(String(buyer.name).split(' ')[0])}! <strong>${esc(curator.business_name)}</strong> has your request and will confirm it shortly.</p>
${itemsTable(lines, disc.ok ? disc.amount_cents : 0, total)}
<p><strong>Delivery:</strong> ${methodLabel}</p>
${payWays.length ? `<p><strong>How to pay</strong><br>${payWays.join('<br>')}</p><p style="color:#6E6580;font-size:13px">Please include #${ref} with your payment.</p>` : ''}`), curatorEmail || undefined);

    return json({ ok: true, orderId: order.id, ref, total });
  } catch (err) {
    if (err instanceof CartError) return json({ error: err.message }, 400);
    console.error('order-request error:', err);
    return json({ error: (err as Error).message || 'Could not place the order.' }, 500);
  }
});
