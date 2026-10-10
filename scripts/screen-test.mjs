// Screen test: opens every main screen on both sites (and clicks the key buttons) in the
// dev server's sample-data mode, and fails if any page crashes, shows the error screen,
// logs a page error, comes up blank, or a button the test expects is missing.
//
//   npm run dev                 (in another terminal)
//   node scripts/screen-test.mjs
//
// P31_BASE (default http://localhost:5180) and CHROME_PATH can be set for CI.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const BASE = process.env.P31_BASE || 'http://localhost:5180';
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));

// Every screen runs on the dev-only sample data, so the test needs no accounts or secrets.
const at = (site, who) => (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}site=${site}&demo=${who}&devRole=off`;
const mk = at('market', 'admin');
const cl = at('collective', 'admin');
const st = at('collective', 'student');
const fa = at('collective', 'faith');

// [name, url, buttons to click in order]
const SCREENS = [
  ['market home', mk('/')], ['shop', mk('/shop')], ['curators', mk('/directory')], ['market dates', mk('/calendar')],
  ['about + team', mk('/about')], ['services', mk('/services')], ['partner', mk('/partner')], ['curator sign-in', mk('/login')],
  ['collective home', cl('/')], ['academy', cl('/academy')], ['systems showcase', at('collective', 'student')('/systems')],
  ['join', cl('/join')], ['mentorship', cl('/mentorship')], ['business mentorship', cl('/mentorship/business')],
  ['faith mentorship', cl('/mentorship/faith')], ['verify', cl('/verify')], ['portal', cl('/portal?choose')],
  ['mentor overview', cl('/academy/business/teach')], ['mentor inbox', cl('/academy/business/teach/inbox/u-s1')],
  ['students', cl('/academy/business/teach/students')],
  ['student page tabs', cl('/academy/business/teach/students/u-s1'), ['Personal tasks', 'Files', '1:1 sessions', 'Action plans', 'Progress', 'Work', 'Private notes']],
  ['see their dashboard', cl('/academy/business/teach/students/u-s1'), ['See their dashboard']],
  ['assignments + new', cl('/academy/business/teach/assignments'), ['New assignment']],
  ['gradebook + grade', cl('/academy/business/teach/gradebook'), ['Grade']],
  ['quizzes + new', cl('/academy/business/teach/quizzes'), ['New quiz']],
  ['sessions + go live', cl('/academy/business/teach/sessions'), ['Go live now']],
  ['call report', cl('/academy/business/teach/sessions'), ['Report']],
  ['curriculum', cl('/academy/business/teach/curriculum')], ['announcements', cl('/academy/business/teach/announcements')],
  ['completion', cl('/academy/business/teach/completion')], ['intro calls', cl('/academy/business/teach/calls')],
  ['invites', cl('/academy/business/teach/invites')], ['mentor discussions', cl('/academy/business/teach/discussions')],
  ['student home', st('/academy/business')], ['lessons', st('/academy/business/learn')], ['lesson', st('/academy/business/learn/l5')],
  ['student assignments', st('/academy/business/assignments')], ['assignment', st('/academy/business/assignments/a1')],
  ['student quizzes', st('/academy/business/quizzes')], ['quiz', st('/academy/business/quizzes/q1')],
  ['student sessions', st('/academy/business/sessions')], ['member line', st('/academy/business/messages')],
  ['library', st('/academy/business/library')], ['progress', st('/academy/business/progress')], ['action plans', st('/academy/business/plans')],
  ['goals', st('/academy/business/goals')], ['discussions', st('/academy/business/discussions')], ['thread', st('/academy/business/discussions/t1')],
  ['billing', st('/academy/business/billing')], ['faith home', fa('/academy/faith')], ['journal', fa('/academy/faith/journal')],
  ['studio', cl('/studio')], ['studio calendar', cl('/studio/calendar')], ['studio compose', cl('/studio/compose')],
  ['studio inbox', cl('/studio/inbox')], ['studio comments', cl('/studio/comments')], ['studio create', cl('/studio/create')],
  ...['', 'crm', 'applications', 'social', 'growth', 'events', 'campaigns', 'orders', 'academy', 'clips', 'photos', 'pro-edit', 'health', 'settings']
    .map((p) => [`systems ${p || 'overview'}`, cl(`/systems${p ? '/' + p : ''}`)]),
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, text) => page.evaluate((t) => {
  const els = [...document.querySelectorAll('button, a, [role="tab"]')].filter((e) => e.offsetParent);
  const el = els.find((e) => e.textContent.trim() === t) || els.find((e) => e.textContent.trim().startsWith(t));
  if (!el) return false;
  el.click();
  return true;
}, text);

if (!CHROME) { console.error('screen-test: Chrome not found (set CHROME_PATH)'); process.exit(1); }
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const failures = [];
let n = 0;
for (const [name, url, clicks = []] of SCREENS) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('p31_subscribed', '1'); } catch { /* ignore */ } });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000);
    for (const c of clicks) {
      if (!(await clickText(page, c))) failures.push(`${name}: no "${c}" button`);
      await sleep(700);
    }
    const text = await page.evaluate(() => document.body.innerText);
    if (/Something went wrong/.test(text)) failures.push(`${name}: error screen: ${text.match(/team:\s*([^\n]+)/)?.[1] || ''}`);
    else if (text.trim().length < 40) failures.push(`${name}: blank page`);
    if (errors.length) failures.push(`${name}: page error: ${errors[0]}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
  await page.close();
  n += 1;
}
await browser.close();
if (failures.length) {
  console.error(`screen-test: ${failures.length} problem(s) in ${n} screens\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`screen-test: ${n} screens, no crashes, errors or missing buttons`);
