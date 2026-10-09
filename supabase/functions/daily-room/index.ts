// Supabase Edge Function: daily-room
// Live classroom video, built into the page (Daily Prebuilt).
//   create  (mentor)  → a private Daily room for a session, open from 30 min before to 2 h after
//   update  (mentor)  → move the room's open/close times after a reschedule
//   delete  (mentor)  → remove the room
//   join    (anyone allowed into the session) → a personal meeting token; joining is logged
//           through academy_join_session (attendance + CRM). Mentors join as room owners
//           (and can record when the session allows it).
//   end     (mentor)  → close the room now; everyone leaves
//   recording (anyone allowed into the session) → fresh links to watch its recordings
//   install-webhook (admin) → register daily-webhook with Daily so every call is saved
//
// Setup: daily.co → sign up → Developers → copy the API key, then
//   supabase secrets set DAILY_API_KEY=...
//   supabase functions deploy daily-room
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

async function daily(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.daily.co/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env('DAILY_API_KEY')}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!res.ok && !(init.method === 'DELETE' && res.status === 404)) {
    console.error(`Daily ${res.status} ${path}: ${text.slice(0, 300)}`);
    throw new UserError(body?.info || body?.error || `Daily couldn't complete that (${res.status}).`);
  }
  return body;
}

const secs = (d: Date) => Math.floor(d.getTime() / 1000);
const windowFor = (s: any) => {
  const start = new Date(s.starts_at);
  const end = new Date(start.getTime() + (s.duration_minutes || 60) * 60000);
  return { nbf: secs(new Date(start.getTime() - 30 * 60000)), exp: secs(new Date(end.getTime() + 2 * 3600000)), end };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env('DAILY_API_KEY')) return json({ error: 'Live video isn’t connected yet — add the DAILY_API_KEY secret.' }, 503);

  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false },
  });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: 'Sign in first.' }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  try {
    if (body.action === 'install-webhook') {
      const { data: isAdmin } = await asUser.rpc('is_academy_admin');
      if (!isAdmin) return json({ error: 'Admins only.' }, 403);
      if (!env('DAILY_WEBHOOK_SECRET')) throw new UserError('Add the DAILY_WEBHOOK_SECRET secret and deploy daily-webhook first.');
      const url = `${env('SUPABASE_URL')}/functions/v1/daily-webhook`;
      const existing = await daily('/webhooks');
      for (const h of (Array.isArray(existing) ? existing : existing.data || [])) {
        if (h.url === url) await daily(`/webhooks/${h.uuid}`, { method: 'DELETE' });
      }
      await daily('/webhooks', { method: 'POST', body: JSON.stringify({
        url, hmac: env('DAILY_WEBHOOK_SECRET'),
        eventTypes: ['meeting.started', 'meeting.ended', 'participant.joined', 'participant.left', 'recording.ready-to-download'],
      }) });
      return json({ ok: true });
    }

    const { data: s } = await admin.from('academy_sessions').select('*').eq('id', body.session_id).maybeSingle();
    if (!s) throw new UserError('Session not found.');
    const { data: isMentor } = await asUser.rpc('is_mentor', { p_program: s.program_id });
    const w = windowFor(s);

    if (body.action === 'create' || body.action === 'update' || body.action === 'delete') {
      if (!isMentor) return json({ error: 'Only mentors can manage live rooms.' }, 403);
      if (body.action === 'delete') {
        if (s.daily_room) await daily(`/rooms/${encodeURIComponent(s.daily_room)}`, { method: 'DELETE' });
        await admin.from('academy_sessions').update({ daily_room: null, join_url: null, provider: null }).eq('id', s.id);
        return json({ ok: true });
      }
      const properties = {
        nbf: w.nbf, exp: w.exp, eject_at_room_exp: true,
        enable_prejoin_ui: true, enable_chat: true, enable_screenshare: true, enable_knocking: false,
        ...(s.record ? { enable_recording: 'cloud' } : {}),
      };
      // Free Daily plans refuse some settings (recording without a card on file): retry without them.
      const withPlanFallback = async (call: (props: any) => Promise<any>) => {
        try { return { result: await call(properties), note: null }; }
        catch (e) {
          if (!/plan|not allowed|cannot be set/i.test((e as Error).message) || !properties.enable_recording) throw e;
          const { enable_recording: _r, ...rest } = properties as any;
          return { result: await call(rest), note: 'Recording isn’t available on the current Daily plan, so this room opens without it.' };
        }
      };
      if (body.action === 'update') {
        if (!s.daily_room) return json({ ok: true, skipped: 'no live room' });
        await withPlanFallback((props) => daily(`/rooms/${encodeURIComponent(s.daily_room)}`, { method: 'POST', body: JSON.stringify({ properties: props }) }));
        return json({ ok: true });
      }
      if (s.daily_room) throw new UserError('This session already has a live room.');
      const name = `p31-${String(s.id).slice(0, 8)}-${crypto.randomUUID().slice(0, 6)}`;
      const { result: room, note } = await withPlanFallback((props) => daily('/rooms', { method: 'POST', body: JSON.stringify({ name, privacy: 'private', properties: props }) }));
      await admin.from('academy_sessions').update({ provider: 'daily', daily_room: room.name, join_url: room.url, ...(note ? { record: false } : {}) }).eq('id', s.id);
      return json({ ok: true, url: room.url, note });
    }

    if (body.action === 'join') {
      if (s.provider !== 'daily' || !s.daily_room) throw new UserError('This session doesn’t have a live room.');
      // Access check + attendance + CRM all happen here; it raises if the person isn't allowed in.
      const { data: url, error } = await asUser.rpc('academy_join_session', { p_session: s.id });
      if (error) throw new UserError(error.message);
      const name = who.user.user_metadata?.full_name || who.user.email?.split('@')[0] || 'Guest';
      const { token } = await daily('/meeting-tokens', {
        method: 'POST',
        body: JSON.stringify({ properties: {
          room_name: s.daily_room, user_name: String(name).slice(0, 60), user_id: who.user.id.slice(0, 36),
          is_owner: !!isMentor, exp: w.exp, eject_at_token_exp: true,
          ...(isMentor && s.record ? { enable_recording: 'cloud' } : {}),
        } }),
      });
      return json({ ok: true, url, token, title: s.title, mentor: !!isMentor, ends_at: w.end.toISOString() });
    }
    if (body.action === 'end') {
      if (!isMentor) return json({ error: 'Only mentors can end a class.' }, 403);
      if (s.daily_room) await daily(`/rooms/${encodeURIComponent(s.daily_room)}`, { method: 'POST', body: JSON.stringify({ properties: { exp: secs(new Date()) + 15, eject_at_room_exp: true } }) });
      await admin.from('academy_sessions').update({ ended_at: new Date().toISOString() }).eq('id', s.id);
      return json({ ok: true });
    }
    if (body.action === 'recording') {
      // Same access rule as joining, without logging a join.
      const { data: recs } = await asUser.from('academy_recordings').select('provider_id, started_at, duration_seconds').eq('session_id', s.id).order('started_at');
      const links = [];
      for (const r of recs || []) {
        const l = await daily(`/recordings/${encodeURIComponent(r.provider_id)}/access-link?valid_for_secs=10800`);
        links.push({ url: l.download_link, expires: l.expires, started_at: r.started_at, minutes: Math.round((r.duration_seconds || 0) / 60) });
      }
      return json({ ok: true, recordings: links });
    }
    throw new UserError('Unknown action.');
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 400);
    console.error('daily-room error:', err);
    return json({ error: 'Something went wrong starting the live room.' }, 500);
  }
});
