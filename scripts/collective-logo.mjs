// The Proverbs 31 Collective's hands mark, from the artwork supplied on 2026-10-14
// (marketing/brand/collective: hands-color.png on transparent, hands-white.png, hands-on-white.jpg),
// exported everywhere the Collective shows it: the site's icons and favicon, the link preview,
// the page mark, the brand kit files, the Design studio and a social profile picture.
// The marketplace has its own logo (scripts/market-logo.mjs).
//   node scripts/collective-logo.mjs
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
const sharp = require('sharp');
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
const SRC = join(ROOT, 'marketing/brand/collective');
const out = (rel) => { const p = join(ROOT, rel); mkdirSync(dirname(p), { recursive: true }); return p; };
const COLORS = { plum: '#510A66', gold: '#D0B46A', white: '#FFFFFF' };

// The mark, trimmed to the circle, with a hair of room around it (square, transparent).
async function trimmed(file) {
  const t = await sharp(file).trim({ threshold: 4 }).toBuffer({ resolveWithObject: true });
  const side = Math.max(t.info.width, t.info.height);
  const pad = Math.round(side * 0.02);
  return sharp(t.data).extend({
    top: Math.floor((side - t.info.height) / 2) + pad, bottom: Math.ceil((side - t.info.height) / 2) + pad,
    left: Math.floor((side - t.info.width) / 2) + pad, right: Math.ceil((side - t.info.width) / 2) + pad,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();
}
const color = await trimmed(join(SRC, 'hands-color.png'));
const white = await trimmed(join(SRC, 'hands-white.png'));
const { width: S } = await sharp(color).metadata();

// One-colour versions (for single-colour print and for dark designs), from the mark's own shape.
async function mono(hex) {
  const alpha = await sharp(color).extractChannel('alpha').toBuffer();
  return sharp({ create: { width: S, height: S, channels: 3, background: hex } }).joinChannel(alpha).png().toBuffer();
}
const plum = await mono(COLORS.plum);
const gold = await mono(COLORS.gold);

const size = (buf, n) => sharp(buf).resize(n, n).png().toBuffer();
// The mark centred on a tile (bg null = transparent), at `scale` of the tile; `disc` puts a white
// circle behind it so it reads on any background (tabs, dark pages).
async function tile(n, { bg = '#FFFFFF', scale = 0.82, disc = false } = {}) {
  const m = Math.round(n * scale);
  const layers = [];
  if (disc) layers.push({ input: Buffer.from(`<svg width="${n}" height="${n}"><circle cx="${n / 2}" cy="${n / 2}" r="${n / 2}" fill="#FFFFFF"/></svg>`), left: 0, top: 0 });
  layers.push({ input: await size(color, m), left: Math.round((n - m) / 2), top: Math.round((n - m) / 2) });
  const base = bg ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 };
  return sharp({ create: { width: n, height: n, channels: 4, background: bg ? bg : base } }).composite(layers).png().toBuffer();
}
const save = async (buf, rel, fmt = 'png') => {
  const s = sharp(buf);
  if (fmt === 'webp') await s.webp({ quality: 92, alphaQuality: 100 }).toFile(out(rel));
  else await s.png({ compressionLevel: 9 }).toFile(out(rel));
  console.log('wrote', rel);
};

// Brand kit masters
await save(await size(color, 1024), 'marketing/brand/mark.png');
await save(await size(white, 1024), 'marketing/brand/mark-white.png');
await save(await size(plum, 1024), 'marketing/brand/mark-plum.png');
await save(await size(gold, 1024), 'marketing/brand/mark-gold.png');
await save(await tile(1024), 'marketing/brand/icon-1024.png');
await save(await tile(1024, { bg: null, scale: 1, disc: true }), 'marketing/brand/avatar-1024.png');
await save(await tile(1080, { scale: 0.86 }), 'marketing/brand/collective/social/profile-1080.png');

// The pages' mark, and the Design studio's (full colour on light designs, gold or white on dark).
await save(await size(color, 1024), 'src/assets/academy/collective-mark.png');
await save(await size(color, 512), 'src/assets/academy/collective-mark.webp', 'webp');
await save(await size(color, 360), 'src/assets/design/mark-color.webp', 'webp');
await save(await size(plum, 360), 'src/assets/design/mark-plum.webp', 'webp');
await save(await size(gold, 360), 'src/assets/design/mark-gold.webp', 'webp');
await save(await size(white, 360), 'src/assets/design/mark-white.webp', 'webp');

// thep31collective.org icons: the mark on white (home screens), and on a white disc (browser tabs).
const appIcon = await tile(1024);
for (const [rel, n] of [['public/c/icons/icon-512.png', 512], ['public/c/icons/icon-192.png', 192], ['public/c/icons/apple-touch-icon.png', 180]]) await save(await size(appIcon, n), rel);
await save(await size(await tile(1024, { scale: 0.66 }), 512), 'public/c/icons/maskable-512.png');
const fav = await tile(512, { bg: null, scale: 1, disc: true });
await save(fav, 'public/c/favicon.png');
for (const n of [16, 32, 48, 96]) await save(await size(fav, n), `public/c/icons/favicon-${n}.png`);
const ico = await Promise.all([16, 32, 48].map((n) => size(fav, n)));
const head = Buffer.alloc(6 + 16 * ico.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4);
let offset = head.length;
ico.forEach((b, i) => {
  const n = [16, 32, 48][i]; const e = 6 + i * 16;
  head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(b.length, e + 8); head.writeUInt32LE(offset, e + 12); offset += b.length;
});
writeFileSync(out('public/c/favicon.ico'), Buffer.concat([head, ...ico]));
console.log('wrote public/c/favicon.ico');

// The link preview for thep31collective.org (marketing/brand/og.html, the Collective card).
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630 });
await page.goto(pathToFileURL(join(ROOT, 'marketing/brand/og.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const card = await page.$('#collective');
await sharp(await card.screenshot()).jpeg({ quality: 90 }).toFile(out('public/c/og-image.jpg'));
console.log('wrote public/c/og-image.jpg');
await browser.close();
