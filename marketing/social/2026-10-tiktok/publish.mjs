// Puts the TikTok plan on the site, so the team can watch and schedule it from the Studio (Content Studio →
// Post plans, /studio/plans). Copies every out/<id>.mp4 and out/<id>-cover.jpg that build.mjs made into
// public/social/tiktok-2026-10/ and writes plan.json there: the posts, their Eastern times and captions, the
// video and cover file names, each video's length and its cover moment (coverMs, from out/manifest.json).
// The Studio page uploads each video to Zernio and schedules it through studio-zernio, which holds the
// Collective key; nothing here talks to Zernio.
//   node publish.mjs        after node build.mjs, and again after any copy or video change
// Files of posts no longer in the plan are removed from that folder. The public copies ship with the site;
// the MP4s in out/ stay out of git (.gitignore), the covers and contact sheet stay in.
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POSTS, TIMEZONE, problems } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FOLDER = 'tiktok-2026-10'; // the Studio page lists this name (src/studio/Plans.jsx)
const DEST = join(here, '../../../public/social', FOLDER);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const short = (when) => { const [, m, d] = when.slice(0, 10).split('-').map(Number); return `${MONTHS[m - 1]} ${d}`; };
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

function main() {
  // The copy and the files first: nothing is copied while a caption breaks the house rules or a video is missing.
  const wrong = POSTS.flatMap((p) => problems(p).map((x) => `${p.id}: ${x}`));
  if (wrong.length) throw new Error(`Fix the copy in plan.mjs first:\n  ${wrong.join('\n  ')}`);
  const manifestFile = join(here, 'out/manifest.json');
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
  const missing = POSTS.flatMap((p) => [`out/${p.id}.mp4`, `out/${p.id}-cover.jpg`].filter((f) => !existsSync(join(here, f)))
    .concat(manifest[p.id]?.seconds && Number.isFinite(manifest[p.id]?.coverMs) ? [] : [`out/manifest.json entry for ${p.id}`]));
  if (missing.length) throw new Error(`Missing (run node build.mjs first): ${missing.join(', ')}`);

  mkdirSync(DEST, { recursive: true });
  const keep = new Set(['plan.json']);
  let bytes = 0;
  for (const p of POSTS) {
    for (const name of [`${p.id}.mp4`, `${p.id}-cover.jpg`]) {
      copyFileSync(join(here, 'out', name), join(DEST, name));
      bytes += statSync(join(DEST, name)).size;
      keep.add(name);
    }
  }
  const stale = readdirSync(DEST).filter((f) => !keep.has(f) && /\.(mp4|jpg)$/i.test(f));
  stale.forEach((f) => rmSync(join(DEST, f)));

  const sorted = [...POSTS].sort((a, b) => a.when.localeCompare(b.when));
  const plan = {
    name: `Market TikTok, ${short(sorted[0].when)} to ${short(sorted[sorted.length - 1].when)}`,
    platform: 'tiktok',
    site: 'market',
    timezone: TIMEZONE,
    posts: sorted.map((p) => ({
      id: p.id,
      title: `P31 TikTok · ${p.id}`, // the Studio finds a post already in Zernio by this title
      when: p.when, // Eastern local time
      theme: p.theme,
      caption: p.caption,
      video: `${p.id}.mp4`,
      cover: `${p.id}-cover.jpg`,
      seconds: manifest[p.id].seconds,
      coverMs: manifest[p.id].coverMs,
      promo: !!p.promo,
    })),
  };
  const text = `${JSON.stringify(plan, null, 2)}\n`;
  writeFileSync(join(DEST, 'plan.json'), text);
  console.log(`public/social/${FOLDER}: ${plan.posts.length} posts, ${plan.posts.length * 2} files (${mb(bytes)}), plan.json ${Buffer.byteLength(text)} bytes · ${plan.name}`);
  if (stale.length) console.log(`Removed files no longer in the plan: ${stale.join(', ')}`);
}

try { main(); } catch (e) { console.error(e.message); process.exitCode = 1; }
