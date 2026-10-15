// Prints one of the docs/guide pages to a Letter PDF with page numbers in the footer.
//   node scripts/print-guide.mjs docs/guide/P31-Stripe-Setup.html docs/P31-Stripe-Setup-Guide.pdf "Connecting Stripe"
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [html, pdf, title = 'P31'] = process.argv.slice(2);
if (!html || !pdf) { console.error('usage: node scripts/print-guide.mjs <page.html> <out.pdf> [footer title]'); process.exit(1); }
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(ROOT, html)).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
await page.pdf({
  path: resolve(ROOT, pdf), format: 'Letter', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:7.5px;color:#74657A;padding:0 0.7in;display:flex;justify-content:space-between;">
    <span>${title} · ${month}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(`written ${pdf}`);
