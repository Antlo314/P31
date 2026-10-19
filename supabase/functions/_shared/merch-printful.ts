// Printful for P31 merch: the API, where each design sits in Printful's print area, and placing a paid
// order. Used by the merch function (status, photos, shipping updates) and stripe-webhook (paid orders).
//   Secret: PRINTFUL_API_KEY (a private token for the P31 Market store: orders, products, files, webhooks)
//   Optional: PRINTFUL_DRAFT_ORDERS=true keeps new orders as drafts to confirm by hand in Printful.
//             MERCH_NOTIFY_TO (comma-separated) for the team email; default vendor@ and ceo@.
import { sendEmail, layout, esc } from './email.ts';
import { TYPES, itemById, itemName, printFile, variantFor, money, SITE } from './merch-catalog.js';

const env = (k: string) => Deno.env.get(k) || '';
const API = 'https://api.printful.com';
// deno-lint-ignore no-explicit-any
type Any = any;

export const printfulReady = () => !!env('PRINTFUL_API_KEY');

export async function pf(path: string, init: RequestInit = {}): Promise<Any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env('PRINTFUL_API_KEY')}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Printful ${res.status}: ${body?.error?.message || body?.result || res.statusText}`);
  return body.result;
}

// Print areas, per Printful product: placement -> { width, height } in the printfile's pixels.
const areaCache = new Map<number, Record<string, { width: number; height: number }>>();
const groupCache = new Map<number, string[]>();
/** The photo styles Printful offers for a product ("Women's", "Lifestyle", "Flat" and so on). */
export async function photoGroups(productId: number) {
  if (!groupCache.has(productId)) await printAreas(productId);
  return groupCache.get(productId) || [];
}
export async function printAreas(productId: number) {
  if (areaCache.has(productId)) return areaCache.get(productId)!;
  const r = await pf(`/mockup-generator/printfiles/${productId}`);
  groupCache.set(productId, Array.isArray(r.option_groups) ? r.option_groups : []);
  const byId = Object.fromEntries((r.printfiles || []).map((p: Any) => [p.printfile_id, { width: p.width, height: p.height }]));
  const areas: Record<string, { width: number; height: number }> = {};
  for (const v of r.variant_printfiles || []) for (const [placement, id] of Object.entries(v.placements || {})) areas[placement] ||= byId[id as number];
  areaCache.set(productId, areas);
  return areas;
}

/** Where the art sits: chest prints near the top and 80% wide; journals on the front cover of the wrap; mugs, stickers and hats fill and centre. */
export function position(type: string, area: { width: number; height: number }, art: { width: number; height: number }) {
  const ratio = art.height / art.width;
  let width: number; let height: number; let top: number;
  // Journals print on a full wrap (back, spine, front): the art belongs on the right half, the front cover,
  // inside a small margin so the trim and the hinge never cut it.
  if (type === 'journal' && area.width > area.height) {
    const half = area.width / 2; const pad = Math.round(area.height * 0.06);
    width = half - pad * 2; height = width * ratio;
    if (height > area.height - pad * 2) { height = area.height - pad * 2; width = height / ratio; }
    return { area_width: area.width, area_height: area.height, width: Math.round(width), height: Math.round(height), top: Math.round((area.height - height) / 2), left: Math.round(half + (half - width) / 2) };
  }
  if (['tee', 'crew', 'hoodie', 'tote'].includes(type)) {
    width = area.width * (type === 'hoodie' ? 0.7 : 0.8);
    height = width * ratio;
    const maxH = area.height * (type === 'hoodie' ? 0.5 : 0.62);
    if (height > maxH) { height = maxH; width = height / ratio; }
    top = area.height * (type === 'tote' ? 0.12 : 0.05);
  } else {
    width = area.width; height = width * ratio;
    if (height > area.height) { height = area.height; width = height / ratio; }
    top = (area.height - height) / 2;
  }
  return { area_width: area.width, area_height: area.height, width: Math.round(width), height: Math.round(height), top: Math.round(top), left: Math.round((area.width - width) / 2) };
}

/** The Printful file entry (and embroidery options) for one item in one colour. */
export async function fileFor(itemId: string, color: string) {
  const item = itemById(itemId);
  if (!item) throw new Error(`Unknown item ${itemId}`);
  const t = TYPES[item.type as keyof typeof TYPES];
  const f = printFile(item, color);
  if (!f) throw new Error(`No print file for ${itemId} in ${color}`);
  const areas = await printAreas(t.printful);
  const area = areas[t.placement];
  const file: Any = { type: t.placement, url: f.url };
  if (area) file.position = position(item.type, area, f);
  const options = f.threads ? [{ id: 'embroidery_type', value: 'flat' }, { id: 'thread_colors', value: f.threads }] : undefined;
  return { item, type: t, file, options };
}

const notifyTo = () => (env('MERCH_NOTIFY_TO') || 'vendor@p31market.com,ceo@p31market.com').split(',').map((s) => s.trim()).filter(Boolean);
const FOOT = 'p31market.com · Where her gifts make room.';
const itemsTable = (items: Any[]) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eee;font-size:14px">${items.map((l: Any) =>
  `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(l.name)}<br><span style="color:#74657A;font-size:12px">${esc(l.color)}${l.size && l.size !== 'One size' ? ` · ${esc(l.size)}` : ''} · qty ${l.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${money(l.price_cents * l.quantity)}</td></tr>`).join('')}</table>`;

/**
 * A merch checkout was paid: record it, place the order with Printful, email the shopper and the team.
 * Safe to call twice for the same session (the second call finds the order already handled).
 */
export async function placeMerchOrder(db: Any, session: Any) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;
  const { data: order } = await db.from('merch_orders').select('*').eq('id', orderId).maybeSingle();
  if (!order || order.status !== 'checkout') return;
  const ship = session.collected_information?.shipping_details || session.shipping_details || {};
  const addr = ship.address || {};
  const email = session.customer_details?.email || order.email;
  const name = ship.name || session.customer_details?.name || '';
  const total = session.amount_total ?? order.total_cents;
  const shippingCents = session.total_details?.amount_shipping ?? order.shipping_cents;
  await db.from('merch_orders').update({
    status: 'paid', paid_at: new Date().toISOString(), email, name, total_cents: total, shipping_cents: shippingCents,
    shipping: { name, ...addr, phone: session.customer_details?.phone || null },
  }).eq('id', order.id).eq('status', 'checkout');

  let status = 'paid'; let printfulId: string | null = null; let error: string | null = null;
  if (!printfulReady()) {
    error = 'Printful is not connected (PRINTFUL_API_KEY), so this order was not sent. Place it by hand in Printful.';
  } else {
    try {
      const items = [];
      for (const l of order.items) {
        const { item, file, options } = await fileFor(l.item, l.color);
        const variant = variantFor(item, l.color, l.size);
        if (!variant) throw new Error(`No Printful variant for ${l.item} ${l.color} ${l.size}`);
        items.push({ variant_id: variant, quantity: l.quantity, retail_price: (l.price_cents / 100).toFixed(2), name: itemName(item), files: [file], ...(options ? { options } : {}) });
      }
      const draft = env('PRINTFUL_DRAFT_ORDERS') === 'true';
      const created = await pf(`/orders${draft ? '' : '?confirm=true'}`, {
        method: 'POST',
        body: JSON.stringify({
          external_id: order.ref,
          shipping: 'STANDARD',
          recipient: { name, address1: addr.line1, address2: addr.line2 || undefined, city: addr.city, state_code: addr.state, country_code: addr.country || 'US', zip: addr.postal_code, email, phone: session.customer_details?.phone || undefined },
          items,
          retail_costs: { shipping: (shippingCents / 100).toFixed(2) },
        }),
      });
      printfulId = String(created.id);
      status = draft ? 'paid' : 'sent';
      if (draft) error = 'Saved in Printful as a draft: confirm it there to start printing.';
    } catch (e) {
      status = 'failed'; error = (e as Error).message;
    }
  }
  await db.from('merch_orders').update({ status, printful_order_id: printfulId, error, sent_at: status === 'sent' ? new Date().toISOString() : null, notified_at: new Date().toISOString() }).eq('id', order.id);

  const list = itemsTable(order.items);
  const totals = `<p style="margin:10px 0 0;text-align:right;font-size:14px">Shipping ${shippingCents ? money(shippingCents) : 'free'}<br><b>Total ${money(total)}</b></p>`;
  if (email) {
    await sendEmail(email, `Your P31 merch order (#${order.ref})`, layout('Thank you for your order', `<p>Hi ${esc(String(name).split(' ')[0] || 'there')},</p>
<p>Thank you for supporting the Proverbs 31 Marketplace. Your order <b>#${esc(order.ref)}</b> is in.</p>${list}${totals}
<p style="margin-top:16px">Each piece is printed for you. Most orders ship in 2 to 7 business days; you will get a tracking email as soon as yours is on its way.</p>
<p>Questions? Reply to this email.</p>`, FOOT), 'vendor@p31market.com').catch((e) => console.error('merch shopper email', e));
  }
  await sendEmail(notifyTo(), `${status === 'failed' ? 'ACTION NEEDED: ' : ''}Merch order #${order.ref}: ${money(total)} (${esc(name)})`, layout(`Merch order #${order.ref}`, `<p><b>${esc(name)}</b> (${esc(email || '')}) paid ${money(total)} for P31 merch.</p>${list}${totals}
<p style="margin-top:14px">${status === 'sent' ? `Sent to Printful (order ${esc(printfulId || '')}). Printful prints, ships and sends tracking.` : `<span style="color:#9a2f2f"><b>${esc(error || 'Not sent to Printful.')}</b></span>`}</p>
<p style="font-size:13px;color:#74657A">Ship to: ${esc([name, addr.line1, addr.line2, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', '))}</p>`, FOOT), email || undefined).catch((e) => console.error('merch team email', e));
}

/** Printful says an order shipped (or failed): check it with Printful itself, then update and email. */
export async function printfulEvent(db: Any, body: Any) {
  const externalId = body?.data?.order?.external_id;
  if (!externalId || !printfulReady()) return { ok: true };
  const live = await pf(`/orders/@${encodeURIComponent(externalId)}`); // trust Printful's record, not the message
  const { data: order } = await db.from('merch_orders').select('*').eq('ref', externalId).maybeSingle();
  if (!order) return { ok: true };
  if (body.type === 'package_shipped') {
    const s = (live.shipments || []).at(-1) || body.data.shipment || {};
    if (order.status === 'shipped') return { ok: true };
    await db.from('merch_orders').update({ status: 'shipped', shipped_at: new Date().toISOString(), tracking: { carrier: s.carrier, number: s.tracking_number, url: s.tracking_url } }).eq('id', order.id);
    if (order.email) {
      await sendEmail(order.email, `Your P31 merch is on its way (#${order.ref})`, layout('Your order has shipped', `<p>Hi ${esc(String(order.name || '').split(' ')[0] || 'there')},</p>
<p>Good news: your P31 merch order <b>#${esc(order.ref)}</b> is on its way${s.carrier ? ` with ${esc(s.carrier)}` : ''}.</p>
${s.tracking_url ? `<p><a href="${esc(s.tracking_url)}" style="display:inline-block;background:#3A1C36;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Track my package</a></p>` : ''}
${s.tracking_number ? `<p style="font-size:13px;color:#74657A">Tracking number ${esc(s.tracking_number)}</p>` : ''}
<p>Thank you for wearing the message. Questions? Reply to this email.</p>`, FOOT), 'vendor@p31market.com').catch((e) => console.error('merch shipped email', e));
    }
  } else if (['order_failed', 'order_canceled', 'order_put_hold'].includes(body.type)) {
    const status = body.type === 'order_canceled' ? 'cancelled' : 'failed';
    const reason = body.data?.reason || live.status || body.type;
    await db.from('merch_orders').update({ status, error: `Printful: ${reason}` }).eq('id', order.id);
    await sendEmail(notifyTo(), `ACTION NEEDED: merch order #${order.ref} ${body.type.replace('order_', '').replace('_', ' ')}`, layout(`Merch order #${order.ref}`, `<p>Printful reports <b>${esc(body.type)}</b> for order #${esc(order.ref)} (${esc(order.name || '')}).</p><p>${esc(String(reason))}</p><p>Open the order in Printful to fix or refund it.</p>`, FOOT)).catch(() => {});
  }
  return { ok: true };
}

export const MERCH_WEBHOOK_URL = () => `${env('SUPABASE_URL')}/functions/v1/merch?printful=1`;
export { SITE };
