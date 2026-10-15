// The "How a new coaching client signs up" guide: screenshots of each step from the dev server's sample
// data, then docs/guide/P31-Coaching-Signup.html printed to docs/P31-Coaching-Signup-Guide.pdf.
//   npm run dev -- --port 5180      (in another terminal)
//   node scripts/coaching-guide.mjs
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.P31_BASE || 'http://localhost:5180';
const SHOTS = join(ROOT, 'docs/guide/coaching');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));
const cl = (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}site=collective&demo=admin&devRole=off`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

const open = async (url, { phone = false } = {}) => {
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 860, deviceScaleFactor: 1.5 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await wait(1500);
};
const shot = async (name, selector, { pad = 0, maxHeight = 1400 } = {}) => {
  const el = await page.waitForSelector(selector, { timeout: 30000 });
  await el.evaluate((n) => n.scrollIntoView({ block: 'start' }));
  await wait(700);
  // Page coordinates: the clip is measured from the top of the page, not the window.
  const box = await el.evaluate((n) => { const r = n.getBoundingClientRect(); return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height }; });
  await page.screenshot({ path: join(SHOTS, `${name}.png`), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: Math.min(box.height + pad * 2, maxHeight) } });
  console.log('shot', name);
};
const clickText = (text) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim().startsWith(t));
  if (b) b.click();
  return !!b;
}, text);

// 1. Where she asks for an intro call (public mentorship page)
await open(cl('/mentorship/business'));
await shot('1-intro-call', '#intro-call', { maxHeight: 760 });
// 2. The mentor console: her intro-call card, then the send window
await open(cl('/academy/business/teach/calls'));
await shot('2-call-card', '.ds-card');
await clickText('Send the three agreements');
await wait(800);
await shot('3-send-modal', '.ds-modal__panel');
// 3. What she sees on her phone: the welcome and the steps, the package choice, the safety form
await open(cl('/coaching/forms/demo-new'), { phone: true });
await shot('4-welcome', '.cf-head', { pad: 16 });
await page.evaluate(() => document.querySelector('.cf-steps')?.scrollIntoView());
await shot('5-steps', '.cf-steps', { pad: 12 });
await shot('6-packages', '.cf-field', { pad: 12 });
await shot('7-sign', '.cf-sign', { pad: 12 });
await open(cl('/coaching/forms/demo-safety'), { phone: true });
await shot('8-safety', '.cf-grid', { pad: 12 });
// 4. Back in the console: progress, and the payment link once all three are signed
await open(cl('/academy/business/teach/agreements'));
await shot('9-agreements', '.ds-grid');

// The guide itself
await page.setViewport({ width: 816, height: 1056 });
await page.goto(pathToFileURL(join(ROOT, 'docs/guide/P31-Coaching-Signup.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const out = join(ROOT, 'docs/P31-Coaching-Signup-Guide.pdf');
await page.pdf({
  path: out, format: 'Letter', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:7.5px;color:#74657A;padding:0 0.7in;display:flex;justify-content:space-between;">
    <span>How a new coaching client signs up · The P31 Collective by NEBA · October 2026</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(`written ${out}`);
