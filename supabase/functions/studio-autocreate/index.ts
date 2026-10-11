// Supabase Edge Function: studio-autocreate
// Drafts a month of Instagram + Facebook engagement posts the same way Content Studio → Auto-create
// does (same planner, same library, the team's last settings), skipping days that already have a post
// in the Planner or on Zernio, and saves them as pre-posts for review. Nothing is published: the team
// looks them over in /studio/autocreate (Pre-posts) and schedules them from there.
//   Scheduler (v38): the 20th of each month → next month, once (a second call that month does nothing).
//   Studio button:   { month: 'YYYY-MM' } while signed in as Studio team → that month, from tomorrow
//                    if it is the current month.
// Secrets: ZERNIO_API_KEY (optional: skip days already booked there), RESEND_API_KEY,
//          AUTOCREATE_TO (comma list; default marketing@ + founder@)
// Deploy: supabase functions deploy studio-autocreate --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';
import { TYPES, DEFAULT_SLOTS, mergeLibrary } from '../_shared/factory/library.js';
import { buildPlan } from '../_shared/factory/generate.js';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const TZ = 'America/New_York';
const etDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monthName = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const daysIn = (m: string) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
const nextMonth = (today: string) => { const [y, m] = today.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
const list = (k: string, fallback: string[]) => { const v = env(k).split(',').map((s) => s.trim()).filter(Boolean); return v.length ? v : fallback; };
const defaultMix = () => Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, (t as Row).share]));

async function zernioDates(): Promise<Set<string>> {
  const out = new Set<string>();
  if (!env('ZERNIO_API_KEY')) return out;
  try {
    const res = await fetch('https://zernio.com/api/v1/posts?status=scheduled&limit=100&sortBy=scheduled-asc', { headers: { Authorization: `Bearer ${env('ZERNIO_API_KEY')}` } });
    if (res.ok) ((await res.json()).posts || []).forEach((p: Row) => { if (p.scheduledFor) out.add(etDate(new Date(p.scheduledFor))); });
  } catch { /* plan from the Planner alone */ }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  // deno-lint-ignore no-explicit-any
  let b: any = {};
  try { b = await req.json(); } catch { /* scheduler */ }
  const today = etDate();

  // Which month, and who asked.
  let month = nextMonth(today);
  let byTeam = false;
  if (b.month) {
    const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const { data: who } = await asUser.auth.getUser();
    if (!who?.user) return json({ error: 'Sign in first.' }, 401);
    const { data: ok } = await asUser.rpc('is_studio_member');
    if (!ok) return json({ error: 'Content Studio team only.' }, 403);
    if (!/^\d{4}-\d{2}$/.test(String(b.month))) return json({ error: 'Month must look like 2026-11.' }, 400);
    month = String(b.month);
    byTeam = true;
  }
  const first = `${month}-01`;
  const last = `${month}-${String(daysIn(month)).padStart(2, '0')}`;
  const start = first > today ? first : addDays(today, 1);
  if (start > last) return json({ error: 'That month is already over.' }, 400);
  const days = Math.round((new Date(`${last}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 864e5) + 1;

  // The scheduled run happens once per month.
  if (!byTeam) {
    const { data: done } = await db.from('content_series').select('id').eq('settings->>auto_month', month).limit(1);
    if (done?.length) return json({ ok: true, skipped: `${month} was already drafted` });
  }

  // The team's last choices (mix, look, cadence, times), else the Studio defaults.
  const { data: lastSeries } = await db.from('content_series').select('settings').order('created_at', { ascending: false }).limit(1);
  const prev: Row = lastSeries?.[0]?.settings || {};
  const settings = {
    mix: prev.mix && Object.values(prev.mix).some((v) => Number(v) > 0) ? prev.mix : defaultMix(),
    style: prev.style || 'night',
    cadence: prev.cadence || 'daily',
    platforms: Array.isArray(prev.platforms) && prev.platforms.length ? prev.platforms : ['instagram', 'facebook'],
    slots: prev.slots && typeof prev.slots === 'object' ? prev.slots : DEFAULT_SLOTS,
  };

  // What is taken already: Planner rows (and the library items they used) plus Zernio's schedule.
  const [{ data: libRows }, { data: planRows }, zDates] = await Promise.all([
    db.from('content_library').select('*').order('created_at'),
    db.from('content_plan').select('post_date, source_key, status').gte('post_date', addDays(today, -120)),
    zernioDates(),
  ]);
  const skipDates = new Set<string>(zDates);
  const usedKeys = new Set<string>();
  (planRows || []).forEach((r: Row) => { if (r.status !== 'skipped') { skipDates.add(r.post_date); if (r.source_key) usedKeys.add(r.source_key); } });

  const rows: Row[] = buildPlan({
    start, days, cadence: settings.cadence, mix: settings.mix, style: settings.style, platforms: settings.platforms,
    slots: settings.slots, skipDates, library: mergeLibrary(libRows || []), usedKeys, seed: Number(month.replace('-', '')) % 9973,
  });
  if (!rows.length) return json({ ok: true, drafted: 0, note: `Every day from ${start} to ${last} already has a post.` });

  const series = crypto.randomUUID();
  const { error: sErr } = await db.from('content_series').insert({
    id: series, name: `Auto · ${monthName(month)} · ${rows.length} posts`, post_count: rows.length,
    settings: { ...settings, start, days, auto_month: byTeam ? null : month, auto: true, by: byTeam ? 'studio button' : 'scheduler' },
  });
  if (sErr) return json({ error: sErr.message }, 500);
  const { error: pErr } = await db.from('content_plan').insert(rows.map((r) => ({
    post_date: r.post_date, post_time: r.post_time, platforms: r.platforms, kind: 'photo', pillar: r.pillar, theme: r.theme,
    hook: r.hook, caption: r.caption, status: 'draft', card: r.card, source_key: r.source_key, series_id: series,
    notes: 'Drafted automatically. Review, edit or swap in Content Studio → Auto-create → Pre-posts.',
  })));
  if (pErr) { await db.from('content_series').delete().eq('id', series); return json({ error: pErr.message }, 500); }

  // Tell the content team there is a month to review.
  if (emailConfigured()) {
    const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
    const sample = rows.slice(0, 6).map((r) => `<li>${esc(label(r.post_date))} · ${esc((TYPES as Row)[r.type]?.label || r.type)} · ${esc(String(r.hook || '').slice(0, 70))}</li>`).join('');
    await sendEmail(list('AUTOCREATE_TO', ['marketing@p31market.com', 'founder@thep31collective.org']),
      `${rows.length} posts drafted for ${monthName(month)}: ready for review`,
      layout(`${monthName(month)} is drafted`, `<p>Content Studio drafted <b>${rows.length} posts</b> for ${esc(label(start))} through ${esc(label(last))}, on every day that did not already have one, using your last Auto-create settings.</p>
<ul style="padding-left:18px;line-height:1.6;color:#4a3b5c">${sample}</ul>
<p>Nothing is published yet. Look them over, swap or rewrite any, then press Schedule all approved.</p>
<p style="margin:22px 0 0"><a href="https://www.thep31collective.org/studio/autocreate?tab=queue" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">Review the pre-posts</a></p>`,
      'thep31collective.org · Content Studio', 'THE PROVERBS 31 COLLECTIVE'),
      undefined, env('COLLECTIVE_EMAIL_FROM') || undefined).catch(() => {});
  }
  return json({ ok: true, drafted: rows.length, month, start, series });
});
