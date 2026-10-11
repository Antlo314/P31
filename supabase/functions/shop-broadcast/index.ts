// Supabase Edge Function: shop-broadcast
// A vendor emails the people who follow their shop. Sent from the market address with the
// vendor's public email as reply-to; every email carries a one-click unsubscribe for that shop.
// Approved shops only, one send per 24 hours, 500 followers per send.
//   { campaign_id, test?: boolean }   test → one copy to the vendor's own sign-in email
// Deploy: supabase functions deploy shop-broadcast --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, emailConfigured, layout, esc } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const SITE = (env('APP_URL') || 'https://www.p31market.com').replace(/\/$/, '');
const MAX_RECIPIENTS = 500;

// Blank line = paragraph, **bold**, [text](url).
const toHtml = (body: string) => body.split(/\n{2,}/).map((para) => {
  const html = esc(para)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" style="color:#3A1C36">$1</a>')
    .replace(/\n/g, '<br>');
  return `<p style="margin:0 0 14px;line-height:1.6;font-size:15px">${html}</p>`;
}).join('');

const money = (n: number) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'Sign in to your Curator Studio first.' }, 401);

    const { data: shop } = await admin.from('curator_data').select('id, business_name, slug, status, public_email, logo_url').eq('id', user.id).maybeSingle();
    if (!shop) return json({ error: 'Only curators can email their followers.' }, 403);
    if (!emailConfigured()) return json({ error: 'Email isn’t connected yet — the P31 team is setting it up.' });

    // deno-lint-ignore no-explicit-any
    let b: any = {};
    try { b = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
    const { data: c } = await admin.from('shop_campaigns').select('*').eq('id', Number(b.campaign_id)).eq('curator_id', user.id).maybeSingle();
    if (!c) return json({ error: 'Email not found.' }, 404);
    if (!b.test && c.status === 'sent') return json({ error: 'This email was already sent.' });
    if (!b.test && shop.status !== 'approved') return json({ error: 'Your shop opens to the public first — then you can email followers.' });

    // One real send a day keeps the list healthy (tests are free).
    if (!b.test) {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count } = await admin.from('shop_campaigns').select('id', { count: 'exact', head: true })
        .eq('curator_id', user.id).eq('status', 'sent').gte('sent_at', since);
      if ((count || 0) > 0) return json({ error: 'You already emailed your followers today. Try again tomorrow.' });
    }

    // Optional featured product card.
    let product = '';
    if (c.product_id) {
      const { data: p } = await admin.from('products').select('id, name, price, compare_at_price, image_url').eq('id', c.product_id).maybeSingle();
      if (p) {
        const url = `${SITE}/${shop.slug || shop.id}?p=${p.id}`;
        const onSale = Number(p.compare_at_price) > Number(p.price);
        product = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid #DCCBE3;border-radius:14px;overflow:hidden">
<tr>${p.image_url ? `<td width="120" style="vertical-align:top"><a href="${url}"><img src="${esc(p.image_url)}" width="120" height="120" alt="" style="display:block;width:120px;height:120px;object-fit:cover"></a></td>` : ''}
<td style="padding:14px 16px;vertical-align:middle">
<div style="font-weight:bold;font-size:16px;color:#2A1526">${esc(p.name)}</div>
<div style="margin:4px 0 10px;color:#3A1C36;font-weight:bold">${money(p.price)}${onSale ? ` <s style="color:#74657A;font-weight:normal">${money(p.compare_at_price)}</s>` : ''}</div>
<a href="${url}" style="display:inline-block;padding:9px 16px;border-radius:999px;background:#3A1C36;color:#fff;text-decoration:none;font-weight:bold;font-size:13px">Shop it</a>
</td></tr></table>`;
      }
    }

    const shopUrl = `${SITE}/${shop.slug || shop.id}`;
    const body = `${toHtml(String(c.body))}${product}<p style="margin:18px 0 0"><a href="${shopUrl}" style="color:#3A1C36;font-weight:bold">Visit ${esc(shop.business_name)} on P31 →</a></p>`;
    const brand = String(shop.business_name || 'Proverbs 31 Marketplace').toUpperCase();
    const footer = (unsub?: string) =>
      `You asked ${esc(shop.business_name)} for updates on Proverbs 31 Marketplace.${unsub ? ` <a href="${unsub}" style="color:#74657A">Unsubscribe</a>` : ''}`;
    const from = env('EMAIL_FROM') || 'Proverbs 31 Marketplace <vendor@p31market.com>';
    const replyTo = shop.public_email || undefined;

    if (b.test) {
      const r = await sendEmail(user.email!, `[Test] ${c.subject}`, layout(c.subject, body, footer(`${SITE}/unsubscribe`), brand), replyTo, from);
      return (r as { ok?: boolean }).ok ? json({ ok: true, sent: 1, test: true }) : json({ error: 'The test didn’t send. Try again in a minute.' }, 502);
    }

    const { data: subs } = await admin.from('shop_subscribers').select('email, token').eq('curator_id', user.id).eq('unsubscribed', false)
      .order('created_at').limit(MAX_RECIPIENTS);
    if (!subs?.length) return json({ error: 'No followers yet. Share your shop link — the follow box is at the bottom of your storefront.' });

    await admin.from('shop_campaigns').update({ status: 'sending', error: null }).eq('id', c.id);
    let sent = 0;
    const failures: string[] = [];
    for (const s of subs) {
      const r = await sendEmail(s.email, c.subject, layout(c.subject, body, footer(`${SITE}/unsubscribe?s=${s.token}`), brand), replyTo, from);
      if ((r as { ok?: boolean }).ok) sent++; else failures.push(s.email);
      await new Promise((r) => setTimeout(r, 120)); // stay under the Resend rate limit
    }
    await admin.from('shop_campaigns').update({
      status: failures.length && !sent ? 'failed' : 'sent',
      sent_count: sent,
      sent_at: new Date().toISOString(),
      error: failures.length ? `${failures.length} failed` : null,
    }).eq('id', c.id);
    return json({ ok: true, sent, failed: failures.length });
  } catch (err) {
    console.error('shop-broadcast error:', err);
    return json({ error: (err as Error).message || 'Sending failed.' }, 500);
  }
});
