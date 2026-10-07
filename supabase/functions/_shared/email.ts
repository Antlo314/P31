// Shared email sender for Edge Functions (Resend — https://resend.com).
// Optional: with no RESEND_API_KEY set, emails are skipped and logged, and
// everything else keeps working.
//   supabase secrets set RESEND_API_KEY=re_... EMAIL_FROM="P31 Marketplace <hello@p31market.com>"

export const emailConfigured = () => !!Deno.env.get('RESEND_API_KEY');

export async function sendEmail(to: string | string[], subject: string, html: string, replyTo?: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.log(`[email skipped — no RESEND_API_KEY] ${subject} → ${to}`);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') || 'P31 Marketplace <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Resend error', res.status, text.slice(0, 300));
    return { error: text };
  }
  return { ok: true };
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

type Item = { name: string; quantity: number; price_cents: number; options?: Record<string, string> };

// Branded, email-client-safe layout.
export function layout(title: string, body: string, footer = '') {
  return `<!doctype html><html><body style="margin:0;background:#f5f1fb;font-family:Arial,Helvetica,sans-serif;color:#201431">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:#2a1544;padding:22px 24px;color:#F2CE4D;font-size:12px;letter-spacing:3px;font-weight:bold">PROVERBS 31 MARKETPLACE</td></tr>
<tr><td style="padding:26px 24px">
<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-weight:normal;color:#5E2A8C;font-size:24px">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 24px;background:#f5f1fb;color:#6E6580;font-size:12px">${footer || 'p31market.com · Where her gifts make room.'}</td></tr>
</table></td></tr></table></body></html>`;
}

export function itemsTable(items: Item[], discountCents = 0, totalCents?: number) {
  const rows = items.map((i) => {
    const opts = i.options && Object.keys(i.options).length
      ? `<br><span style="color:#6E6580;font-size:12px">${esc(Object.entries(i.options).map(([k, v]) => `${k}: ${v}`).join(' · '))}</span>` : '';
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.name)} × ${i.quantity}${opts}</td>
<td align="right" style="padding:8px 0;border-bottom:1px solid #eee">${money(i.price_cents * i.quantity)}</td></tr>`;
  }).join('');
  const sub = items.reduce((s, i) => s + i.price_cents * i.quantity, 0);
  const total = totalCents ?? sub - discountCents;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
${discountCents ? `<tr><td style="padding:8px 0;color:#17603C">Discount</td><td align="right" style="color:#17603C">−${money(discountCents)}</td></tr>` : ''}
<tr><td style="padding:10px 0;font-weight:bold">Total</td><td align="right" style="font-weight:bold">${money(total)}</td></tr></table>`;
}

export { esc };
