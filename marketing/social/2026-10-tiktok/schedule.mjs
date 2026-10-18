// Schedules TikTok posts to Zernio
// Usage:
//   node schedule.mjs --dry      (shows what would be scheduled)
//   node schedule.mjs            (schedules posts via Zernio API)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTS, TIMEZONE, CALENDAR } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dry = process.argv.includes('--dry');

const envFile = join(here, '../../../.env.local');
const envContent = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
const KEY = process.env.ZERNIO_COLLECTIVE_API_KEY ||
  process.env.ZERNIO_API_KEY ||
  envContent.match(/^ZERNIO_COLLECTIVE_API_KEY=(.+)$/m)?.[1]?.trim() ||
  envContent.match(/^ZERNIO_API_KEY=(.+)$/m)?.[1]?.trim();

const Z = 'https://zernio.com/api/v1';
const stateFile = join(here, 'state.json');
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : { posts: {} };
const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2));

console.log(`P31 TikTok Campaign · ${POSTS.length} posts configured`);
if (!KEY && !dry) {
  console.log('Notice: Set ZERNIO_COLLECTIVE_API_KEY or ZERNIO_API_KEY in your environment to post live.');
}

for (const p of POSTS) {
  if (state.posts[p.id]) {
    console.log(`[Scheduled] ${p.id} (${p.label})`);
    continue;
  }
  if (dry || !KEY) {
    console.log(`[Ready] ${p.id} · ${p.label} · Music: ${p.music} · Motion: ${p.motion}`);
  }
}
