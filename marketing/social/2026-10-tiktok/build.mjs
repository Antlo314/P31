// Draws every post in plan.mjs as a TikTok video: 1080×1920, 8 to 15 seconds, the Design studio's own music,
// H.264 + AAC MP4 in out/<id>.mp4, plus the finished frame as out/<id>-cover.jpg. Then checks every file
// with ffprobe, tiles the covers into out/contact-sheet.jpg and writes review.html (video, cover, time, caption).
// The cover is the video's own frame half a second before the end; out/manifest.json records each video's
// length and that moment (coverMs) for schedule.mjs.
// Needs the dev server (npm run dev -- --port 5180): render.html runs the engine in Chrome.
//   node build.mjs                every post
//   node build.mjs tt03 tt07      only these (id prefixes), e.g. after a copy change
//   node build.mjs --covers       covers only, no videos (quick look at the layouts)
// P31_BASE, CHROME_PATH and FFMPEG_DIR override the defaults.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { POSTS, problems } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '../../..');
const OUT = join(here, 'out');
const puppeteer = createRequire(join(ROOT, 'package.json'))('puppeteer-core');
const BASE = process.env.P31_BASE || 'http://localhost:5180';
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
const FF = process.env.FFMPEG_DIR || 'C:/ffmpeg/bin';
const ffmpeg = (args) => execFileSync(join(FF, 'ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const args = process.argv.slice(2);
const coversOnly = args.includes('--covers');
const only = args.filter((a) => !a.startsWith('--'));
const todo = POSTS.filter((p) => !only.length || only.some((o) => p.id.startsWith(o)));
mkdirSync(OUT, { recursive: true });

// The copy first: nothing is drawn while a caption breaks the house rules.
const wrong = POSTS.flatMap((p) => problems(p).map((x) => `${p.id}: ${x}`));
if (wrong.length) { console.error(`Fix the copy in plan.mjs first:\n  ${wrong.join('\n  ')}`); process.exit(1); }

/** Codec, size, frame rate and length of a video (ffprobe), and whether TikTok will take it as it is. */
function probe(file) {
  const j = JSON.parse(execFileSync(join(FF, 'ffprobe'), ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,sample_rate,channels:format=duration,size', '-of', 'json', file]).toString());
  const v = j.streams.find((s) => s.codec_type === 'video') || {}; const a = j.streams.find((s) => s.codec_type === 'audio') || {};
  const [n, d] = String(v.r_frame_rate || '0/1').split('/').map(Number);
  const r = { video: v.codec_name, size: `${v.width}x${v.height}`, pix: v.pix_fmt, fps: Math.round((n / (d || 1)) * 100) / 100, audio: a.codec_name, rate: Number(a.sample_rate), channels: a.channels, seconds: Math.round(Number(j.format.duration) * 100) / 100, mb: Math.round(Number(j.format.size) / 1e4) / 100 };
  r.ok = r.video === 'h264' && r.size === '1080x1920' && r.pix === 'yuv420p' && r.audio === 'aac' && r.seconds >= 3 && r.seconds <= 60;
  return r;
}

/** Re-encode anything that is not already H.264 + AAC in yuv420p (e.g. WebM from the browser's fallback). */
function transcode(src, dest) {
  const tmp = `${dest}.tmp.mp4`;
  ffmpeg(['-i', src, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-movflags', '+faststart', tmp]);
  if (src !== dest) rmSync(src);
  renameSync(tmp, dest);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 900000, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${BASE}/marketing/social/2026-10-tiktok/render.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.ready === true', { timeout: 60000 });

const save = (name, dataUrl) => writeFileSync(join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
const manifestFile = join(OUT, 'manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
let unsafe = 0;
for (const p of todo) {
  const spec = { template: p.template, style: p.style, pattern: p.pattern, seed: p.seed, music: p.music, motion: p.motion, words: p.words, script: p.script || '', footer: p.footer || '' };
  const fit = await page.evaluate((s) => window.check(s), spec);
  if (fit.bad.length) { unsafe += 1; console.error(`${p.id}: outside TikTok's safe area: ${fit.bad.join('; ')}`); }
  save(`${p.id}-cover.jpg`, await page.evaluate((s) => window.cover(s), spec));
  if (coversOnly) { console.log(`drew ${p.id} cover (frame at ${fit.coverMs / 1000} s) · text ${fit.extent.top}-${fit.extent.bottom} px · sizes ${JSON.stringify(fit.sizes)}`); continue; }
  const t0 = Date.now();
  const v = await page.evaluate((s) => window.video(s), spec);
  const mp4 = join(OUT, `${p.id}.mp4`);
  if (v.type === 'video/mp4') save(`${p.id}.mp4`, v.data);
  else { save(`${p.id}.webm`, v.data); transcode(join(OUT, `${p.id}.webm`), mp4); }
  if (!probe(mp4).ok) transcode(mp4, mp4);
  manifest[p.id] = { seconds: v.seconds, coverMs: fit.coverMs, at: new Date().toISOString() };
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  console.log(`drew ${p.id} · ${v.seconds} s · cover at ${fit.coverMs / 1000} s · ${v.type}${v.type === 'video/mp4' ? '' : ' → transcoded'} · music rms ${v.audio.rms.toFixed(3)} peak ${v.audio.peak.toFixed(2)} · ${Math.round((Date.now() - t0) / 1000)} s`);
}
await browser.close();

// ffprobe every video that exists, so the table and review.html always cover the whole plan.
const probes = {};
for (const p of POSTS) {
  const f = join(OUT, `${p.id}.mp4`);
  probes[p.id] = existsSync(f) ? probe(f) : null;
}
console.log('\nid                        codec  size       pix      fps  audio            seconds  MB    ok');
for (const p of POSTS) {
  const r = probes[p.id];
  console.log(r ? `${p.id.padEnd(25)} ${r.video.padEnd(6)} ${r.size.padEnd(10)} ${r.pix.padEnd(8)} ${String(r.fps).padEnd(4)} ${`${r.audio} ${r.rate} ${r.channels}ch`.padEnd(16)} ${String(r.seconds).padEnd(8)} ${String(r.mb).padEnd(5)} ${r.ok ? 'yes' : 'NO'}` : `${p.id.padEnd(25)} (no video yet)`);
}

// All the covers on one sheet, in posting order (7 × 2).
const covers = POSTS.map((p) => `${p.id}-cover.jpg`).filter((f) => existsSync(join(OUT, f)));
if (covers.length) {
  const list = join(OUT, 'covers.txt');
  writeFileSync(list, covers.map((f) => `file '${f}'\nduration 1`).join('\n') + `\nfile '${covers[covers.length - 1]}'\n`);
  const cols = Math.min(7, covers.length);
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=300:533,tile=${cols}x${Math.ceil(covers.length / cols)}:padding=12:margin=12:color=0xF6F1F8`, '-frames:v', '1', '-q:v', '3', join(OUT, 'contact-sheet.jpg')]);
  rmSync(list);
  console.log(`\nwrote out/contact-sheet.jpg (${covers.length} covers)`);
}

// review.html: each post's video (with its music), cover, time and caption.
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const onCard = (p) => [...Object.entries(p.words).map(([k, v]) => `<b>${k}</b> ${esc(v)}`), p.script && `<b>script line</b> ${esc(p.script)}`, p.footer && `<b>footer</b> ${esc(p.footer)}`].filter(Boolean).join('<br>');
const v = (p) => { const r = probes[p.id]; const m = manifest[p.id]; return r ? `${r.seconds} s · ${r.video}/${r.audio} · ${r.mb} MB${m ? ` · cover at ${m.coverMs / 1000} s` : ''}` : 'no video yet'; };
const bust = Date.now().toString(36);
writeFileSync(join(here, 'review.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>P31 Market TikTok review</title>
<style>
:root{--bg:#f6f1f8;--card:#fff;--ink:#2a1526;--soft:#6b5868;--plum:#742D9B;--line:#e6dcea}
@media (prefers-color-scheme:dark){:root{--bg:#1a1019;--card:#261823;--ink:#f3eaf6;--soft:#c4b3c2;--plum:#cfa6e6;--line:#3a2836}}
*{box-sizing:border-box}body{font:14px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--ink);margin:0;padding:24px 16px}
h1{font-weight:650;font-size:22px;margin:0 0 4px}.lead{color:var(--soft);margin:0 0 16px;max-width:70ch}
.bar{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:20px}.bar a{color:var(--plum)}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:20px}
.c{background:var(--card);border-radius:14px;padding:14px;box-shadow:0 1px 3px #0002}
.m{display:grid;grid-template-columns:1fr 1fr;gap:10px}.m video,.m img{width:100%;aspect-ratio:9/16;border-radius:8px;background:#000;display:block;object-fit:cover}
.f{position:relative}.safe .f::after{content:"";position:absolute;inset:12% 13.9% 21.9% 0;border:2px dashed #ff3b6b;border-radius:8px;pointer-events:none}
.t{font-weight:700;margin:12px 0 0;font-size:16px}.k{color:var(--plum);font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin:2px 0 8px}
.w{font-size:13px;color:var(--soft);margin:0 0 8px}.w b{color:var(--ink);font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.05em;margin-right:4px}
pre{white-space:pre-wrap;font:13px/1.5 system-ui,sans-serif;background:var(--bg);padding:10px;border-radius:8px;margin:0}
small{color:var(--soft)}
</style></head><body>
<h1>Proverbs 31 Marketplace on TikTok · ${POSTS.length} posts · ${esc(POSTS[0].label)} to ${esc(POSTS[POSTS.length - 1].label)} ET</h1>
<p class="lead">Nothing is scheduled yet. Play each video to hear its music. The cover is what TikTok shows on the profile grid: the video's own frame half a second before the end. Times are Eastern; clocks go back on Sunday, November 1, and Zernio handles that. Posts marked “P31 offer” can carry TikTok's “Your brand” label if you choose (schedule.mjs --brand-label).</p>
<div class="bar"><label><input type="checkbox" id="safe"> Show TikTok's safe area on the covers (username and caption sit below the line, buttons to the right)</label><a href="out/contact-sheet.jpg">Contact sheet</a></div>
<div class="g">
${POSTS.map((p) => `<article class="c" id="${p.id}">
<div class="m"><video controls preload="metadata" playsinline poster="out/${p.id}-cover.jpg?v=${bust}" src="out/${p.id}.mp4?v=${bust}"></video><div class="f"><img src="out/${p.id}-cover.jpg?v=${bust}" alt="Cover of ${esc(p.id)}" loading="lazy"></div></div>
<p class="t">${esc(p.label)} ET</p>
<p class="k">${esc(p.template)} · ${esc(p.style)} · ${esc(p.music)} · ${esc(p.motion)} · ${esc(v(p))}${p.promo ? ' · P31 offer' : ''}</p>
<p class="w">${onCard(p)}</p>
<pre>${esc(p.caption)}</pre>
<small>${[...p.caption].length} characters · ${esc(p.id)}</small>
</article>`).join('\n')}
</div>
<script>const b=document.getElementById('safe');b.onchange=()=>document.body.classList.toggle('safe',b.checked);</script>
</body></html>
`);
console.log('wrote review.html');
if (unsafe) { console.error(`${unsafe} post(s) outside TikTok's safe area`); process.exitCode = 1; }
if (Object.values(probes).some((r) => r && !r.ok)) { console.error('some videos failed the ffprobe check'); process.exitCode = 1; }
