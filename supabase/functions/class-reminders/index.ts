// Supabase Edge Function: class-reminders
// Mentorship students get an email the day before each session and an hour before it, with the
// time in Eastern and a button into their classroom. The scheduler (v42) calls this every 15 minutes;
// academy_session_reminders records each email, so nobody gets the same reminder twice.
//   Group sessions: everyone with access to the program (or only the invitees, when a session has them).
//   1:1 sessions: that student.
// Mentors switch reminders off per session (academy_sessions.reminders); admins switch them all off in
// app_settings 'reminders'.
// Secrets: RESEND_API_KEY, COLLECTIVE_EMAIL_FROM or EMAIL_FROM
// Deploy: supabase functions deploy class-reminders --no-verify-jwt
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

const SITE = 'https://www.thep31collective.org';
const FOOT = 'thep31collective.org · The Proverbs 31 Collective by NEBA';
const CONTACT = 'members@thep31collective.org';
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!emailConfigured()) return json({ ok: false, waiting: 'email' });
  // deno-lint-ignore no-explicit-any
  const db: any = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const from = env('COLLECTIVE_EMAIL_FROM') || env('EMAIL_FROM') || undefined;

  const { data: cfg } = await db.from('app_settings').select('value').eq('key', 'reminders').maybeSingle();
  const opts = { enabled: true, day_before: true, hour_before: true, ...(cfg?.value || {}) };
  if (!opts.enabled) return json({ ok: true, skipped: 'reminders are off' });

  const now = Date.now();
  const { data: sessions, error } = await db.from('academy_sessions')
    .select('id, program_id, title, description, starts_at, duration_minutes, student_id, invitees, provider, join_url, ended_at, reminders, academy_programs(slug, title)')
    .gt('starts_at', new Date(now).toISOString()).lte('starts_at', new Date(now + 24 * 3600e3).toISOString())
    .is('ended_at', null).order('starts_at').limit(100);
  if (error) return json({ error: error.message }, 500);

  const roster = new Map<string, string[]>();
  const membersOf = async (programId: string) => {
    if (roster.has(programId)) return roster.get(programId)!;
    const { data } = await db.from('academy_enrollments').select('user_id, status, access_until').eq('program_id', programId);
    const ids = (data || []).filter((e: Row) => (e.access_until === null && e.status === 'active')
      || (e.access_until && new Date(e.access_until).getTime() > now && ['active', 'past_due', 'canceled'].includes(e.status))).map((e: Row) => e.user_id);
    roster.set(programId, ids);
    return ids;
  };
  const emails = new Map<string, { email: string; name: string } | null>();
  const person = async (id: string) => {
    if (emails.has(id)) return emails.get(id)!;
    const { data } = await db.auth.admin.getUserById(id);
    const u = data?.user;
    const v = u?.email ? { email: u.email, name: (u.user_metadata?.full_name || '').split(' ')[0] } : null;
    emails.set(id, v);
    return v;
  };

  const out = { day: 0, hour: 0 };
  for (const s of sessions || []) {
    if (s.reminders === false) continue;
    const mins = (new Date(s.starts_at).getTime() - now) / 60000;
    const kind = mins <= 75 ? (opts.hour_before ? 'hour' : null) : mins > 120 ? (opts.day_before ? 'day' : null) : null;
    if (!kind) continue;
    const slug = s.academy_programs?.slug || 'business';
    const program = s.academy_programs?.title || 'your mentorship';
    const recipients: string[] = s.invitees?.length ? s.invitees : s.student_id ? [s.student_id] : await membersOf(s.program_id);
    const link = s.provider === 'daily' ? `${SITE}/academy/${slug}/live/${s.id}` : `${SITE}/academy/${slug}/sessions`;
    for (const uid of recipients) {
      // Claim it first, so two runs never send the same reminder.
      const { data: claimed } = await db.from('academy_session_reminders').insert({ session_id: s.id, user_id: uid, kind }).select('session_id');
      if (!claimed?.length) continue;
      const p = await person(uid);
      if (!p) continue;
      const subject = kind === 'hour' ? `Starting at ${time(s.starts_at)}: ${s.title}` : `Coming up: ${s.title}, ${when(s.starts_at)}`;
      const html = layout(kind === 'hour' ? 'Your session starts within the hour' : 'Your session is coming up',
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${p.name ? `Hi ${esc(p.name)}, ` : ''}${kind === 'hour' ? 'a quick reminder: your' : 'your'} ${esc(program)} ${s.student_id ? 'one-on-one session' : 'session'} <b>${esc(s.title)}</b> is on <b>${esc(when(s.starts_at))}</b> (Eastern), ${Number(s.duration_minutes) || 60} minutes.</p>
${s.description ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.5;color:#4E3A4B">${esc(String(s.description).slice(0, 400))}</p>` : ''}
<p style="margin:0 0 12px;font-size:14px;line-height:1.5">${s.provider === 'daily' ? 'Join from your classroom: the room opens 30 minutes before.' : s.join_url ? 'Your join link is in your classroom under Sessions.' : 'Your mentor will share how to join in your classroom.'}</p>
<p style="margin:20px 0 0"><a href="${link}" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">${kind === 'hour' ? 'Open the session' : 'Open my classroom'}</a></p>
<p style="margin:18px 0 0;font-size:12px;color:#74657A">Can’t make it? Reply to this email or write to ${CONTACT}.</p>`, FOOT, 'THE PROVERBS 31 COLLECTIVE');
      const res = await sendEmail(p.email, subject, html, CONTACT, from);
      if (!res.ok && !res.skipped) {
        await db.from('academy_session_reminders').delete().eq('session_id', s.id).eq('user_id', uid).eq('kind', kind); // try again next run
        continue;
      }
      out[kind as 'day' | 'hour'] += 1;
    }
  }
  return json({ ok: true, ...out });
});
