// Supabase Edge Function: email-send
// Content Studio → Email. Only a signed-in Content Studio person (Yanni, admins) can use it.
//   { action: 'send', thread_id, body }            → sends the reply from the right inbox, in the same thread
//   { action: 'redraft', thread_id, instruction? } → asks Carla for a new draft ("shorter", "mention the gala")
// Deploy: supabase functions deploy email-send --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MAILBOX, redraft, type Mailbox } from '../_shared/mail-thread.ts';
import { esc } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const paragraphs = (t: string) => esc(t).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Who is calling? Their own session decides.
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: 'Sign in to the Content Studio first.' }, 401);
  const { data: allowed } = await asUser.rpc('is_studio_member');
  if (!allowed) return json({ error: 'Email is for the Content Studio team.' }, 403);

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data: thread } = await db.from('email_threads').select('*').eq('id', String(body.thread_id || '')).maybeSingle();
  if (!thread) return json({ error: 'Conversation not found.' }, 404);

  if (body.action === 'redraft') {
    const r = await redraft(db, thread.id, String(body.instruction || ''));
    return r.error ? json({ error: r.error }, 502) : json({ ok: true, draft: r.draft });
  }

  if (body.action !== 'send') return json({ error: 'Unknown action.' }, 400);
  const text = String(body.body || '').trim();
  if (text.length < 2) return json({ error: 'Write the reply first.' }, 400);
  if (!env('RESEND_API_KEY')) return json({ error: 'Email isn’t set up yet (RESEND_API_KEY).' }, 503);

  const { data: last } = await db.from('email_messages').select('*').eq('thread_id', thread.id).eq('direction', 'in')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  const box = MAILBOX[thread.mailbox as Mailbox];
  const subject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;
  const when = last ? new Date(last.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) : '';
  const quoteText = last ? `\n\nOn ${when}, ${last.from_name || last.from_email} wrote:\n${String(last.body_text).split('\n').map((l: string) => `> ${l}`).join('\n')}` : '';
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#201431">${paragraphs(text)}</div>`
    + (last ? `<div style="margin-top:18px;color:#6E6580;font-size:13px">On ${esc(when)}, ${esc(last.from_name || last.from_email)} wrote:</div>`
      + `<blockquote style="margin:6px 0 0;padding-left:12px;border-left:3px solid #e7dcf4;color:#6E6580;font-size:13px">${paragraphs(String(last.body_text).slice(0, 8000))}</blockquote>` : '');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: box.from(), to: [thread.contact_email], subject, html, text: text + quoteText,
      ...(last?.message_id ? { headers: { 'In-Reply-To': last.message_id, References: last.message_id } } : {}),
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('email-send: Resend', res.status, JSON.stringify(out).slice(0, 300));
    return json({ error: `The email didn’t send: ${out.message || res.status}` }, 502);
  }

  const now = new Date().toISOString();
  await db.from('email_messages').insert({
    thread_id: thread.id, direction: 'out', resend_id: out.id || null, from_email: box.label, from_name: box.team,
    to_emails: [thread.contact_email], subject, body_text: text, sent_by: who.user.id,
  });
  await db.from('email_threads').update({
    status: 'sent', draft: null, last_message_at: now, last_from_contact: false, handled_by: who.user.id, handled_at: now,
  }).eq('id', thread.id);
  return json({ ok: true });
});
