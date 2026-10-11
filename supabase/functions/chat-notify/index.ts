// Supabase Edge Function: chat-notify
// Direct messages in The Gathering that went unread for a few minutes become one email to the
// recipient: who wrote, the newest lines, and a link back to the conversation on the site she
// signs in to. One email per conversation per 30 minutes at most; nothing if she read it first
// or turned the emails off (chat_prefs). The scheduler (v40) calls this every 5 minutes.
// Secrets: RESEND_API_KEY, EMAIL_FROM (or COLLECTIVE_EMAIL_FROM)
// Deploy: supabase functions deploy chat-notify --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const WAIT_MIN = 3;          // minutes a message sits unread before it is emailed
const THROTTLE_MIN = 30;     // at most one email per conversation in this window
const LOOKBACK_H = 48;       // older messages are left alone

const when = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const snippet = (m: Row) => {
  const text = (m.body || '').replace(/\*\*?/g, '').trim();
  const media = (m.attachments || []).length ? ` ${(m.attachments || []).length === 1 ? (m.attachments[0].type === 'video' ? '[a video]' : '[a photo]') : `[${m.attachments.length} photos or videos]`}` : '';
  return `${text.slice(0, 220)}${text.length > 220 ? '…' : ''}${media}`.trim() || '(a message)';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!emailConfigured()) return json({ ok: false, waiting: 'email' });
  // deno-lint-ignore no-explicit-any
  const db: any = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const from = env('COLLECTIVE_EMAIL_FROM') || env('EMAIL_FROM') || undefined;

  // Direct messages that have waited long enough and nobody has handled.
  const until = new Date(Date.now() - WAIT_MIN * 60e3).toISOString();
  const since = new Date(Date.now() - LOOKBACK_H * 3600e3).toISOString();
  const { data: pending, error } = await db.from('chat_messages')
    .select('id, channel_id, author_id, body, attachments, created_at, chat_channels!inner(kind, slug)')
    .is('notified_at', null).is('thread_root', null).is('deleted_at', null).eq('kind', 'message')
    .eq('chat_channels.kind', 'dm').lt('created_at', until).gt('created_at', since)
    .order('created_at', { ascending: true }).limit(400);
  if (error) return json({ error: error.message }, 500);
  if (!pending?.length) return json({ ok: true, emailed: 0 });

  // Group by conversation.
  const byChannel = new Map<string, Row[]>();
  for (const m of pending) { if (!byChannel.has(m.channel_id)) byChannel.set(m.channel_id, []); byChannel.get(m.channel_id)!.push(m); }
  const channelIds = [...byChannel.keys()];
  const { data: members } = await db.from('chat_channel_members').select('channel_id, user_id').in('channel_id', channelIds);
  const result = { emailed: 0, read: 0, muted: 0, throttled: 0, skipped: 0 };
  const markDone = (ids: string[]) => db.from('chat_messages').update({ notified_at: new Date().toISOString() }).in('id', ids);

  for (const [channelId, msgs] of byChannel) {
    const ids = msgs.map((m) => m.id);
    const authors = new Set(msgs.map((m) => m.author_id));
    const people = (members || []).filter((x: Row) => x.channel_id === channelId).map((x: Row) => x.user_id);
    // The recipient is the member who did not write these (a two-person conversation).
    const recipient = people.find((id: string) => !authors.has(id));
    if (!recipient) { await markDone(ids); result.skipped += 1; continue; }

    const newest = msgs[msgs.length - 1].created_at;
    const [{ data: read }, { data: pref }, { data: notice }] = await Promise.all([
      db.from('chat_reads').select('last_read_at').eq('user_id', recipient).eq('channel_id', channelId).maybeSingle(),
      db.from('chat_prefs').select('dm_email').eq('user_id', recipient).maybeSingle(),
      db.from('chat_dm_notices').select('sent_at').eq('user_id', recipient).eq('channel_id', channelId).order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (read?.last_read_at && read.last_read_at >= newest) { await markDone(ids); result.read += 1; continue; }
    if (pref && pref.dm_email === false) { await markDone(ids); result.muted += 1; continue; }
    if (notice?.sent_at && Date.now() - new Date(notice.sent_at).getTime() < THROTTLE_MIN * 60e3) { result.throttled += 1; continue; } // try again later

    // Who wrote, who receives, and which site she signs in on.
    const authorId = msgs[msgs.length - 1].author_id;
    const [{ data: profile }, { data: shop }, { data: user }, { data: rCurator }, { data: rStudent }, { data: rMentor }] = await Promise.all([
      db.from('profiles').select('full_name').eq('id', authorId).maybeSingle(),
      db.from('curator_data').select('business_name').eq('id', authorId).maybeSingle(),
      db.auth.admin.getUserById(recipient),
      db.from('curator_data').select('id').eq('id', recipient).maybeSingle(),
      db.from('academy_enrollments').select('id').eq('user_id', recipient).limit(1),
      db.from('academy_mentors').select('user_id').eq('user_id', recipient).limit(1),
    ]);
    const email = user?.user?.email;
    if (!email) { await markDone(ids); result.skipped += 1; continue; }
    const sender = (profile?.full_name || shop?.business_name || 'A P31 member').trim();
    const first = sender.split(' ')[0];
    const vendorOnly = !!rCurator && !(rStudent?.length) && !(rMentor?.length);
    const site = vendorOnly ? 'https://www.p31market.com' : 'https://www.thep31collective.org';
    const link = `${site}/gather/${msgs[0].chat_channels.slug}`;
    const recent = msgs.slice(-3);
    const lines = recent.map((m) => `<li style="margin:0 0 8px"><span style="color:#74657A;font-size:12px">${esc(when(m.created_at))}</span><br>${esc(snippet(m))}</li>`).join('');
    const count = msgs.length;
    const subject = count === 1 ? `${sender} sent you a message in The Gathering` : `${sender} sent you ${count} messages in The Gathering`;
    const html = layout(`A message from ${sender}`, `<p style="margin:0 0 14px;font-size:15px;line-height:1.5">${esc(first)} wrote to you privately in The Gathering${count > 3 ? ` (${count} messages; the newest three are here)` : ''}:</p>
<ul style="margin:0 0 18px;padding-left:18px;line-height:1.5;color:#2A1526">${lines}</ul>
<p style="margin:0"><a href="${link}" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">Reply in The Gathering</a></p>
<p style="margin:18px 0 0;font-size:12px;color:#74657A">You get one email per conversation at most every ${THROTTLE_MIN} minutes, and none when you read it in time. Turn these off from your own card in The Gathering.</p>`,
      'The Gathering · Proverbs 31 Collective by NEBA', 'THE PROVERBS 31 COLLECTIVE');
    const res = await sendEmail(email, subject, html, undefined, from);
    if (!res.ok) { result.skipped += 1; continue; } // left unnotified: tried again next run
    await Promise.all([
      markDone(ids),
      db.from('chat_dm_notices').insert({ user_id: recipient, channel_id: channelId, message_count: count }),
    ]);
    result.emailed += 1;
  }
  return json({ ok: true, ...result });
});
