// Draws the Google Business Profile logo and cover from gbp.html with the current hands mark.
//   node marketing/gbp/src/render.mjs   → marketing/gbp/01-logo.jpg, 02-cover.jpg
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '../../..');
const puppeteer = createRequire(join(ROOT, 'package.json'))('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 2200, height: 2400, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, 'gbp.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await (await page.$('#logo')).screenshot({ path: join(here, '../01-logo.jpg'), type: 'jpeg', quality: 92 });
await (await page.$('#cover')).screenshot({ path: join(here, '../02-cover.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
console.log('wrote marketing/gbp/01-logo.jpg and 02-cover.jpg');
