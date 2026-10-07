// Uploads this folder's media to Zernio and schedules every post in plan.json
// to Instagram + Facebook. Safe to re-run: uploads and created posts are
// recorded in state.json and skipped the second time.
//   node schedule.mjs            (reads ZERNIO_API_KEY from ../../../.env.local)
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, '../../../.env.local');
const KEY = process.env.ZERNIO_API_KEY
  || readFileSync(envFile, 'utf8').match(/^ZERNIO_API_KEY=(.+)$/m)?.[1].trim();
if (!KEY) throw new Error('ZERNIO_API_KEY not found');

const Z = 'https://zernio.com/api/v1';
const plan = JSON.parse(readFileSync(join(here, 'plan.json'), 'utf8'));
const stateFile = join(here, 'state.json');
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { uploads: {}, posts: {} };
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));

const api = async (path, init = {}) => {
  const res = await fetch(Z + path, { ...init, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
};

const TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
async function upload(rel) {
  if (state.uploads[rel]) return state.uploads[rel];
  const file = join(here, rel);
  const contentType = TYPES[rel.slice(rel.lastIndexOf('.'))];
  const { uploadUrl, publicUrl } = await api('/media/presign', {
    method: 'POST', body: JSON.stringify({ filename: `p31-${basename(rel)}`, contentType, size: statSync(file).size }),
  });
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: readFileSync(file) });
  if (!put.ok) throw new Error(`upload ${rel} → ${put.status}: ${(await put.text()).slice(0, 200)}`);
  state.uploads[rel] = publicUrl;
  save();
  console.log(`uploaded ${rel}`);
  return publicUrl;
}

for (const p of plan.posts) {
  if (state.posts[p.id]) { console.log(`skip ${p.id} (already scheduled: ${state.posts[p.id]})`); continue; }
  const url = await upload(p.media.file);
  const cover = p.media.cover ? await upload(p.media.cover) : null;
  const item = { type: p.media.type, url, altText: p.alt, ...(cover ? { thumbnail: cover, instagramThumbnail: cover } : {}) };
  const body = {
    title: `P31 · ${p.theme}`,
    content: p.instagram,
    mediaItems: [item],
    platforms: [
      { platform: 'instagram', accountId: plan.accounts.instagram, customContent: p.instagram,
        ...(cover ? { platformSpecificData: { instagramThumbnail: cover, shareToFeed: true } } : {}) },
      { platform: 'facebook', accountId: plan.accounts.facebook, customContent: p.facebook },
    ],
    scheduledFor: p.when,
    timezone: plan.timezone,
    metadata: { calendar: 'p31-2026-10', postId: p.id },
  };
  const res = await api('/posts', { method: 'POST', headers: { 'Idempotency-Key': `p31-2026-10-${p.id}` }, body: JSON.stringify(body) });
  const id = res.post?._id || res.post?.id || res._id || res.id;
  state.posts[p.id] = id || 'created';
  save();
  console.log(`scheduled ${p.id} for ${p.label} ET → ${id}`);
}
console.log('done');
