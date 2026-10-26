// Offline test of the posting schedule planner (src/studio/factory/schedule.js), the code that
// content-autopilot, studio-autocreate, the watchdog and the admin page share. No network, no database.
//   node scripts/test-posting-schedule.mjs
import assert from 'node:assert/strict';
import {
  normalizeSchedule, planLegacy, planSchedule, planStream, streamBuckets, describeStream, describeSchedule,
  streamProblems, marketPerDay, freeTimes, defaultSchedule,
} from '../src/studio/factory/schedule.js';
// generate.js imports './library' without an extension, so Node reads the synced copies (same code).
import { buildPlan } from '../supabase/functions/_shared/factory/generate.js';
import { mergeLibrary } from '../supabase/functions/_shared/factory/library.js';

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`ok - ${name}`); };

// ── The content-autopilot planner as it was before v65 (git 15e4edf), types removed, "today" passed in ──
const TZ = 'America/New_York';
const etParts = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
const etDate = (d) => { const p = etParts(d); return `${p.year}-${p.month}-${p.day}`; };
const minutesOf = (d) => { const p = etParts(d); return (Number(p.hour) % 24) * 60 + Number(p.minute); };
const DAY = 864e5;
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
const nice = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
const SLOTS = { wk: ['12:30', '19:30', '15:00', '21:00', '09:00'], sat: ['13:00', '20:00', '16:00', '10:30'], sun: ['13:00', '19:30', '16:00', '09:30'] };
function oldPlanSlots(posts, s, force, today) {
  const byDay = new Map();
  for (const p of posts) { const d = new Date(p.scheduledFor); const k = etDate(d); byDay.set(k, [...(byDay.get(k) || []), minutesOf(d)]); }
  let first = null;
  for (let i = 1; i <= 60; i += 1) { const d = addDays(today, i); if ((byDay.get(d) || []).length < s.posts_per_day) { first = d; break; } }
  if (!first) return { first: null, slots: [], reason: 'The next two months are full.' };
  const lead = Math.round((new Date(`${first}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / DAY);
  if (!force && lead > s.lead_days) return { first, slots: [], reason: `The calendar is full until ${nice(first)} (more than ${s.lead_days} days away).` };
  const slots = [];
  for (let i = 0; i < s.days_per_batch; i += 1) {
    const day = addDays(first, i);
    const taken = [...(byDay.get(day) || [])];
    const wd = weekday(day);
    const opts = wd === 6 ? SLOTS.sat : wd === 0 ? SLOTS.sun : SLOTS.wk;
    for (let n = taken.length; n < s.posts_per_day; n += 1) {
      const hm = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
      const pick = opts.find((t) => taken.every((x) => Math.abs(x - hm(t)) >= 150))
        || [...opts].sort((a, b) => Math.min(...taken.map((x) => Math.abs(x - hm(b))), 1e9) - Math.min(...taken.map((x) => Math.abs(x - hm(a))), 1e9))[0];
      taken.push(hm(pick));
      slots.push({ day, hm: pick });
    }
  }
  slots.sort((a, b) => (a.day + a.hm).localeCompare(b.day + b.hm));
  return { first, slots, reason: '' };
}
// The new content-autopilot planSlots: the same bucketing, then the shared planLegacy.
const newPlanSlots = (posts, s, force, today) => {
  const byDay = new Map();
  for (const p of posts) { const d = new Date(p.scheduledFor); const k = etDate(d); byDay.set(k, [...(byDay.get(k) || []), minutesOf(d)]); }
  return planLegacy({ byDay, today, settings: s, force });
};

const rng = (seed) => { let x = seed >>> 0 || 1; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };
const TODAY = '2026-10-26'; // a Monday
const at = (day, hm) => new Date(`${day}T${hm}:00-04:00`).toISOString(); // EDT (before Nov 1)

test('null schedule: normalizeSchedule gives null, so the original plan runs', () => {
  for (const v of [null, undefined, 'x', [], 5]) assert.equal(normalizeSchedule(v), null);
  assert.equal(marketPerDay({ posts_per_day: 3, schedule: null }), 3);
  assert.equal(describeSchedule({ posts_per_day: 2, schedule: null })[0], 'Marketplace: 2 posts a day, every day at the best times on Instagram and Facebook');
});

test('null schedule: planLegacy matches the pre-v65 planner on 3000 random calendars', () => {
  const r = rng(31);
  const hms = ['09:00', '10:30', '12:00', '12:30', '13:00', '15:00', '16:00', '19:30', '20:00', '21:00', '07:15', '18:45'];
  for (let c = 0; c < 3000; c += 1) {
    const posts = [];
    const fill = Math.floor(r() * 40);
    for (let i = 0; i < fill; i += 1) posts.push({ scheduledFor: at(addDays(TODAY, 1 + Math.floor(r() * 30)), hms[Math.floor(r() * hms.length)]) });
    const s = { posts_per_day: 1 + Math.floor(r() * 4), days_per_batch: [7, 10, 14, 21, 28][Math.floor(r() * 5)], lead_days: [3, 5, 7, 10, 14][Math.floor(r() * 5)] };
    const force = r() < 0.3;
    assert.deepEqual(newPlanSlots(posts, s, force, TODAY), oldPlanSlots(posts, s, force, TODAY));
  }
});

test('3 a day at set times: sorted, and a booked post covers the time it sits on', () => {
  const sched = normalizeSchedule({ market: { enabled: true, posts_per_day: 3, days: [0, 1, 2, 3, 4, 5, 6], times: ['19:30', '12:30', '15:00'], platforms: { instagram: true, facebook: true } } });
  assert.deepEqual(sched.market.times, ['12:30', '15:00', '19:30']);
  const day1 = addDays(TODAY, 1);
  const byDay = new Map([[day1, [12 * 60 + 15]]]); // a post at 12:15 covers 12:30
  const r = planStream({ byDay, today: TODAY, stream: sched.market, daysPerBatch: 3, leadDays: 7 });
  assert.deepEqual(r.slots, [
    { day: day1, hm: '15:00' }, { day: day1, hm: '19:30' },
    { day: addDays(TODAY, 2), hm: '12:30' }, { day: addDays(TODAY, 2), hm: '15:00' }, { day: addDays(TODAY, 2), hm: '19:30' },
    { day: addDays(TODAY, 3), hm: '12:30' }, { day: addDays(TODAY, 3), hm: '15:00' }, { day: addDays(TODAY, 3), hm: '19:30' },
  ]);
  assert.deepEqual(freeTimes(['12:30', '15:00', '19:30'], [9 * 60]), ['12:30', '15:00', '19:30']); // 9:00 covers none
});

test('skipped weekdays get no posts, and the first gap is a chosen weekday', () => {
  const sched = normalizeSchedule({ market: { posts_per_day: 2, days: [1, 2, 3, 4, 5, 6], times: 'best', platforms: { instagram: true } } });
  // Tue to Sat booked full; Sunday empty but not chosen; so the first gap is next Monday.
  const byDay = new Map();
  for (let i = 1; i <= 5; i += 1) byDay.set(addDays(TODAY, i), [750, 1170]);
  const r = planStream({ byDay, today: TODAY, stream: sched.market, daysPerBatch: 14, leadDays: 7 });
  assert.equal(r.first, addDays(TODAY, 7));
  assert.equal(weekday(r.first), 1);
  assert.ok(r.slots.length > 0);
  assert.ok(r.slots.every((x) => weekday(x.day) !== 0), 'no Sunday posts');
  const perDay = {};
  r.slots.forEach((x) => { perDay[x.day] = (perDay[x.day] || 0) + 1; });
  assert.ok(Object.values(perDay).every((n) => n === 2));
  assert.equal(Object.keys(perDay).length, 12); // 14 days from Monday, less 2 Sundays
});

test('the collective stream is counted and planned on its own', () => {
  const sched = normalizeSchedule({
    market: { posts_per_day: 2, days: [0, 1, 2, 3, 4, 5, 6], platforms: { instagram: true, facebook: true, tiktok: true } },
    collective: { enabled: true, posts_per_day: 1, days: [0, 1, 2, 3, 4, 5, 6], times: ['08:00'], platforms: { instagram: true } },
  });
  const d1 = addDays(TODAY, 1);
  const entries = [
    // Market workspace: two Instagram/Facebook posts fill the Market's day; a Google post does not count.
    { day: d1, minutes: 750, workspace: 'market', platforms: ['instagram', 'facebook'] },
    { day: d1, minutes: 1170, workspace: 'market', platforms: ['instagram'] },
    { day: d1, minutes: 600, workspace: 'market', platforms: ['googlebusiness'] },
    // Collective workspace: the Market TikTok copy of a post does not fill the Collective's day.
    { day: d1, minutes: 750, workspace: 'collective', platforms: ['tiktok'] },
  ];
  const b = streamBuckets(entries, sched);
  assert.deepEqual(b.market.get(d1), [750, 1170]);
  assert.equal(b.collective.get(d1), undefined);
  const plan = planSchedule({ byStream: b, today: TODAY, settings: { days_per_batch: 3, lead_days: 7 }, schedule: sched });
  const on = (brand, day) => plan.slots.filter((x) => x.brand === brand && x.day === day).map((x) => x.hm);
  assert.deepEqual(on('market', d1), []); // full
  assert.deepEqual(on('collective', d1), ['08:00']);
  assert.equal(on('market', addDays(TODAY, 2)).length, 2);
  assert.deepEqual(on('collective', addDays(TODAY, 3)), ['08:00']);
  // A Collective post fills the Collective day without touching the Market count.
  const b2 = streamBuckets([...entries, { day: addDays(TODAY, 2), minutes: 480, workspace: 'collective', platforms: ['instagram'] }], sched);
  assert.deepEqual(b2.collective.get(addDays(TODAY, 2)), [480]);
  assert.equal(b2.market.get(addDays(TODAY, 2)), undefined);
  // An unreadable workspace means that stream is skipped, never drafted blind.
  const blind = planSchedule({ byStream: { market: b.market }, today: TODAY, settings: { days_per_batch: 3, lead_days: 7 }, schedule: sched });
  assert.ok(blind.slots.every((x) => x.brand === 'market'));
  assert.match(blind.notes.join(' '), /Collective: its scheduled posts could not be read/);
});

test('a TikTok-only Marketplace stream is counted from its TikTok posts', () => {
  const sched = normalizeSchedule({ market: { posts_per_day: 1, platforms: { instagram: false, facebook: false, tiktok: true } } });
  const d1 = addDays(TODAY, 1);
  const b = streamBuckets([{ day: d1, minutes: 700, workspace: 'collective', platforms: ['tiktok'] }, { day: d1, minutes: 700, workspace: 'market', platforms: ['instagram'] }], sched);
  assert.deepEqual(b.market.get(d1), [700]);
});

test('8 a day at the best times: 8 different times every day', () => {
  const st = normalizeSchedule({ market: { posts_per_day: 8, times: 'best' } }).market;
  const r = planStream({ byDay: new Map(), today: TODAY, stream: st, daysPerBatch: 7, leadDays: 7 });
  const by = {};
  r.slots.forEach((x) => { (by[x.day] = by[x.day] || []).push(x.hm); });
  assert.equal(Object.keys(by).length, 7);
  Object.values(by).forEach((hms) => { assert.equal(hms.length, 8); assert.equal(new Set(hms).size, 8); });
});

test('off, zero a day and lead days', () => {
  const sched = normalizeSchedule({ market: { posts_per_day: 0 }, collective: { enabled: false } });
  const p = planSchedule({ byStream: { market: new Map(), collective: new Map() }, today: TODAY, settings: { days_per_batch: 14, lead_days: 7 }, schedule: sched });
  assert.equal(p.slots.length, 0);
  assert.equal(p.reason, 'Both brands are off in the posting schedule.');
  assert.equal(marketPerDay({ posts_per_day: 2, schedule: sched }), 0);
  // Full for 10 days and 7 lead days: nothing yet (unless forced).
  const st = normalizeSchedule({ market: { posts_per_day: 1 } }).market;
  const byDay = new Map(Array.from({ length: 10 }, (_, i) => [addDays(TODAY, i + 1), [750]]));
  assert.equal(planStream({ byDay, today: TODAY, stream: st, daysPerBatch: 7, leadDays: 7 }).slots.length, 0);
  assert.equal(planStream({ byDay, today: TODAY, stream: st, daysPerBatch: 7, leadDays: 7, force: true }).slots.length, 7);
});

test('the preview line and the editor checks', () => {
  const sched = normalizeSchedule({ market: { posts_per_day: 3, days: [1, 2, 3, 4, 5, 6], times: ['12:30', '15:00', '19:30'], platforms: { instagram: true, facebook: true, tiktok: false } } });
  assert.equal(describeStream('market', sched.market), 'Marketplace: 3 posts a day, Mon-Sat at 12:30 PM, 3:00 PM, 7:30 PM on Instagram and Facebook');
  assert.equal(describeStream('collective', sched.collective), 'Collective: off');
  assert.equal(describeStream('market', { ...sched.market, days: [1, 3, 5, 6, 0], times: 'best', posts_per_day: 1 }), 'Marketplace: 1 post a day, Mon, Wed, Fri-Sun at the best times on Instagram and Facebook');
  assert.deepEqual(streamProblems('market', { ...sched.market, times: ['12:30', '12:30', '19:30'] }), ['Two posts are set for the same time.']);
  assert.deepEqual(streamProblems('market', { ...sched.market, times: ['12:30'] }), ['Set 3 times, one per post.']);
  assert.deepEqual(streamProblems('market', { ...sched.market, days: [], platforms: {} }), ['Pick at least one day.', 'Pick at least one platform.']);
  assert.deepEqual(defaultSchedule({ posts_per_day: 3 }).market.posts_per_day, 3);
});

test('Auto-create: a weekday-list cadence only drafts on those days', () => {
  const rows = buildPlan({ start: '2026-11-01', days: 14, cadence: [1, 3, 5], mix: { fill: 40, prompt: 30, amen: 10 }, library: mergeLibrary([]), seed: 3 });
  assert.ok(rows.length > 0);
  assert.ok(rows.every((x) => [1, 3, 5].includes(new Date(`${x.post_date}T12:00:00`).getDay())));
});

console.log(`\n${passed} passed`);
