// Supabase Edge Function: daily-webhook
// Daily reports what happens in every live classroom call; this saves it:
//   participant.joined / participant.left → academy_meeting_events (+ how long they stayed),
//       attendance for enrolled students, and the CRM timeline
//   meeting.started / meeting.ended       → the session's started_at / ended_at
//   recording.ready-to-download           → academy_recordings (watchable from the classroom)
//
// Setup: supabase secrets set DAILY_WEBHOOK_SECRET=<base64 secret>; deploy; then Systems → Academy →
// "Turn on call tracking" registers this endpoint with Daily (daily-room install-webhook).
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
const env = (k: string) => Deno.env.get(k) || '';
const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function sign(secretB64: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', b64ToBytes(secretB64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToB64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isoFrom = (secs: unknown) => (typeof secs === 'number' ? new Date(secs * 1000).toISOString() : new Date().toISOString());

async function record(evt: any) {
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const p = evt.payload || {};
  const roomName = p.room || p.room_name;
  if (!roomName) return;
  const { data: s } = await db.from('academy_sessions').select('id, program_id, title, student_id, starts_at, started_at').eq('daily_room', roomName).maybeSingle();
  if (!s) { console.log(`daily-webhook: room ${roomName} isn't a classroom session`); return; }
  const type = evt.type as string;

  if (type === 'meeting.started') {
    if (!s.started_at) await db.from('academy_sessions').update({ started_at: isoFrom(p.start_ts) }).eq('id', s.id);
    await db.from('academy_meeting_events').insert({ session_id: s.id, program_id: s.program_id, event: type, at: isoFrom(p.start_ts), payload: { meeting_id: p.meeting_id || null } });
    return;
  }
  if (type === 'meeting.ended') {
    await db.from('academy_sessions').update({ ended_at: isoFrom(p.end_ts) }).eq('id', s.id);
    await db.from('academy_meeting_events').insert({ session_id: s.id, program_id: s.program_id, event: type, at: isoFrom(p.end_ts), payload: { meeting_id: p.meeting_id || null } });
    return;
  }
  if (type === 'recording.ready-to-download') {
    await db.from('academy_recordings').upsert({
      session_id: s.id, program_id: s.program_id, provider_id: p.recording_id, started_at: isoFrom(p.start_ts),
      duration_seconds: p.duration ?? null, status: p.status || 'finished',
    }, { onConflict: 'provider_id' });
    await db.from('academy_sessions').update({ has_recording: true }).eq('id', s.id);
    return;
  }
  if (type === 'participant.joined' || type === 'participant.left') {
    const userId = UUID.test(p.user_id || '') ? p.user_id : null;
    const at = type === 'participant.joined' ? isoFrom(p.joined_at) : new Date().toISOString();
    await db.from('academy_meeting_events').insert({
      session_id: s.id, program_id: s.program_id, event: type, participant_name: p.user_name || null, user_id: userId, at,
      duration_seconds: type === 'participant.left' ? Math.round(p.duration ?? 0) : null,
      payload: { session_id: p.session_id || null, owner: !!p.owner },
    });
    if (!userId || p.owner) return;
    if (type === 'participant.joined') {
      const { data: enrolled } = await db.from('academy_enrollments').select('id').eq('program_id', s.program_id).eq('user_id', userId).maybeSingle();
      if (enrolled) {
        const late = new Date(at) > new Date(new Date(s.starts_at).getTime() + 10 * 60000);
        await db.from('academy_attendance').upsert({ session_id: s.id, user_id: userId, program_id: s.program_id, status: late ? 'late' : 'present', note: 'Joined the live class' },
          { onConflict: 'session_id,user_id', ignoreDuplicates: true });
      }
    } else {
      const mins = Math.round((p.duration ?? 0) / 60);
      await db.rpc('crm_service_event', {
        p_user: userId, p_kind: 'live_class', p_title: `Attended “${s.title}” live · ${mins} min`,
        p_detail: { session_id: s.id, minutes: mins, joined_at: isoFrom(p.joined_at) }, p_source: 'live class',
      });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = env('DAILY_WEBHOOK_SECRET');
  if (!secret) return new Response('Not configured', { status: 503 });
  const body = await req.text();
  const ts = req.headers.get('X-Webhook-Timestamp') || '';
  const sig = req.headers.get('X-Webhook-Signature') || '';
  if (!ts || !safeEqual(sig, await sign(secret, `${ts}.${body}`))) return new Response('Bad signature', { status: 401 });
  // Signed but old: a replayed event. (Daily sends seconds; accept milliseconds too.)
  const sentMs = Number(ts) > 1e12 ? Number(ts) : Number(ts) * 1000;
  if (!Number.isFinite(sentMs) || Math.abs(Date.now() - sentMs) > 5 * 60 * 1000) return new Response('Stale', { status: 401 });
  let evt: any;
  try { evt = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }
  if (evt?.test) return ok(); // Daily's check when the webhook is registered
  EdgeRuntime.waitUntil(record(evt).catch((e) => console.error('daily-webhook error:', e)));
  return ok();
});
