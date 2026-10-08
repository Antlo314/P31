// Supabase Edge Function: zoom-meetings
// Creates, updates and deletes the Zoom meeting behind a classroom session.
// Mentors call it from the classroom; the join link goes on the session (students
// see it), the host "start" link goes to academy_session_hosts (mentors only).
//
// Setup (Zoom Marketplace → Develop → Build App → Server-to-Server OAuth):
//   scopes: meeting:write:meeting:admin, meeting:update:meeting:admin, meeting:delete:meeting:admin, meeting:read:meeting:admin
//   supabase secrets set ZOOM_ACCOUNT_ID=... ZOOM_CLIENT_ID=... ZOOM_CLIENT_SECRET=...
//   optional: ZOOM_USER=host@email.com   (whose Zoom account hosts the meetings; default "me")
//   optional: ZOOM_AUTO_RECORD=cloud     (needs a paid Zoom plan; default none)
//   supabase functions deploy zoom-meetings
//
// POST { action: 'create' | 'update' | 'delete', session_id }
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) || '';
class UserError extends Error {}

let token: { value: string; expires: number } | null = null;
async function zoomToken() {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(env('ZOOM_ACCOUNT_ID'))}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${env('ZOOM_CLIENT_ID')}:${env('ZOOM_CLIENT_SECRET')}`)}` },
  });
  const j = await res.json();
  if (!res.ok) { console.error('zoom token', res.status, JSON.stringify(j).slice(0, 300)); throw new UserError('Zoom sign-in failed — check the Zoom secrets.'); }
  token = { value: j.access_token, expires: Date.now() + (j.expires_in || 3600) * 1000 };
  return token.value;
}

async function zoom(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await zoomToken()}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (res.status === 204) return {};
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!res.ok && !(init.method === 'DELETE' && res.status === 404)) {
    console.error(`Zoom ${res.status} ${path}: ${text.slice(0, 300)}`);
    throw new UserError(body?.message || `Zoom couldn't complete that (${res.status}).`);
  }
  return body;
}

const meetingBody = (s: any, programTitle: string) => ({
  topic: `${s.title} · ${programTitle}`.slice(0, 200),
  type: 2,
  start_time: new Date(s.starts_at).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  duration: s.duration_minutes || 60,
  timezone: 'America/New_York',
  agenda: (s.description || 'The Proverbs 31 Collective').slice(0, 1900),
  settings: {
    join_before_host: false,
    waiting_room: true,
    mute_upon_entry: true,
    participant_video: true,
    host_video: true,
    approval_type: 2,
    auto_recording: env('ZOOM_AUTO_RECORD') || 'none',
  },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env('ZOOM_ACCOUNT_ID') || !env('ZOOM_CLIENT_ID') || !env('ZOOM_CLIENT_SECRET')) {
    return json({ error: 'Zoom isn’t connected yet — add the ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET secrets.' }, 503);
  }

  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: 'Sign in first.' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  try {
    const { data: s } = await admin.from('academy_sessions').select('*, program:academy_programs(title)').eq('id', body.session_id).maybeSingle();
    if (!s) throw new UserError('Session not found.');
    const { data: isMentor } = await asUser.rpc('is_mentor', { p_program: s.program_id });
    if (!isMentor) return json({ error: 'Only mentors can manage session meetings.' }, 403);
    const host = encodeURIComponent(env('ZOOM_USER') || 'me');

    if (body.action === 'create') {
      if (s.zoom_meeting_id) throw new UserError('This session already has a Zoom meeting.');
      const m = await zoom(`/users/${host}/meetings`, { method: 'POST', body: JSON.stringify(meetingBody(s, s.program?.title || 'Mentorship')) });
      await admin.from('academy_sessions').update({ provider: 'zoom', zoom_meeting_id: String(m.id), join_url: m.join_url }).eq('id', s.id);
      await admin.from('academy_session_hosts').upsert({ session_id: s.id, program_id: s.program_id, start_url: m.start_url, passcode: m.password || null, updated_at: new Date().toISOString() });
      return json({ ok: true, join_url: m.join_url, start_url: m.start_url, meeting_id: String(m.id) });
    }
    if (body.action === 'update') {
      if (!s.zoom_meeting_id) return json({ ok: true, skipped: 'no Zoom meeting' });
      await zoom(`/meetings/${s.zoom_meeting_id}`, { method: 'PATCH', body: JSON.stringify(meetingBody(s, s.program?.title || 'Mentorship')) });
      return json({ ok: true });
    }
    if (body.action === 'delete') {
      if (s.zoom_meeting_id) await zoom(`/meetings/${s.zoom_meeting_id}`, { method: 'DELETE' });
      await admin.from('academy_sessions').update({ zoom_meeting_id: null, join_url: null, provider: null }).eq('id', s.id);
      await admin.from('academy_session_hosts').delete().eq('session_id', s.id);
      return json({ ok: true });
    }
    // A fresh host link (Zoom's start links expire after a while).
    if (body.action === 'host') {
      if (!s.zoom_meeting_id) throw new UserError('No Zoom meeting on this session.');
      const m = await zoom(`/meetings/${s.zoom_meeting_id}`);
      await admin.from('academy_session_hosts').upsert({ session_id: s.id, program_id: s.program_id, start_url: m.start_url, passcode: m.password || null, updated_at: new Date().toISOString() });
      return json({ ok: true, start_url: m.start_url });
    }
    throw new UserError('Unknown action.');
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 400);
    console.error('zoom-meetings error:', err);
    return json({ error: 'Something went wrong talking to Zoom.' }, 500);
  }
});
