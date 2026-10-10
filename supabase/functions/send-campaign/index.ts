// Supabase Edge Function: send-campaign
// Systems operators only. Sends a campaign to newsletter subscribers,
// curators, or both — or a single test to the sender. Uses Resend; every
// subscriber email carries a one-click unsubscribe link.
//   supabase secrets set RESEND_API_KEY=re_... EMAIL_FROM="P31 Marketplace <hello@p31market.com>"
//   supabase functions deploy send-campaign
// Body: { campaignId, test?: boolean }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, emailConfigured, layout, esc } from '../_shared/email.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Light markdown: blank line = paragraph, **bold**, [text](url).
const toHtml = (body: string) => body.split(/\n{2,}/).map((para) => {
  const html = esc(para)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" style="color:#5E2A8C">$1</a>')
    .replace(/\n/g, '<br>');
  return `<p style="margin:0 0 14px;line-height:1.6;font-size:15px">${html}</p>`;
}).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'Sign in to Systems first.' }, 401);
    const { data: op } = await admin.from('system_operators').select('user_id').eq('user_id', user.id).maybeSingle();
    if (!op) return json({ error: 'Systems access required.' }, 403);
    // Only the Systems team learns whether email is connected.
    if (!emailConfigured()) return json({ error: 'Email isn’t connected yet — add the RESEND_API_KEY secret.' });

    const { campaignId, test } = await req.json();
    const { data: c } = await admin.from('campaigns').select('*').eq('id', campaignId).single();
    if (!c) return json({ error: 'Campaign not found.' }, 404);
    if (!test && c.status === 'sent') return json({ error: 'This campaign was already sent.' });

    const appUrl = (Deno.env.get('APP_URL') || 'https://p31market.com').replace(/\/$/, '');
    const body = toHtml(c.body);
    const footer = (unsubUrl?: string) =>
      `You’re receiving this from Proverbs 31 Marketplace · Atlanta, GA.${unsubUrl ? ` <a href="${unsubUrl}" style="color:#6E6580">Unsubscribe</a>` : ''}`;

    if (test) {
      await sendEmail(user.email!, `[Test] ${c.subject}`, layout(c.subject, body, footer(`${appUrl}/unsubscribe`)));
      return json({ ok: true, sent: 1, test: true });
    }

    // Build the recipient list (deduplicated, unsubscribes removed).
    const recipients = new Map<string, string | null>(); // email → unsubscribe token
    if (c.audience === 'subscribers' || c.audience === 'everyone') {
      const { data: leads } = await admin.from('leads').select('email, unsubscribe_token, unsubscribed').limit(20000);
      (leads || []).filter((l) => !l.unsubscribed && l.email).forEach((l) => recipients.set(l.email.toLowerCase(), l.unsubscribe_token));
    }
    if (c.audience === 'curators' || c.audience === 'everyone') {
      const { data: curators } = await admin.from('curator_data').select('id');
      for (const cur of curators || []) {
        const { data: u } = await admin.auth.admin.getUserById(cur.id);
        const email = u?.user?.email?.toLowerCase();
        if (email && !email.endsWith('@systems.p31market.com') && !recipients.has(email)) recipients.set(email, null);
      }
    }

    await admin.from('campaigns').update({ status: 'sending', error: null }).eq('id', c.id);

    let sent = 0;
    const failures: string[] = [];
    for (const [email, unsub] of recipients) {
      const unsubUrl = unsub ? `${appUrl}/unsubscribe?t=${unsub}` : undefined;
      const res = await sendEmail(email, c.subject, layout(c.subject, body, footer(unsubUrl)));
      if ((res as { ok?: boolean }).ok) sent++; else failures.push(email);
      await new Promise((r) => setTimeout(r, 120)); // stay under Resend's rate limit
    }

    await admin.from('campaigns').update({
      status: failures.length && !sent ? 'failed' : 'sent',
      sent_count: sent,
      sent_at: new Date().toISOString(),
      error: failures.length ? `${failures.length} failed` : null,
    }).eq('id', c.id);

    return json({ ok: true, sent, failed: failures.length });
  } catch (err) {
    console.error('send-campaign error:', err);
    return json({ error: (err as Error).message || 'Sending failed.' }, 500);
  }
});
