// The one-page "Start a new enrollment" quick start: screenshots of the enrollment workflow (v52) from the
// dev server's sample data, then docs/guide/P31-Enrollment-Quick-Start.html printed to
// docs/P31-Enrollment-Quick-Start.pdf.
//   npm run dev -- --port 5180      (in another terminal)
//   node scripts/enrollment-quickstart.mjs
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.P31_BASE || 'http://localhost:5180';
const SHOTS = join(ROOT, 'docs/guide/enrollment');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));
const cl = (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}site=collective&demo=admin&devRole=off`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
const open = async (url, { phone = false } = {}) => {
  await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1280, height: 860, deviceScaleFactor: 1.5 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  await wait(1500);
};
// The site's own bars (top navigation, phone tab bar) would sit over the screenshots: hide them first.
const shot = async (name, selector) => {
  await page.waitForSelector(selector, { timeout: 20000 });
  await page.evaluate(() => {
    for (const n of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(n).position;
      if ((pos === 'fixed' || pos === 'sticky') && !n.closest('.ds-modal')) n.style.visibility = 'hidden';
    }
  });
  await wait(300);
  const el = await page.$(selector);
  await el.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log('shot', name);
};
const clickText = (text) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button, a')].find((x) => x.textContent.includes(t));
  if (b) b.click();
  return !!b;
}, text);

await open(cl('/academy/business/teach/calls'));
await shot('1-call-card', '.ds-card');
await clickText('Send the three agreements');
await wait(2000);
await shot('2-send-modal', '.ds-modal__panel');

await open(cl('/coaching/forms/demo-new'), { phone: true });
await shot('3-forms', '.cf-head');
await open(cl('/coaching/forms/demo-signed'), { phone: true });
await shot('4-plan', '.cf-card');
await open(cl('/enroll/demo'), { phone: true });
await shot('5-checkout', '.lg__card');
await open(cl('/coaching/forms/demo-enrolled'), { phone: true });
await shot('6-enrolled', '.cf-card');
await browser.close();

execFileSync(process.execPath, [join(ROOT, 'scripts/print-guide.mjs'), 'docs/guide/P31-Enrollment-Quick-Start.html', 'docs/P31-Enrollment-Quick-Start.pdf', 'Start a new enrollment'], { stdio: 'inherit', cwd: ROOT });
