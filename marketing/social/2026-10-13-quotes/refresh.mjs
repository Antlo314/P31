// Re-uploads the images of posts that are still waiting to go out and swaps them into their
// scheduled Zernio posts (same captions, accounts and times). Used on 2026-10-14 when the
// curator invitations moved to the new Proverbs 31 Marketplace logo.
//   node refresh.mjs q11 q27 ...        (--dry lists what would change)
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTS, ACCOUNTS, TIMEZONE } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes('--dry');
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const KEY = process.env.ZERNIO_API_KEY || readFileSync(join(here, '../../../.env.local'), 'utf8').match(/^ZERNIO_API_KEY=(.+)$/m)?.[1].trim();
if (!KEY) throw new Error('ZERNIO_API_KEY not found');
const Z = 'https://zernio.com/api/v1';
const stateFile = join(here, 'state.json');
const state = JSON.parse(readFileSync(stateFile, 'utf8'));

const api = async (path, init = {}) => {
  const res = await fetch(Z + path, { ...init, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
};

for (const id of ids) {
  const p = POSTS.find((x) => x.id === id);
  const zid = state.posts[id];
  if (!p || !zid) { console.log(`${id}: not in this calendar`); continue; }
  const { post } = await api(`/posts/${zid}`);
  const live = (post.platforms || []).some((x) => ['published', 'publishing'].includes(x.status)) || ['published', 'publishing'].includes(post.status);
  if (live) { console.log(`${id}: already out (${post.status}), left as it is`); continue; }
  if (dry) { console.log(`${id}: would swap the image on ${p.label}`); continue; }
  const file = join(here, 'out', `${id}.jpg`);
  const { uploadUrl, publicUrl } = await api('/media/presign', { method: 'POST', body: JSON.stringify({ filename: `p31-${id}-v2.jpg`, contentType: 'image/jpeg', size: statSync(file).size }) });
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: readFileSync(file) });
  if (!put.ok) throw new Error(`upload ${id} → ${put.status}`);
  await api(`/posts/${zid}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: `P31 · ${p.label} · ${p.kind} · ${p.id}`, content: p.instagram,
      mediaItems: [{ type: 'image', url: publicUrl, altText: p.alt }],
      platforms: [
        { platform: 'instagram', accountId: ACCOUNTS.instagram, customContent: p.instagram },
        { platform: 'facebook', accountId: ACCOUNTS.facebook, customContent: p.facebook },
      ],
      scheduledFor: p.when, timezone: TIMEZONE,
    }),
  });
  state.uploads[`out/${id}.jpg`] = publicUrl;
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`${id}: new image on ${p.label} ET`);
}
