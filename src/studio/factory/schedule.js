// The posting schedule (autopilot_settings.schedule, storefront_v65_posting_schedule.sql): for each
// brand, whether the autopilot drafts its posts, how many a day (0 to 8), on which weekdays, at which
// Eastern times and on which platforms. Used by Systems > Posting schedule, the Studio's Autopilot
// panel and Auto-create, and (copied by scripts/sync-factory.mjs into supabase/functions/_shared/factory)
// by content-autopilot, studio-autocreate and the watchdog. Plain JavaScript with no imports, so the
// browser, Deno and Node (scripts/test-posting-schedule.mjs) all run the very same code.
//
//   schedule = null: the original autopilot (posts_per_day for the Marketplace, best times,
//                    Market Instagram + Facebook). Nothing below changes how that plans.
//   schedule = {
//     market:     { enabled, posts_per_day: 0-8, days: [0-6] (Sunday = 0), times: 'best' | ['12:30', ...],
//                   platforms: { instagram, facebook, tiktok } },
//     collective: { enabled, posts_per_day: 0-8, days: [...], times: ..., platforms: { instagram } },
//   }
//   times are Eastern wall-clock 'HH:MM' (24-hour), one per post a day, unique and sorted.

export const MAX_PER_DAY = 8;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const PLATFORM_LABEL = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
export const STREAMS = {
  market: { key: 'market', label: 'Marketplace', platforms: ['instagram', 'facebook', 'tiktok'] },
  collective: { key: 'collective', label: 'Collective', platforms: ['instagram'] },
};
export const STREAM_KEYS = ['market', 'collective'];

const DAY = 864e5;
const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isTime = (t) => typeof t === 'string' && HM.test(t);
export const toMinutes = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
export const fromMinutes = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
/** '19:30' -> '7:30 PM' */
export const timeLabel = (hm) => { const h = Number(hm.slice(0, 2)); return `${((h + 11) % 12) + 1}:${hm.slice(3, 5)} ${h < 12 ? 'AM' : 'PM'}`; };

const clampInt = (v, lo, hi, fallback) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback; };

// ── Shape ──

/** A stream's defaults: the Marketplace as the autopilot runs today, the Collective off. */
export function defaultStream(key, perDay = 2) {
  if (key === 'collective') return { enabled: false, posts_per_day: 1, days: [...ALL_DAYS], times: 'best', platforms: { instagram: true } };
  return { enabled: true, posts_per_day: clampInt(perDay, 0, MAX_PER_DAY, 2), days: [...ALL_DAYS], times: 'best', platforms: { instagram: true, facebook: true, tiktok: false } };
}

/** A starting schedule that matches what the autopilot does now (for the first time someone edits it). */
export function defaultSchedule(settings) {
  return { market: defaultStream('market', settings?.posts_per_day ?? 2), collective: defaultStream('collective') };
}

/** 'best', or the valid times, unique and sorted (at most 8). */
export function cleanTimes(times) {
  if (!Array.isArray(times)) return 'best';
  const list = [...new Set(times.filter(isTime))].sort();
  return list.length ? list.slice(0, MAX_PER_DAY) : 'best';
}

export function normalizeStream(key, raw) {
  const base = defaultStream(key);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const allowed = STREAMS[key].platforms;
  const platforms = Object.fromEntries(allowed.map((p) => [p, raw.platforms && typeof raw.platforms === 'object' && p in raw.platforms ? raw.platforms[p] === true : base.platforms[p] === true]));
  return {
    enabled: raw.enabled !== false,
    posts_per_day: clampInt(raw.posts_per_day, 0, MAX_PER_DAY, base.posts_per_day),
    days: Array.isArray(raw.days) ? [...new Set(raw.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b) : [...ALL_DAYS],
    times: cleanTimes(raw.times),
    platforms,
  };
}

/** null for "no schedule" (the original autopilot), else both streams with every key filled in. */
export function normalizeSchedule(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return { market: normalizeStream('market', raw.market), collective: normalizeStream('collective', raw.collective) };
}

/** The platforms a stream posts to, in a fixed order. */
export const activePlatforms = (key, st) => STREAMS[key].platforms.filter((p) => st?.platforms?.[p]);

/** Does this stream get any posts at all? */
export const streamActive = (key, st) => !!st && st.enabled && st.posts_per_day > 0 && st.days.length > 0 && activePlatforms(key, st).length > 0;

/** What is wrong with a stream as typed (for the editor; an empty list means it can be saved). */
export function streamProblems(key, st) {
  const out = [];
  if (!st.enabled || st.posts_per_day === 0) return out;
  if (!st.days.length) out.push('Pick at least one day.');
  if (!activePlatforms(key, st).length) out.push('Pick at least one platform.');
  if (Array.isArray(st.times)) {
    const typed = st.times;
    if (typed.length !== st.posts_per_day) out.push(`Set ${st.posts_per_day} ${st.posts_per_day === 1 ? 'time' : 'times'}, one per post.`);
    if (typed.some((t) => !isTime(t))) out.push('Every time needs an hour and minutes.');
    else if (new Set(typed).size !== typed.length) out.push('Two posts are set for the same time.');
  }
  return out;
}

/** Times as the editor holds them, made ready to save: unique and sorted. */
export const sortTimes = (times) => [...new Set(times)].sort();

/** The Marketplace posts a day the rest of the Studio should aim for (0 when its stream is off). */
export function marketPerDay(settings) {
  const sched = normalizeSchedule(settings?.schedule);
  if (!sched) return clampInt(settings?.posts_per_day, 1, MAX_PER_DAY, 2);
  return streamActive('market', sched.market) ? sched.market.posts_per_day : 0;
}

/** The weekdays the Marketplace posts on (every day without a schedule). */
export function marketDays(settings) {
  const sched = normalizeSchedule(settings?.schedule);
  return sched ? sched.market.days : [...ALL_DAYS];
}

// ── Words ──

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first, the way people say a week

/** [1,2,3,4,5,6] -> 'Mon-Sat'; [1,3,5] -> 'Mon, Wed, Fri'; all -> 'every day'. */
export function dayRange(days) {
  const set = new Set(days);
  if (set.size === 7) return 'every day';
  if (!set.size) return 'no days';
  const runs = [];
  let run = [];
  for (const d of ORDER) {
    if (set.has(d)) run.push(d);
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs.map((r) => (r.length >= 3 ? `${DAY_NAMES[r[0]]}-${DAY_NAMES[r[r.length - 1]]}` : r.map((d) => DAY_NAMES[d]).join(', '))).join(', ');
}

export const joinWords = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

/** 'Marketplace: 3 posts a day, Mon-Sat at 12:30 PM, 3:00 PM, 7:30 PM on Instagram and Facebook' */
export function describeStream(key, st) {
  const label = STREAMS[key].label;
  if (!st || !st.enabled) return `${label}: off`;
  if (st.posts_per_day === 0) return `${label}: no posts`;
  const n = st.posts_per_day;
  const when = st.days.length === 7 ? 'every day' : dayRange(st.days);
  const at = Array.isArray(st.times) ? `at ${st.times.map(timeLabel).join(', ')}` : 'at the best times';
  const on = activePlatforms(key, st).map((p) => PLATFORM_LABEL[p]);
  return `${label}: ${n} ${n === 1 ? 'post' : 'posts'} a day, ${when} ${at}${on.length ? ` on ${joinWords(on)}` : ' (no platform chosen)'}`;
}

/** One line per stream, or the original autopilot in words when there is no schedule. */
export function describeSchedule(settings) {
  const sched = normalizeSchedule(settings?.schedule);
  if (!sched) {
    const n = clampInt(settings?.posts_per_day, 1, MAX_PER_DAY, 2);
    return [`Marketplace: ${n} ${n === 1 ? 'post' : 'posts'} a day, every day at the best times on Instagram and Facebook`, 'Collective: not drafted by the autopilot'];
  }
  return STREAM_KEYS.map((k) => describeStream(k, sched[k]));
}

// ── Planning (pure: no clock, no network) ──

export const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const weekday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
const niceDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / DAY);

// The autopilot's good times, Eastern, best first (the first four or five are the original list).
const LEGACY_SLOTS = { wk: ['12:30', '19:30', '15:00', '21:00', '09:00'], sat: ['13:00', '20:00', '16:00', '10:30'], sun: ['13:00', '19:30', '16:00', '09:30'] };
const WIDE_SLOTS = {
  wk: ['12:30', '19:30', '15:00', '21:00', '09:00', '17:00', '11:00', '07:30'],
  sat: ['13:00', '20:00', '16:00', '10:30', '18:00', '12:00', '21:30', '08:30'],
  sun: ['13:00', '19:30', '16:00', '09:30', '18:00', '11:30', '21:00', '08:00'],
};
const optionsFor = (table, wd) => (wd === 6 ? table.sat : wd === 0 ? table.sun : table.wk);

/** The best free time on a day: the first good time far enough from the taken ones, else the farthest. */
function pickBest(opts, taken, gap, unique) {
  const ok = opts.find((t) => taken.every((x) => Math.abs(x - toMinutes(t)) >= gap));
  if (ok) return ok;
  const pool = unique ? opts.filter((t) => !taken.includes(toMinutes(t))) : opts;
  const far = (t) => Math.min(...taken.map((x) => Math.abs(x - toMinutes(t))), 1e9);
  return [...(pool.length ? pool : opts)].sort((a, b) => far(b) - far(a))[0];
}

/**
 * The original autopilot plan, unchanged: the first day (within 60) with fewer than posts_per_day
 * posts; nothing when that is more than lead_days away (unless forced); then days_per_batch days
 * from there, each topped up at the good times at least 2.5 hours from what is already booked.
 *   byDay: Map 'YYYY-MM-DD' -> [minutes after midnight Eastern] of the booked posts
 *   today: 'YYYY-MM-DD' Eastern; settings: { posts_per_day, days_per_batch, lead_days }
 */
export function planLegacy({ byDay, today, settings: s, force = false }) {
  let first = null;
  for (let i = 1; i <= 60; i += 1) { const d = addDays(today, i); if ((byDay.get(d) || []).length < s.posts_per_day) { first = d; break; } }
  if (!first) return { first: null, slots: [], reason: 'The next two months are full.' };
  const lead = daysBetween(today, first);
  if (!force && lead > s.lead_days) return { first, slots: [], reason: `The calendar is full until ${niceDay(first)} (more than ${s.lead_days} days away).` };
  const slots = [];
  for (let i = 0; i < s.days_per_batch; i += 1) {
    const day = addDays(first, i);
    const taken = [...(byDay.get(day) || [])];
    const opts = optionsFor(LEGACY_SLOTS, weekday(day));
    for (let n = taken.length; n < s.posts_per_day; n += 1) {
      const pick = pickBest(opts, taken, 150, false);
      taken.push(toMinutes(pick));
      slots.push({ day, hm: pick });
    }
  }
  slots.sort((a, b) => (a.day + a.hm).localeCompare(b.day + b.hm));
  return { first, slots, reason: '' };
}

/** Set times not already covered by a booked post (one within 45 minutes covers a time). */
export function freeTimes(times, taken) {
  const left = [...times];
  for (const x of [...taken].sort((a, b) => a - b)) {
    let best = -1;
    left.forEach((t, i) => { const d = Math.abs(toMinutes(t) - x); if (d <= 45 && (best < 0 || d < Math.abs(toMinutes(left[best]) - x))) best = i; });
    if (best >= 0) left.splice(best, 1);
  }
  return left;
}

/**
 * One brand stream: the first chosen weekday (within 60 days) with fewer than its posts a day; then
 * days_per_batch days from there, skipping weekdays not chosen, each topped up at its set times
 * (or the good times, spaced to fit up to 8 a day).
 */
export function planStream({ byDay, today, stream: st, daysPerBatch, leadDays, force = false }) {
  const want = st.posts_per_day;
  const on = new Set(st.days);
  let first = null;
  for (let i = 1; i <= 60; i += 1) {
    const d = addDays(today, i);
    if (on.has(weekday(d)) && (byDay.get(d) || []).length < want) { first = d; break; }
  }
  if (!first) return { first: null, slots: [], reason: 'The next two months are full.' };
  if (!force && daysBetween(today, first) > leadDays) return { first, slots: [], reason: `The calendar is full until ${niceDay(first)} (more than ${leadDays} days away).` };
  const gap = Math.min(150, Math.floor(780 / Math.max(1, want - 1)));
  const slots = [];
  for (let i = 0; i < daysPerBatch; i += 1) {
    const day = addDays(first, i);
    if (!on.has(weekday(day))) continue;
    const taken = [...(byDay.get(day) || [])];
    let need = want - taken.length;
    if (need <= 0) continue;
    if (Array.isArray(st.times)) {
      for (const hm of freeTimes(st.times, taken).slice(0, need)) { taken.push(toMinutes(hm)); slots.push({ day, hm }); need -= 1; }
    }
    const opts = optionsFor(WIDE_SLOTS, weekday(day));
    for (; need > 0; need -= 1) {
      const pick = pickBest(opts, taken, gap, true);
      taken.push(toMinutes(pick));
      slots.push({ day, hm: pick });
    }
  }
  slots.sort((a, b) => (a.day + a.hm).localeCompare(b.day + b.hm));
  return { first, slots, reason: '' };
}

/**
 * Which booked posts count toward each stream's posts a day.
 *   entries: [{ day, minutes, workspace: 'market' | 'collective', platforms: ['instagram', ...] }]
 * Marketplace: posts in the market Zernio workspace on Instagram or Facebook (Google Business posts
 * do not count); when the Marketplace posts only to TikTok, its TikTok-only posts in the collective
 * workspace instead. Collective: posts in the collective workspace that are not TikTok-only (the
 * TikTok there is the Market's).
 */
export function streamBuckets(entries, schedule) {
  const meta = (st) => st?.platforms?.instagram || st?.platforms?.facebook;
  const isMarket = (e) => (meta(schedule?.market)
    ? e.workspace === 'market' && e.platforms.some((p) => p === 'instagram' || p === 'facebook')
    : e.workspace === 'collective' && e.platforms.length > 0 && e.platforms.every((p) => p === 'tiktok'));
  const isCollective = (e) => e.workspace === 'collective' && (!e.platforms.length || e.platforms.some((p) => p !== 'tiktok'));
  const out = { market: new Map(), collective: new Map() };
  for (const e of entries) {
    if (isMarket(e)) out.market.set(e.day, [...(out.market.get(e.day) || []), e.minutes]);
    if (isCollective(e)) out.collective.set(e.day, [...(out.collective.get(e.day) || []), e.minutes]);
  }
  return out;
}

/**
 * The whole batch under a schedule: each active stream planned on its own counts, merged by time.
 *   byStream: { market: Map, collective: Map } (a stream left out could not be read: it is skipped)
 *   settings: { days_per_batch, lead_days }; schedule: normalized
 * Returns { first, slots: [{ day, hm, brand }], reason, notes }.
 */
export function planSchedule({ byStream, today, settings, schedule, force = false }) {
  const slots = [];
  const notes = [];
  for (const key of STREAM_KEYS) {
    const st = schedule[key];
    if (!streamActive(key, st)) continue;
    const label = STREAMS[key].label;
    if (!byStream[key]) { notes.push(`${label}: its scheduled posts could not be read, so none were drafted.`); continue; }
    const r = planStream({ byDay: byStream[key], today, stream: st, daysPerBatch: settings.days_per_batch, leadDays: settings.lead_days, force });
    if (r.slots.length) slots.push(...r.slots.map((x) => ({ ...x, brand: key })));
    else notes.push(`${label}: ${r.reason}`);
  }
  slots.sort((a, b) => (a.day + a.hm).localeCompare(b.day + b.hm) || STREAM_KEYS.indexOf(a.brand) - STREAM_KEYS.indexOf(b.brand));
  const reason = slots.length ? '' : (notes.join(' ') || 'Both brands are off in the posting schedule.');
  return { first: slots[0]?.day || null, slots, reason, notes };
}
