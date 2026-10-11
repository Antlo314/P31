// Link and image test: opens every screen the screen test knows, collects every link on each,
// follows every internal one once (same site, both domains' paths), and fails on a page that
// crashes, comes up blank, says "not found", or has a broken image. External links are counted,
// not fetched. Runs on the dev server's sample data, so it needs no accounts.
//
//   npm run dev                 (in another terminal)
//   node scripts/link-test.mjs
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const BASE = process.env.P31_BASE || 'http://localhost:5180';
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));

// Where to start: the public pages of both sites plus every dashboard, as an admin.
const starts = [
  ...['/', '/about', '/calendar', '/directory', '/partner', '/apply', '/vendors', '/vendors/agreement', '/vendors/register', '/vendors/feedback', '/volunteer', '/services', '/login', '/shop', '/sample-bakery', '/dashboard/identity', '/dashboard/governance', '/gather']
    .map((p) => ['market', p]),
  ...['/', '/academy', '/join', '/mentorship', '/mentorship/business', '/mentorship/faith', '/verify', '/portal?choose', '/today', '/systems', '/systems/shops', '/systems/team', '/systems/walkthroughs', '/systems/walkthroughs?tab=tests', '/systems/academy', '/studio', '/academy/business/teach', '/academy/business', '/gather/the-gathering']
    .map((p) => ['collective', p]),
];
const withDemo = (site, path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}site=${site}&demo=admin&devRole=off`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!CHROME) { console.error('link-test: Chrome not found (set CHROME_PATH)'); process.exit(1); }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.evaluateOnNewDocument(() => { try { localStorage.setItem('p31_subscribed', '1'); } catch { /* ignore */ } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const seen = new Set();
const queue = starts.map(([site, path]) => ({ site, path, from: 'start' }));
const problems = [];
const external = new Set();
let visited = 0;

const normalize = (href, site) => {
  try {
    const u = new URL(href, BASE);
    if (u.origin !== new URL(BASE).origin) {
      // The other domain's pages (thep31collective.org ↔ p31market.com) are internal too.
      if (/thep31collective\.org$/i.test(u.hostname)) return { site: 'collective', path: u.pathname + u.search };
      if (/p31market\.com$/i.test(u.hostname)) return { site: 'market', path: u.pathname + u.search };
      external.add(u.href);
      return null;
    }
    const q = new URLSearchParams(u.search);
    q.delete('site'); q.delete('demo'); q.delete('devRole'); q.delete('auto'); q.delete('tour');
    const search = q.toString() ? `?${q}` : '';
    // Which side owns the path (the same rule as src/lib/site.js): the Collective's rooms, the
    // shared ones (home, The Gathering) on whichever side linked them, everything else the Market.
    const s = /^\/(mentorship|enroll|academy|portal|studio|systems|verify|join|today)(\/|$)/.test(u.pathname) ? 'collective'
      : u.pathname === '/' || /^\/gather(\/|$)/.test(u.pathname) ? site : 'market';
    return { site: s, path: u.pathname + search };
  } catch { return null; }
};

while (queue.length) {
  const { site, path, from } = queue.shift();
  const key = `${site}:${path}`;
  if (seen.has(key)) continue;
  seen.add(key);
  // Mail, phone and files are not pages; hashes point inside a page.
  if (/^(mailto:|tel:|sms:)/.test(path) || /\.(pdf|jpg|png|webp|mp4|ics|zip)(\?|$)/i.test(path)) continue;
  errors.length = 0;
  try {
    await page.goto(withDemo(site, path), { waitUntil: 'load', timeout: 60000 });
    await sleep(1500);
    const res = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && !h.startsWith('#') && !h.startsWith('javascript:'));
      const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && !i.getAttribute('src').startsWith('data:') && i.loading !== 'lazy').map((i) => i.getAttribute('src'));
      return { text, links, broken, title: document.title };
    });
    visited += 1;
    if (/Something went wrong/.test(res.text)) problems.push(`${key} (from ${from}): error screen`);
    else if (res.text.trim().length < 40) problems.push(`${key} (from ${from}): blank page`);
    else if (/page not found|not found\b|404/i.test(res.text.slice(0, 400)) && !/Page not found\b.*Back to/i.test(res.text) && !/\/verify/.test(path)) problems.push(`${key} (from ${from}): says not found`);
    if (errors.length) problems.push(`${key}: page error: ${errors[0]}`);
    res.broken.forEach((src) => problems.push(`${key}: broken image ${src}`));
    for (const href of res.links) {
      const n = normalize(href, site);
      if (n && !seen.has(`${n.site}:${n.path}`)) queue.push({ ...n, from: key });
    }
  } catch (e) {
    problems.push(`${key} (from ${from}): ${e.message.split('\n')[0]}`);
  }
  if (visited > 400) { problems.push('stopped after 400 pages'); break; }
}
await browser.close();
console.log(`link-test: ${visited} pages visited, ${external.size} external links counted (not fetched)`);
if (problems.length) {
  console.error(`link-test: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('link-test: no broken internal links, blank pages, error screens or broken images');
