import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire('C:/Users/aarons/.gemini/antigravity/scratch/P31/package.json');
const puppeteer = require('puppeteer-core');
const ROOT = 'C:/Users/aarons/.gemini/antigravity/scratch/P31/';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1300, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(ROOT + 'marketing/brand/og.html').href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
for (const [id, out] of [['market', 'public/og-image.jpg'], ['collective', 'public/c/og-image.jpg']]) {
  await (await page.$(`#${id}`)).screenshot({ path: ROOT + out, type: 'jpeg', quality: 86 });
}
const kit = await browser.newPage();
await kit.goto(pathToFileURL(ROOT + 'marketing/brand/brand-kit.html').href, { waitUntil: 'networkidle0' });
await kit.evaluate(() => document.fonts.ready);
await kit.pdf({ path: ROOT + 'marketing/brand/P31-Brand-Kit.pdf', printBackground: true, preferCSSPageSize: true });
await browser.close(); console.log('og images + brand kit pdf written');
