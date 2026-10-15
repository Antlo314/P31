// The virtual storefront walkthrough: screenshots of the vendor's and the shopper's path on the dev server's
// sample shop (Myrrh & Mercy Apothecary), then docs/guide/P31-Storefront-Walkthrough.html printed to
// docs/P31-Storefront-Walkthrough.pdf.
//   npm run dev -- --port 5180      (in another terminal)
//   node scripts/storefront-guide.mjs            screenshots + PDF
//   node scripts/storefront-guide.mjs --pdf      the PDF only (reuses the screenshots)
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.P31_BASE || 'http://localhost:5180';
const SHOTS = join(ROOT, 'docs/guide/storefront');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));
const at = (site, who) => (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}site=${site}&demo=${who}&devRole=off`;
const mk = at('market', 'admin');
const vendor = at('market', 'curator');
const cl = at('collective', 'admin');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
// The studio walkthrough would cover the first screenshot: mark it as seen.
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('p31_tour_curator-studio_u-cu', '1'); } catch { /* */ } });

const DESK = { width: 1280, height: 820, deviceScaleFactor: 1.5 };
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const clickText = (text) => page.evaluate((t) => {
  const el = [...document.querySelectorAll('button, a, [role="tab"], [role="radio"]')].find((x) => x.textContent.trim().startsWith(t) && x.offsetParent !== null);
  if (el) el.click();
  return !!el;
}, text);
const toText = (text, block = 'start') => page.evaluate((t, b) => {
  const el = [...document.querySelectorAll('h1, h2, h3, h4, p, label, strong, span, legend')].find((x) => x.textContent.trim().startsWith(t) && x.offsetParent !== null);
  if (el) el.scrollIntoView({ block: b });
  return !!el;
}, text, block);

/** Load a page, do the steps, take what is on screen. */
const shot = async (name, url, { phone = false, steps = [] } = {}) => {
  await page.setViewport(phone ? PHONE : DESK);
  if (url) { await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 }); await wait(1800); }
  for (const s of steps) {
    if (s.click) { if (!await clickText(s.click)) console.warn(`  ${name}: no "${s.click}"`); await wait(s.wait ?? 900); }
    if (s.scroll) { if (!await toText(s.scroll, s.block)) console.warn(`  ${name}: no "${s.scroll}"`); await wait(500); }
    if (s.sel) {
      // An instant jump: the site's smooth scrolling would otherwise still be moving when the shot is taken.
      await page.evaluate((q) => { const el = document.querySelector(q); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3, behavior: 'instant' }); }, s.sel);
      await wait(1400);
    }
    if (s.by) { await page.evaluate((y) => window.scrollBy(0, y), s.by); await wait(400); }
    if (s.type) { await page.type(s.type[0], s.type[1]); }
  }
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log('shot', name);
};

if (!process.argv.includes('--pdf')) {
  // The vendor's path
  await shot('v1-storefront-page', mk('/storefront'));
  await shot('v2-sign', null, { steps: [{ sel: '.sig__pad' }] });
  await shot('v3-systems-agreement', cl('/systems/forms'), { steps: [{ click: 'Sample Candle Co.' }] });
  await shot('v4-checklist', vendor('/dashboard/identity'));
  await shot('v5-identity', null, { steps: [{ scroll: 'Business Name', block: 'start' }, { by: -90 }] });
  await shot('v6-products', vendor('/dashboard/storefront'), { steps: [{ scroll: 'Fig & Myrrh Soy Candle', block: 'center' }] });
  await shot('v7-add-product', vendor('/dashboard/storefront'), { steps: [{ click: 'Add product', wait: 1200 }] });
  await shot('v8-paid', vendor('/dashboard/storefront'), { steps: [{ sel: '#payment-links-section' }, { by: 260 }] });
  await shot('v9-design', vendor('/dashboard/design'));
  await shot('v10-marketing', vendor('/dashboard/marketing'));
  await shot('v11-orders', vendor('/dashboard/orders'));
  await shot('v12-billing', vendor('/dashboard/billing'));
  await shot('v13-systems-shop', cl('/systems/shops'), { steps: [{ click: 'Myrrh & Mercy Apothecary', wait: 1200 }] });
  // The shopper's path
  await shot('s1-directory', mk('/directory'));
  await shot('s2-marketplace', mk('/shop'));
  await shot('s3-store', mk('/myrrh-and-mercy'));
  await shot('s4-store-products', null, { steps: [{ scroll: 'About Myrrh', block: 'start' }, { by: -100 }] });
  await shot('s5-reviews', null, { steps: [{ scroll: 'Collector', block: 'start' }, { by: -60 }] });
  await shot('s6-product', mk('/myrrh-and-mercy?p=101'), { phone: true });
  await shot('s7-bag', null, { phone: true, steps: [{ click: '8 oz' }, { click: 'Add to bag' }, { click: 'Added' , wait: 1500 }] });
  await shot('s8-request', null, { phone: true, steps: [{ click: 'Request this order', wait: 1000 }, { type: ['input[placeholder="Full name"]', 'Sample Shopper'] }, { type: ['input[placeholder="Email"]', 'shopper@example.com'] }] });
  await shot('s9-sent', null, { phone: true, steps: [{ click: 'Send order request', wait: 1500 }] });
}

// The walkthrough itself
await page.setViewport({ width: 816, height: 1056 });
await page.goto(pathToFileURL(join(ROOT, 'docs/guide/P31-Storefront-Walkthrough.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const out = join(ROOT, 'docs/P31-Storefront-Walkthrough.pdf');
await page.pdf({
  path: out, format: 'Letter', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:7.5px;color:#74657A;padding:0 0.7in;display:flex;justify-content:space-between;">
    <span>The virtual storefront, step by step · Proverbs 31 Marketplace · October 2026</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(`written ${out}`);
