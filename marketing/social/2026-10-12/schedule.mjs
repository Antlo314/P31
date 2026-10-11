// Uploads out/*.jpg to Zernio and schedules every post in plan.mjs to Instagram + Facebook.
// Safe to re-run: uploads and created posts are recorded in state.json and skipped after that.
//   node schedule.mjs            (reads ZERNIO_API_KEY from ../../../.env.local; never prints it)
//   node schedule.mjs --dry      (shows what would be scheduled)
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTS, ACCOUNTS, TIMEZONE, CALENDAR } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes('--dry');
const KEY = process.env.ZERNIO_API_KEY || readFileSync(join(here, '../../../.env.local'), 'utf8').match(/^ZERNIO_API_KEY=(.+)$/m)?.[1].trim();
if (!KEY) throw new Error('ZERNIO_API_KEY not found');

const Z = 'https://zernio.com/api/v1';
const stateFile = join(here, 'state.json');
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { uploads: {}, posts: {} };
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));

const api = async (path, init = {}) => {
  const res = await fetch(Z + path, { ...init, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
};

async function upload(rel) {
  if (state.uploads[rel]) return state.uploads[rel];
  const file = join(here, rel);
  const { uploadUrl, publicUrl } = await api('/media/presign', {
    method: 'POST', body: JSON.stringify({ filename: `p31-${rel.split('/').pop()}`, contentType: 'image/jpeg', size: statSync(file).size }),
  });
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: readFileSync(file) });
  if (!put.ok) throw new Error(`upload ${rel} → ${put.status}: ${(await put.text()).slice(0, 200)}`);
  state.uploads[rel] = publicUrl;
  save();
  console.log(`uploaded ${rel}`);
  return publicUrl;
}

// Alt text for screen readers, per card kind.
const alt = (p) => {
  switch (p.kind) {
    case 'fill': return `Bible fill-in-the-blank: ${p.verse} blank. ${p.ref}.`;
    case 'prompt': return `Finish the sentence: ${p.text} blank.`;
    case 'choice': return `This or that: ${p.question} A, ${p.a}. B, ${p.b}.`;
    case 'quiz': return `P31 pop quiz: ${p.question} ${p.options.map((o, i) => `${'ABCD'[i]}, ${o}`).join('. ')}.`;
    case 'amen': return `Sunday word: ${p.verse} ${p.ref}.`;
    default: return `${p.eyebrow}: ${p.title.replace(/<[^>]+>/g, ' ')}. ${p.items.join('. ')}. ${p.pill}.`;
  }
};

for (const p of POSTS) {
  if (state.posts[p.id]) { console.log(`skip ${p.id} (already scheduled: ${state.posts[p.id]})`); continue; }
  if (dry) { console.log(`would schedule ${p.id} · ${p.label} · ${p.kind}`); continue; }
  const url = await upload(`out/${p.id}.jpg`);
  const body = {
    title: `P31 · ${p.label} · ${p.kind}`,
    content: p.instagram,
    mediaItems: [{ type: 'image', url, altText: alt(p) }],
    platforms: [
      { platform: 'instagram', accountId: ACCOUNTS.instagram, customContent: p.instagram },
      { platform: 'facebook', accountId: ACCOUNTS.facebook, customContent: p.facebook },
    ],
    scheduledFor: p.when,
    timezone: TIMEZONE,
    metadata: { calendar: CALENDAR, postId: p.id, kind: p.kind },
  };
  const res = await api('/posts', { method: 'POST', headers: { 'Idempotency-Key': `${CALENDAR}-${p.id}` }, body: JSON.stringify(body) });
  const id = res.post?._id || res.post?.id || res._id || res.id;
  state.posts[p.id] = id || 'created';
  save();
  console.log(`scheduled ${p.id} for ${p.label} ET → ${id}`);
}
console.log(dry ? 'dry run done' : 'done');
