// Supabase Edge Function: email-inbound
// Resend calls this for every email received at P31's private Resend address (members@ and
// vendor@ forward a copy there). It checks the request really came from Resend, files the email
// into a conversation (email_threads / email_messages, v32) and has Carla draft a reply in the
// background. Nothing is sent from here: the team reviews and sends in Content Studio → Email.
//
// Secrets: RESEND_API_KEY (a Full access key: reading received mail needs it),
//          RESEND_WEBHOOK_SECRET (whsec_… from the Resend webhook),
//          GEMINI_API_KEY or ANTHROPIC_API_KEY (Carla).
// Resend: Webhooks → Add endpoint → https://<project>.supabase.co/functions/v1/email-inbound, event email.received
// Deploy: supabase functions deploy email-inbound --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { addressOf, nameOf, baseSubject, redraft, type Mailbox } from '../_shared/mail-thread.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
const env = (k: string) => Deno.env.get(k) || '';
const ok = (body: unknown = { ok: true }, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body" with the
// base64 secret after "whsec_", sent as "v1,<base64>" (possibly several, space separated).
async function verified(req: Request, body: string) {
  const secret = env('RESEND_WEBHOOK_SECRET');
  const id = req.headers.get('svix-id');
  const ts = req.headers.get('svix-timestamp');
  const sigs = req.headers.get('svix-signature');
  if (!secret || !id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  const expected = btoa(String.fromCharCode(...mac));
  return sigs.split(' ').some((s) => {
    const [, sig] = s.split(',');
    if (!sig || sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

const toText = (html: string) => String(html || '')
  .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\n{3,}/g, '\n\n').trim();

const list = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).map(String);
// deno-lint-ignore no-explicit-any
const header = (h: any, name: string): string => {
  if (!h) return '';
  if (Array.isArray(h)) return String(h.find((x) => String(x.name || x.key || '').toLowerCase() === name)?.value || '');
  const k = Object.keys(h).find((x) => x.toLowerCase() === name);
  return k ? String(h[k]) : '';
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok({ error: 'Method not allowed' }, 405);
  const body = await req.text();
  if (!(await verified(req, body))) return ok({ error: 'bad signature' }, 401);
  const evt = JSON.parse(body);
  if (evt.type !== 'email.received' || !evt.data?.email_id) return ok({ ignored: evt.type });

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const emailId = String(evt.data.email_id);
  const { data: seen } = await db.from('email_messages').select('id').eq('resend_id', emailId).maybeSingle();
  if (seen) return ok({ duplicate: true });

  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}` } });
  if (!res.ok) {
    console.error('email-inbound: could not read email', res.status, (await res.text()).slice(0, 300));
    return ok({ error: 'could not read email' }, 500); // Resend retries
  }
  const m = await res.json();

  const fromRaw = String(m.from || evt.data.from || '');
  const from = addressOf(fromRaw);
  const replyTo = list(m.reply_to).map(addressOf).find(Boolean);
  const contact = replyTo || from;
  const recipients = [...list(m.to), ...list(m.cc), ...list(m.received_for), ...list(evt.data.to)].map((x) => x.toLowerCase());
  const mailbox: Mailbox = recipients.some((r) => r.includes('p31market.com') || /^vendor@/.test(addressOf(r))) ? 'market' : 'collective';
  const subject = String(m.subject || evt.data.subject || '(no subject)').slice(0, 300);

  // Our own application notifications reach members@/vendor@ too: not conversations.
  if (/@(thep31collective\.org|p31market\.com)$/.test(from) && /^new (p31 collective|vendor) application/i.test(subject)) return ok({ skipped: 'our notification' });

  const auto = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/.test(from)
    || (header(m.headers, 'auto-submitted') && header(m.headers, 'auto-submitted').toLowerCase() !== 'no')
    || /^(bulk|list|junk)$/i.test(header(m.headers, 'precedence'));
  const text = (String(m.text || '').trim() || toText(m.html)).slice(0, 20000);
  const messageId = String(m.message_id || evt.data.message_id || header(m.headers, 'message-id') || '');
  const refs = `${header(m.headers, 'in-reply-to')} ${header(m.headers, 'references')}`.match(/<[^>]+>/g) || [];

  // Find the conversation: a reply to a message we have, else the same person and subject lately.
  let threadId: string | null = null;
  if (refs.length) {
    const { data } = await db.from('email_messages').select('thread_id').in('message_id', refs).limit(1);
    threadId = data?.[0]?.thread_id || null;
  }
  if (!threadId) {
    const since = new Date(Date.now() - 60 * 864e5).toISOString();
    const { data } = await db.from('email_threads').select('id, subject').eq('mailbox', mailbox).eq('contact_email', contact)
      .gte('last_message_at', since).order('last_message_at', { ascending: false }).limit(10);
    threadId = (data || []).find((t: { subject: string }) => baseSubject(t.subject) === baseSubject(subject))?.id || null;
  }
  const now = new Date().toISOString();
  if (!threadId) {
    const { data, error } = await db.from('email_threads').insert({
      mailbox, subject, contact_email: contact, contact_name: nameOf(fromRaw), last_message_at: now,
      status: auto ? 'ignored' : 'needs_reply', category: auto ? 'automated' : null,
    }).select('id').single();
    if (error) { console.error('email-inbound: thread', error.message); return ok({ error: 'store failed' }, 500); }
    threadId = data.id;
  } else {
    await db.from('email_threads').update({
      last_message_at: now, last_from_contact: true, ...(auto ? {} : { status: 'needs_reply', handled_by: null, handled_at: null }),
    }).eq('id', threadId);
  }

  const { error: msgErr } = await db.from('email_messages').insert({
    thread_id: threadId, direction: 'in', resend_id: emailId, message_id: messageId || null,
    from_email: from, from_name: nameOf(fromRaw), to_emails: list(m.to).map(addressOf), subject, body_text: text,
    attachments: (m.attachments || evt.data.attachments || []).map((a: { filename?: string; content_type?: string; size?: number }) => ({ filename: a.filename, content_type: a.content_type, size: a.size })),
  });
  if (msgErr) { console.error('email-inbound: message', msgErr.message); return ok({ error: 'store failed' }, 500); }

  // Carla drafts in the background; Resend gets its answer right away.
  if (!auto) EdgeRuntime.waitUntil(redraft(db, threadId!).then((r) => r.error && console.error('email-inbound: draft', r.error)).catch((e) => console.error('email-inbound: draft', e)));
  return ok({ ok: true, thread: threadId, mailbox });
});
