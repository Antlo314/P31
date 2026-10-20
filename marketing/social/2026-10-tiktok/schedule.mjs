// Schedules the TikTok videos in plan.mjs (built by build.mjs) on the Market's TikTok through Zernio.
// The TikTok lives in the Collective's Zernio workspace, so this uses ZERNIO_COLLECTIVE_API_KEY only (never
// the Market key). It finds the account with GET /accounts (no hard-coded ids), checks its connection (health)
// and what TikTok allows for it (creator-info), uploads each video and creates one scheduled post per video.
// Safe to re-run: uploads and created posts are recorded in state.json; posts already there are skipped.
//   node schedule.mjs --dry               shows the account, its connection, its TikTok settings and every post,
//                                         and asks Zernio to validate each one (dryRun: true) without creating
//                                         it. Nothing is uploaded: the check uses placeholder media links
//   node schedule.mjs --dry --upload      the same check with the real files (they are uploaded, and the real
//                                         run reuses them)
//   node schedule.mjs --account=<id>      schedules every post that is not in state.json yet. The first real run
//                                         needs the account id that --dry prints, so nothing lands on the wrong
//                                         TikTok; later runs use the one in state.json
//   node schedule.mjs tt03 tt07           only these posts (id prefixes)
//   --brand-label                         sends TikTok's "Your brand" label on the posts plan.mjs marks promo
//   --cover-image                         sends out/<id>-cover.jpg as the cover image (see Covers below)
// The key comes from the environment or ../../../.env.local and is never printed.
// Covers: by default TikTok takes the cover from the video itself, at the moment out/manifest.json records
// (coverMs, the same frame as out/<id>-cover.jpg), so there is no cover file to upload or expire. With
// --cover-image the JPG is uploaded instead; Zernio only documents copying a post's media files to permanent
// storage, and uploads are deleted after 7 days, so in that mode a post is only scheduled when it publishes
// within 6 days of its cover upload, and the rest wait for a later run (the script says when).
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTS, TIMEZONE, CALENDAR, problems } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const FLAGS = ['--dry', '--upload', '--cover-image', '--brand-label'];
const unknown = args.filter((a) => a.startsWith('--') && !FLAGS.includes(a) && !a.startsWith('--account='));
const dry = args.includes('--dry');
const placeholders = dry && !args.includes('--upload');
const coverImage = args.includes('--cover-image');
const brandLabel = args.includes('--brand-label');
const accountArg = args.find((a) => a.startsWith('--account='))?.split('=')[1];
const only = args.filter((a) => !a.startsWith('--'));
const todo = POSTS.filter((p) => !only.length || only.some((o) => p.id.startsWith(o)));

const DAY = 864e5;
const UPLOAD_DAYS = 6; // Zernio deletes an upload after 7 days unless a post that uses it was created first

/** A refusal: printed without a stack trace, exit code 1. (No process.exit: on Windows, Node 24 can crash
 *  when it exits while a fetch connection is still closing.) */
class Stop extends Error {}
const stop = (...lines) => { throw new Stop(lines.join('\n')); };

const envFile = join(here, '../../../.env.local');
const fromFile = existsSync(envFile) ? readFileSync(envFile, 'utf8').match(/^ZERNIO_COLLECTIVE_API_KEY=(.*)$/m)?.[1].trim().replace(/^["']|["']$/g, '') : '';
const KEY = process.env.ZERNIO_COLLECTIVE_API_KEY || fromFile;

const Z = 'https://zernio.com/api/v1';
const stateFile = join(here, 'state.json');
const state = { account: null, uploads: {}, posts: {}, ...(existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {}) };
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));
const manifestFile = join(here, 'out/manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};

const api = async (path, init = {}) => {
  const res = await fetch(Z + path, { ...init, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path.split('?')[0]} → ${res.status}: ${text.slice(0, 400)}`);
  return { status: res.status, body: text ? JSON.parse(text) : {} };
};

/** A local Eastern time ("2026-10-23T12:30:00") as a real instant, daylight saving included. */
function instantOf(local, tz = TIMEZONE) {
  const [d, t] = local.split('T'); const [y, m, day] = d.split('-').map(Number); const [hh, mm, ss = 0] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm, ss);
  const offsetAt = (ms) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
  };
  return new Date(guess - offsetAt(guess - offsetAt(guess)));
}
const eastern = (ms) => new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));

// Uploads are reused while the file is unchanged and the upload is young enough: under six days old when a
// post that uses it as media is created now, or (a --cover-image cover, which the post only names in its
// TikTok settings) under six days old on the day the post publishes.
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
function reusable(rel, until = Date.now()) {
  const had = state.uploads[rel];
  return had && had.sha256 === sha(join(here, rel)) && until - Date.parse(had.at) < UPLOAD_DAYS * DAY ? had.url : null;
}
async function upload(rel, contentType, until) {
  const ready = reusable(rel, until);
  if (ready) return ready;
  if (placeholders) return `https://p31market.com/tiktok-dry-run/${rel.split('/').pop()}`;
  const file = join(here, rel);
  const { body } = await api('/media/presign', { method: 'POST', body: JSON.stringify({ filename: `p31-${rel.split('/').pop()}`, contentType, size: statSync(file).size }) });
  const put = await fetch(body.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: readFileSync(file) });
  if (!put.ok) throw new Error(`upload ${rel} → ${put.status}: ${(await put.text()).slice(0, 200)}`);
  state.uploads[rel] = { url: body.publicUrl, sha256: sha(file), at: new Date().toISOString() };
  save();
  console.log(`  uploaded ${rel}`);
  return body.publicUrl;
}

async function main() {
  if (unknown.length) stop(`Unknown option ${unknown.join(', ')} (known: ${FLAGS.join(', ')}, --account=<id>). Nothing was uploaded or scheduled.`);
  if (!KEY) {
    stop('ZERNIO_COLLECTIVE_API_KEY is not set. The Market TikTok lives in the Collective Zernio workspace, so its key is needed',
      '(the Market key ZERNIO_API_KEY cannot reach it). Add a line ZERNIO_COLLECTIVE_API_KEY=... to .env.local at the',
      'repo root, or set it in the environment for this run, then try again. Nothing was uploaded or scheduled.');
  }

  // 1. The copy, the files and the times, before anything touches Zernio.
  const wrong = todo.flatMap((p) => problems(p).map((x) => `${p.id}: ${x}`));
  if (wrong.length) stop(`Fix the copy in plan.mjs first:\n  ${wrong.join('\n  ')}`);
  const missing = todo.flatMap((p) => [`out/${p.id}.mp4`, ...(coverImage ? [`out/${p.id}-cover.jpg`] : [])]).filter((f) => !existsSync(join(here, f)))
    .concat(todo.filter((p) => !manifest[p.id]?.coverMs).map((p) => `out/manifest.json entry for ${p.id}`));
  if (missing.length) stop(`Missing (run node build.mjs first): ${missing.join(', ')}`);
  const soon = Date.now() + 10 * 60 * 1000;
  const past = todo.filter((p) => !state.posts[p.id] && instantOf(p.when).getTime() < soon);
  if (past.length) {
    stop(`These times are in the past or less than 10 minutes away (Zernio would publish them at once): ${past.map((p) => `${p.id} (${p.label} ET)`).join(', ')}.`,
      'Change their "when" in plan.mjs, or leave them out by naming the posts to schedule. Nothing was uploaded or scheduled.');
  }
  const waiting = coverImage ? todo.filter((p) => !state.posts[p.id] && instantOf(p.when).getTime() - Date.now() >= UPLOAD_DAYS * DAY) : [];
  if (waiting.length) {
    console.log(`With --cover-image these wait for a later run, so their cover is still uploaded when they publish:\n  ${waiting
      .map((p) => `${p.id} (${p.label} ET): run again after ${eastern(instantOf(p.when).getTime() - UPLOAD_DAYS * DAY)} ET`).join('\n  ')}`);
  }
  const run = todo.filter((p) => !waiting.includes(p));
  const pending = run.filter((p) => !state.posts[p.id]);
  for (const p of run.filter((x) => state.posts[x.id])) console.log(`skip ${p.id} (already scheduled: ${state.posts[p.id]})`);
  if (!pending.length) { console.log('Nothing to schedule in this run.'); return; }

  // 2. The TikTok account in the Collective workspace, and whether it can post.
  const { body: list } = await api('/accounts');
  const tiktoks = (list.accounts || []).filter((a) => a.platform === 'tiktok');
  const want = accountArg || state.account;
  let account = want ? tiktoks.find((a) => a._id === want) : null;
  if (want && !account) stop(`No TikTok account ${want}${accountArg ? '' : ' (the one state.json was made for)'} in this workspace. TikTok accounts here: ${tiktoks.map((a) => `@${a.username} (${a._id})`).join(', ') || 'none'}`);
  if (!account) {
    if (tiktoks.length !== 1) stop(tiktoks.length ? `This workspace has ${tiktoks.length} TikTok accounts; choose one with --account=<id>:\n  ${tiktoks.map((a) => `@${a.username} · ${a.displayName || ''} · ${a._id}`).join('\n  ')}` : 'No TikTok account is connected in the Collective Zernio workspace.');
    [account] = tiktoks;
  }
  console.log(`TikTok account: @${account.username}${account.displayName ? ` (${account.displayName})` : ''} · id ${account._id} · ${account.tiktokAccountType || 'type unknown'}`);
  if (account.isActive === false || account.needsReconnection) stop('This TikTok needs reconnecting in Zernio (Collective workspace) before anything can be posted to it. Nothing was uploaded or scheduled.');
  if (state.account && state.account !== account._id) stop(`state.json was made for account ${state.account}; this run would use ${account._id}. Check before going on.`);
  if (!dry && !state.account && !accountArg) {
    stop(`First real run: check that @${account.username} is the Market's TikTok (the website links @p31marketplace),`,
      `then run again with --account=${account._id}. Nothing was uploaded or scheduled.`);
  }
  let lane = null;
  try {
    const { body: h } = await api(`/accounts/${account._id}/health`);
    lane = h.integrationLane || null;
    const how = { business: 'TikTok for Business app', developer: 'TikTok developer app' }[lane] || 'connection type not reported';
    console.log(`Connection: ${h.status || '?'} · ${how} · can post: ${h.permissions?.canPost ?? '?'}${h.issues?.length ? ` · ${h.issues.join(' | ')}` : ''}`);
    if (h.permissions?.canPost === false || h.status === 'error') stop(`Zernio says this TikTok cannot post right now${h.recommendations?.length ? `: ${h.recommendations.join(' | ')}` : ''}. Nothing was uploaded or scheduled.`);
  } catch (e) {
    if (e instanceof Stop) throw e;
    console.log(`Connection: no health report (${e.message})`);
  }

  // 3. What TikTok allows this creator: privacy levels, the comment, duet and stitch switches, the labels.
  const { body: info } = await api(`/accounts/${account._id}/tiktok/creator-info?mediaType=video`);
  const levels = (info.privacyLevels || []).map((x) => x.value || x);
  const allowed = info.postingLimits?.interactionSettings || {};
  const labels = (info.commercialContentTypes || []).map((x) => (typeof x === 'string' ? { value: x } : x));
  console.log(`Creator: ${info.creator?.nickname || '?'} · can post more now: ${info.creator?.canPostMore ?? '?'} · longest video ${info.postingLimits?.maxVideoDurationSec ?? '?'} s`);
  console.log(`Privacy levels allowed: ${levels.join(', ') || 'none listed'}`);
  console.log(`Comments ${allowed.allow_comment?.enabled === false ? 'off' : 'on'} · duets ${allowed.allow_duet?.enabled === false ? 'off' : 'on'} · stitches ${allowed.allow_stitch?.enabled === false ? 'off' : 'on'} (as the creator has them in the TikTok app)`);
  console.log(`Commercial content labels: ${labels.map((x) => `${x.value}${x.label ? ` (${x.label})` : ''}`).join(', ') || 'none listed'}`);
  if (!levels.includes('PUBLIC_TO_EVERYONE')) stop('PUBLIC_TO_EVERYONE is not allowed for this account, so these posts would not be public. Nothing was uploaded or scheduled.');
  const longest = Math.max(...pending.map((p) => manifest[p.id].seconds));
  if (info.postingLimits?.maxVideoDurationSec && info.postingLimits.maxVideoDurationSec < longest) stop(`This account only takes videos up to ${info.postingLimits.maxVideoDurationSec} s; the longest here runs ${longest} s.`);
  const promos = pending.filter((p) => p.promo).map((p) => p.id);
  if (brandLabel && !labels.some((x) => x.value === 'brand_organic')) stop('This account does not offer TikTok\'s "Your brand" label (brand_organic). Run without --brand-label. Nothing was uploaded or scheduled.');
  if (promos.length) {
    console.log(brandLabel ? `"Your brand" label on: ${promos.join(', ')}`
      : `No label: ${promos.join(', ')} ${promos.length === 1 ? 'promotes a P31 offer' : 'promote P31 offers'}, which TikTok asks to be labelled "Your brand". Add --brand-label to send it (the user's call).`);
  }
  console.log(coverImage
    ? `Covers: out/<id>-cover.jpg sent as the cover image${lane === 'developer' ? '. On this connection Zernio stitches it in as the first frame of the video (a one-frame flash before the intro)' : ''}`
    : 'Covers: the frame of each video at its coverMs (what out/<id>-cover.jpg shows); no cover files are uploaded');

  // 4. The files: uploaded once, reused from state.json while they are still good.
  const files = pending.flatMap((p) => [[`out/${p.id}.mp4`, Date.now()], ...(coverImage ? [[`out/${p.id}-cover.jpg`, instantOf(p.when).getTime()]] : [])]);
  const toSend = files.filter(([rel, until]) => !reusable(rel, until));
  if (toSend.length) {
    const mb = toSend.reduce((n, [rel]) => n + statSync(join(here, rel)).size, 0) / 1e6;
    console.log(placeholders
      ? `Dry run: nothing is uploaded; ${toSend.length} file(s) are checked with placeholder links (add --upload to check with the real files).`
      : `Uploading ${toSend.length} file(s), ${mb.toFixed(1)} MB, to Zernio (kept there 7 days; later runs reuse them).`);
  }

  // 5. One post per video.
  const settings = (p, cover) => ({
    privacy_level: 'PUBLIC_TO_EVERYONE',
    allow_comment: allowed.allow_comment?.enabled !== false,
    allow_duet: allowed.allow_duet?.enabled !== false,
    allow_stitch: allowed.allow_stitch?.enabled !== false,
    content_preview_confirmed: true,
    express_consent_given: true,
    ...(coverImage ? { video_cover_image_url: cover } : { video_cover_timestamp_ms: manifest[p.id].coverMs }),
    ...(brandLabel && p.promo ? { commercialContentType: 'brand_organic' } : {}),
  });
  let failed = 0;
  for (const p of pending) {
    console.log(`${dry ? 'check' : 'schedule'} ${p.id} · ${p.label} ET · ${[...p.caption].length} characters · cover ${coverImage ? 'image' : `at ${manifest[p.id].coverMs / 1000} s`}`);
    try {
      const url = await upload(`out/${p.id}.mp4`, 'video/mp4', Date.now());
      const cover = coverImage ? await upload(`out/${p.id}-cover.jpg`, 'image/jpeg', instantOf(p.when).getTime()) : null;
      const body = {
        title: `P31 TikTok · ${p.label} · ${p.id}`,
        content: p.caption,
        mediaItems: [{ type: 'video', url }],
        platforms: [{ platform: 'tiktok', accountId: account._id }],
        scheduledFor: p.when,
        timezone: TIMEZONE,
        tiktokSettings: settings(p, cover),
        metadata: { calendar: CALENDAR, postId: p.id, template: p.template, style: p.style, music: p.music },
        ...(dry ? { dryRun: true } : {}),
      };
      if (dry) {
        const { body: v } = await api('/posts', { method: 'POST', body: JSON.stringify(body) });
        const t = (v.tiktok || [])[0] || {};
        console.log(`  Zernio: ${v.canPublish ? 'can publish' : 'can NOT publish'}${t.reason ? ` · ${t.reason}` : ''}`);
        if (!v.canPublish) failed += 1;
        continue;
      }
      const { status, body: res } = await api('/posts', { method: 'POST', headers: { 'Idempotency-Key': `${CALENDAR}-${p.id}` }, body: JSON.stringify(body) });
      const id = res.post?._id || res.post?.id || res._id || res.id;
      state.account = account._id;
      state.posts[p.id] = id || 'created';
      save();
      if (status === 207 || ['failed', 'partial'].includes(res.post?.status)) { failed += 1; console.error(`  created ${id} but Zernio says ${res.post?.status}: ${res.error || res.message || ''}`); continue; }
      console.log(`  scheduled for ${p.label} ET → ${id}${res.post?.status ? ` (${res.post.status})` : ''}${res.warnings?.length ? ` · warnings: ${res.warnings.join(' | ')}` : ''}`);
    } catch (e) {
      failed += 1;
      console.error(`  ${p.id} failed: ${e.message}${placeholders && dry ? ' (this dry run used placeholder media links; --dry --upload checks with the real files)' : ''}`);
    }
  }
  console.log(dry ? `dry run done: nothing was created${failed ? `, ${failed} post(s) need attention` : ''}` : `done${failed ? `: ${failed} post(s) need attention` : ''}`);
  if (waiting.length) console.log(`${waiting.length} post(s) wait for a later run (listed at the top).`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e instanceof Stop ? e.message : `Stopped: ${e.message}`); process.exitCode = 1; });
