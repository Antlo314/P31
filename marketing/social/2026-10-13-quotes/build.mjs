// Draws every post in plan.mjs (1080×1350 JPEG) with the Design studio engine into out/, and
// writes review.html (each card with its time and both captions).
// Needs the dev server (npm run dev -- --port 5180): render.html runs the engine in Chrome.
//   node build.mjs              (P31_BASE and CHROME_PATH override the defaults)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { POSTS } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '../../..');
const puppeteer = createRequire(join(ROOT, 'package.json'))('puppeteer-core');
const BASE = process.env.P31_BASE || 'http://localhost:5180';
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
mkdirSync(join(here, 'out'), { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${BASE}/marketing/social/2026-10-13-quotes/render.html`, { waitUntil: 'networkidle0' });
await page.waitForFunction('window.ready === true', { timeout: 60000 });
for (const p of POSTS) {
  const data = await page.evaluate((id) => window.still(id), p.id);
  writeFileSync(join(here, 'out', `${p.id}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  console.log(`drew ${p.id}`);
}
await browser.close();

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
writeFileSync(join(here, 'review.html'), `<!doctype html><meta charset="utf-8"><title>P31 quote collection review</title>
<style>body{font:14px/1.5 system-ui;background:#f6f1f8;color:#2a1526;margin:24px}h1{font-weight:600}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.c{background:#fff;border-radius:14px;padding:12px;box-shadow:0 1px 3px #0002}.c img{width:100%;border-radius:8px}.t{font-weight:700;margin:8px 0 2px}.k{color:#742D9B;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
pre{white-space:pre-wrap;font:12px/1.45 system-ui;background:#faf7fb;padding:8px;border-radius:8px}</style>
<h1>Push me God collection · ${POSTS.length} posts · Instagram + Facebook</h1><div class="g">
${POSTS.map((p) => `<div class="c" id="${p.id}"><img src="out/${p.id}.jpg" alt="${esc(p.alt)}"><p class="t">${esc(p.label)} ET</p><p class="k">${p.kind} · ${p.style} · ${p.pattern}</p><details><summary>Instagram caption</summary><pre>${esc(p.instagram)}</pre></details><details><summary>Facebook caption</summary><pre>${esc(p.facebook)}</pre></details></div>`).join('\n')}
</div>`);
console.log('wrote review.html');
