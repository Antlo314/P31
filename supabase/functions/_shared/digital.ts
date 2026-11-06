// Digital products: a PDF a shop owner attaches to a product (v67). The file sits in the
// private bucket digital-products; a buyer reaches it only through the digital-download
// function, which checks the order is paid before handing out a short-lived signed link.
// deno-lint-ignore-file no-explicit-any
import { sendEmail, layout, esc } from './email.ts';

export const DIGITAL_BUCKET = 'digital-products';

/** The link a buyer keeps: it opens a fresh download each time it is used. */
export const downloadLink = (orderId: string, productId: number | string) =>
  `${(Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')}/functions/v1/digital-download?o=${encodeURIComponent(orderId)}&p=${encodeURIComponent(String(productId))}`;

/** May this order's buyer download its files? Paid card orders, or requests the shop confirmed. */
export const orderUnlocked = (o: any) => !!o && o.fulfillment_status !== 'cancelled' && (
  o.order_type === 'request' ? ['confirmed', 'fulfilled'].includes(o.fulfillment_status) : o.payment_status === 'paid'
);

/** The digital products in an order (by its line items), with their file details. */
export async function digitalItems(admin: any, order: any) {
  const lines = Array.isArray(order?.items) ? order.items : [];
  const ids = [...new Set(lines.map((l: any) => Number(l.product_id)).filter(Number.isFinite))];
  if (!ids.length && order?.product_id) ids.push(Number(order.product_id));
  if (!ids.length) return [];
  const { data } = await admin.from('products')
    .select('id, name, digital_file_path, digital_file_name')
    .in('id', ids).not('digital_file_path', 'is', null);
  return (data || []).map((p: any) => ({
    product_id: p.id,
    name: p.name,
    file_name: p.digital_file_name || `${p.name}.pdf`,
    path: p.digital_file_path as string,
    url: downloadLink(order.id, p.id),
  }));
}

/** Download buttons for an email. */
export const downloadButtons = (items: { name: string; url: string }[]) => items.length ? `
<p style="margin:18px 0 6px"><strong>Your download${items.length > 1 ? 's' : ''}</strong></p>
${items.map((d) => `<p style="margin:8px 0"><a href="${d.url}" style="display:inline-block;background:#3A1C36;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Download ${esc(d.name)} (PDF)</a></p>`).join('')}
<p style="color:#74657A;font-size:13px">Keep this email: the button works whenever you need the file again.</p>` : '';

/** Emails the buyer their download links (used for a resend from the shop's Orders screen). */
export async function emailDownloads(admin: any, order: any, shopName: string, replyTo?: string) {
  const items = await digitalItems(admin, order);
  if (!items.length || !order?.buyer_email) return { sent: false, count: items.length };
  const ref = String(order.id).slice(0, 8).toUpperCase();
  await sendEmail(order.buyer_email, `Your download from ${shopName} (#${ref})`, layout('Your download is ready', `
<p>Thank you for your order from <strong>${esc(shopName)}</strong>.</p>${downloadButtons(items)}`), replyTo);
  return { sent: true, count: items.length };
}
