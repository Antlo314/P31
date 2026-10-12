// Supabase Edge Function: eventbrite-stats
// Ticket sales for every upcoming event whose ticket link is on Eventbrite (market_events.rsvp_url),
// for Today, the Systems overview and Markets & events. Team only.
// Secret: EVENTBRITE_TOKEN (Eventbrite → Account settings → Developer links → API keys → your private token).
// Without it the function answers { configured: false } and the card explains how to connect.
// Deploy: supabase functions deploy eventbrite-stats --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// Results are kept for ten minutes so a busy morning does not hit Eventbrite every page load.
let cache: { at: number; body: Row } | null = null;
const eventId = (url = '') => (url.match(/eventbrite\.[a-z.]+\/e\/(?:[^/?#]*-)?(\d{8,})/i) || [])[1] || null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Team only: an admin, or someone with the Markets & events or Orders dashboard.
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
  const { data: roles } = await asUser.rpc('my_roles');
  const ok = roles && (roles.admin || roles.operator || (roles.tools || []).some((t: string) => ['events', 'orders', 'vendors'].includes(t)));
  if (!ok) return json({ error: 'Team only.' }, 403);

  if (!env('EVENTBRITE_TOKEN')) return json({ configured: false, events: [] });
  if (cache && Date.now() - cache.at < 10 * 60e3) return json(cache.body);

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);
  const { data: events } = await db.from('market_events').select('id, title, event_date, rsvp_url, capacity')
    .eq('is_active', true).gte('event_date', today).ilike('rsvp_url', '%eventbrite%').order('event_date').limit(5);

  const out: Row[] = [];
  for (const e of events || []) {
    const id = eventId(e.rsvp_url);
    if (!id) continue;
    try {
      const res = await fetch(`https://www.eventbriteapi.com/v3/events/${id}/ticket_classes/`, { headers: { Authorization: `Bearer ${env('EVENTBRITE_TOKEN')}` } });
      if (!res.ok) { out.push({ id: e.id, title: e.title, event_date: e.event_date, url: e.rsvp_url, error: res.status === 403 || res.status === 401 ? 'The token cannot see this event (it must belong to the same Eventbrite organization).' : `Eventbrite answered ${res.status}` }); continue; }
      const { ticket_classes = [] } = await res.json();
      const classes = ticket_classes.map((t: Row) => ({ name: t.name, sold: Number(t.quantity_sold) || 0, total: Number(t.quantity_total) || 0, free: !!t.free }));
      out.push({
        id: e.id, title: e.title, event_date: e.event_date, url: e.rsvp_url,
        sold: classes.reduce((n: number, c: Row) => n + c.sold, 0),
        total: classes.reduce((n: number, c: Row) => n + c.total, 0) || e.capacity || null,
        classes,
      });
    } catch (err) {
      out.push({ id: e.id, title: e.title, event_date: e.event_date, url: e.rsvp_url, error: (err as Error).message });
    }
  }
  const body = { configured: true, events: out, checked_at: new Date().toISOString() };
  cache = { at: Date.now(), body };
  return json(body);
});
