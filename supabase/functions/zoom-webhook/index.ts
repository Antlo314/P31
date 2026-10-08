// Supabase Edge Function: zoom-webhook
// Zoom calls this when people join or leave a session's meeting and when a cloud
// recording is ready. Joins of enrolled students mark attendance; everything is
// kept in academy_meeting_events and the CRM timeline.
//
// Setup: in the same Zoom app → Features → Event Subscriptions, add
//   https://<project>.supabase.co/functions/v1/zoom-webhook
//   events: Meeting → Participant/Host joined meeting, Participant/Host left meeting,
//           Recording → All recordings have completed
//   supabase secrets set ZOOM_WEBHOOK_SECRET=<the app's "Secret Token">
//   supabase functions deploy zoom-webhook
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
const env = (k: string) => Deno.env.get(k) || '';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function record(evt: any) {
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const obj = evt.payload?.object || {};
  const meetingId = obj.id ? String(obj.id) : null;
  if (!meetingId) return;
  const { data: s } = await db.from('academy_sessions').select('id, program_id, title, student_id, starts_at, duration_minutes, recording_url').eq('zoom_meeting_id', meetingId).maybeSingle();
  if (!s) { console.log(`zoom-webhook: meeting ${meetingId} isn't a classroom session`); return; }

  if (evt.event === 'recording.completed') {
    const url = obj.share_url || null;
    await db.from('academy_meeting_events').insert({ session_id: s.id, program_id: s.program_id, zoom_meeting_id: meetingId, event: evt.event, payload: { share_url: url, files: (obj.recording_files || []).length } });
    if (url && !s.recording_url) await db.from('academy_sessions').update({ recording_url: url }).eq('id', s.id);
    return;
  }

  const p = obj.participant || {};
  const email = (p.email || '').toLowerCase() || null;
  let userId: string | null = null;
  if (email) {
    const { data } = await db.rpc('crm_user_by_email', { p_email: email });
    userId = data || null;
  }
  const at = p.join_time || p.leave_time || new Date().toISOString();
  await db.from('academy_meeting_events').insert({
    session_id: s.id, program_id: s.program_id, zoom_meeting_id: meetingId, event: evt.event,
    participant_name: p.user_name || null, participant_email: email, user_id: userId, at,
    duration_seconds: p.duration ?? null, payload: { participant_user_id: p.participant_user_id || null, id: p.id || null },
  });

  if (/participant_joined$/.test(evt.event) && userId) {
    const lateAfter = new Date(new Date(s.starts_at).getTime() + 10 * 60000);
    const status = new Date(at) > lateAfter ? 'late' : 'present';
    const { data: enrolled } = await db.from('academy_enrollments').select('id').eq('program_id', s.program_id).eq('user_id', userId).maybeSingle();
    if (enrolled && (!s.student_id || s.student_id === userId)) {
      await db.from('academy_attendance').upsert({ session_id: s.id, user_id: userId, program_id: s.program_id, status, note: 'Joined on Zoom' }, { onConflict: 'session_id,user_id', ignoreDuplicates: true });
    }
  }
  if (email) {
    await db.rpc('crm_zoom_event', {
      p_email: email, p_name: p.user_name || null,
      p_kind: /joined$/.test(evt.event) ? 'zoom_joined' : 'zoom_left',
      p_title: `${/joined$/.test(evt.event) ? 'Joined' : 'Left'} “${s.title}” on Zoom`,
      p_detail: { session_id: s.id, at, duration_seconds: p.duration ?? null },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = env('ZOOM_WEBHOOK_SECRET');
  if (!secret) return new Response('Not configured', { status: 503 });
  const body = await req.text();
  let evt: any;
  try { evt = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }

  // Zoom checks the endpoint once when it's saved.
  if (evt.event === 'endpoint.url_validation') {
    const plainToken = evt.payload?.plainToken || '';
    return json({ plainToken, encryptedToken: await hmacHex(secret, plainToken) });
  }

  const ts = req.headers.get('x-zm-request-timestamp') || '';
  const sig = req.headers.get('x-zm-signature') || '';
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return new Response('Stale', { status: 401 });
  if (!safeEqual(sig, `v0=${await hmacHex(secret, `v0:${ts}:${body}`)}`)) return new Response('Bad signature', { status: 401 });

  EdgeRuntime.waitUntil(record(evt).catch((e) => console.error('zoom-webhook error:', e)));
  return json({ ok: true });
});
