// Supabase Edge Function: digital-download
// Hands a buyer the PDF they paid for (v67). Deploy with --no-verify-jwt (links are opened from emails).
//   GET  ?o=<order id>&p=<product id>   -> redirects to a 10-minute signed link for that file,
//                                          only while the order is paid (or a confirmed request).
//   POST { session_id }                 -> the paid order's downloads, for the "thank you" banner.
//   POST { action: 'resend', orderId }  -> the shop owner (or a site admin) emails the buyer the links again.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { DIGITAL_BUCKET, orderUnlocked, digitalItems, emailDownloads } from '../_shared/digital.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHOP = (Deno.env.get('APP_URL') || 'https://p31market.com').replace(/\/$/, '');

// A plain message for a link that cannot be used. (Supabase serves function HTML as plain text,
// so this is written as readable text rather than a web page.)
const page = (title: string, text: string, status = 400) => new Response(
  `${title}

${text}

P31 Marketplace: ${SHOP}
`,
  { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const ORDER_COLS = 'id, curator_id, items, product_id, order_type, payment_status, fulfillment_status, buyer_email';

  try {
    if (req.method === 'GET') {
      const u = new URL(req.url);
      const orderId = u.searchParams.get('o') || '';
      const productId = Number(u.searchParams.get('p'));
      if (!UUID.test(orderId) || !Number.isFinite(productId)) return page('Link not recognised', 'This download link is incomplete. Please use the button in your order email.');
      const { data: order } = await admin.from('orders').select(ORDER_COLS).eq('id', orderId).maybeSingle();
      if (!order) return page('Order not found', 'We could not find this order. Please use the button in your order email.', 404);
      if (!orderUnlocked(order)) return page('Not ready yet', order.fulfillment_status === 'cancelled'
        ? 'This order was cancelled, so its download is closed.'
        : 'The payment for this order has not come through yet. Try again in a few minutes.', 403);
      const item = (await digitalItems(admin, order)).find((d) => d.product_id === productId);
      if (!item) return page('File not found', 'This order does not include a download for that item. If you think that is wrong, reply to your order email.', 404);
      const { data, error } = await admin.storage.from(DIGITAL_BUCKET).createSignedUrl(item.path, 600, { download: item.file_name });
      if (error || !data?.signedUrl) return page('Download not available', 'The shop is updating this file. Please try again later or reply to your order email.', 404);
      return new Response(null, { status: 302, headers: { Location: data.signedUrl, 'Cache-Control': 'no-store' } });
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const body = await req.json().catch(() => ({}));

    // Shop owner (or site admin): email the buyer their links again.
    if (body.action === 'resend') {
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: who } = await admin.auth.getUser(token);
      if (!who?.user) return json({ error: 'Please sign in again.' }, 401);
      if (!UUID.test(String(body.orderId || ''))) return json({ error: 'Order not found.' }, 404);
      const { data: order } = await admin.from('orders').select(ORDER_COLS).eq('id', body.orderId).maybeSingle();
      if (!order) return json({ error: 'Order not found.' }, 404);
      if (order.curator_id !== who.user.id) {
        const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
        });
        const { data: isAdmin } = await asUser.rpc('is_academy_admin');
        if (!isAdmin) return json({ error: 'This is not your order.' }, 403);
      }
      if (!orderUnlocked(order)) return json({ error: order.order_type === 'request' ? 'Confirm the order first; the buyer then gets the download.' : 'This order is not paid, so the download stays closed.' }, 400);
      if (!order.buyer_email) return json({ error: 'This order has no buyer email.' }, 400);
      const { data: shop } = await admin.from('curator_data').select('business_name, public_email').eq('id', order.curator_id).maybeSingle();
      const r = await emailDownloads(admin, order, shop?.business_name || 'P31 Marketplace', shop?.public_email || undefined);
      if (!r.count) return json({ error: 'This order has no PDF products.' }, 400);
      return json({ ok: true, sentTo: order.buyer_email });
    }

    // The thank-you banner after checkout: the Stripe session id stands in for the order.
    const sid = String(body.session_id || '');
    if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sid)) return json({ items: [] });
    const { data: order } = await admin.from('orders').select(ORDER_COLS).eq('stripe_session_id', sid).maybeSingle();
    if (!order) return json({ items: [], pending: true });
    const items = await digitalItems(admin, order);
    if (!items.length) return json({ items: [] });
    if (!orderUnlocked(order)) return json({ items: [], pending: true });
    return json({ items: items.map((d) => ({ product_id: d.product_id, name: d.name, url: d.url })) });
  } catch (err) {
    console.error('digital-download error:', err);
    return req.method === 'GET'
      ? page('Something went wrong', 'Please try the link again in a minute.', 500)
      : json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
