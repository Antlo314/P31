// The Proverbs 31 Marketplace logo ("Rise & Build": three plum panels, PROVERBS · 31 · MARKETS),
// redrawn as type so every size is sharp, then exported for the site, the app icons and social.
// The CEO's files (2026-10-14) spell the left column "PROVEBS"; this keeps the design and spells
// PROVERBS in full. The Collective keeps its hands mark.
//   node scripts/market-logo.mjs
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));

const BRAND = join(ROOT, 'marketing/brand/market');
const TMP = join(ROOT, 'marketing/brand/market/.build');
mkdirSync(TMP, { recursive: true });

// Bodoni Moda (open source) is the closest match to the logo's Didone capitals and flat-topped 3.
const font = (w, style = 'normal') => pathToFileURL(join(ROOT, `node_modules/@fontsource/bodoni-moda/files/bodoni-moda-latin-${w}-${style}.woff2`)).href;
const C = { bg: '#4A2341', panel: '#582A51', ink: '#FFFBF3', cream: '#FBF2E4', gold: '#C9A04A', goldDeep: '#A8802E' };

const css = `
@font-face { font-family: PF; font-weight: 400; src: url(${font(400)}); }
@font-face { font-family: PF; font-weight: 500; src: url(${font(500)}); }
@font-face { font-family: PF; font-weight: 700; src: url(${font(700)}); }
@font-face { font-family: PF; font-weight: 800; src: url(${font(800)}); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: transparent; }
.art { position: relative; overflow: hidden; font-family: PF, serif; }
.gilt { color: ${C.ink}; -webkit-text-stroke: var(--edge) ${C.gold}; paint-order: stroke fill; text-shadow: var(--sh) var(--sh) 0 ${C.goldDeep}; }
.panels { position: absolute; display: grid; grid-template-columns: 1fr 1fr 1fr; }
.panel { background: ${C.panel}; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.col { font-weight: 800; line-height: 1; }
.num { position: absolute; inset: 0; display: grid; place-items: center; font-weight: 500; line-height: 1; }
.tag { position: absolute; left: 0; right: 0; text-align: center; font-weight: 400; color: ${C.cream}; }
`;

// The three panels; u is the panel height in px. letters: false for the tiny icon (bars only).
function panels({ x, y, u, letters = true, numScale = 1 }) {
  const pw = u * 0.445; const gap = u * 0.054; const size = u * 0.088;
  const col = (word) => `<div class="panel" style="padding:${u * 0.07}px 0 ${u * 0.06}px">${letters ? [...word].map((ch) => `<span class="col gilt" style="font-size:${size}px">${ch}</span>`).join('') : ''}</div>`;
  return `<div class="panels" style="left:${x}px;top:${y}px;width:${pw * 3 + gap * 2}px;height:${u}px;column-gap:${gap}px">
    ${col('PROVERBS')}
    <div class="panel"><span class="num gilt" style="font-size:${u * 0.3 * numScale}px">31</span></div>
    ${col('MARKETS')}
  </div>`;
}
const width = (u) => u * 0.445 * 3 + u * 0.054 * 2;

const LAYOUTS = {
  // The square logo (profile pictures, the brand kit): panels with RISE & BUILD beneath.
  square: (s) => {
    const u = s * 0.487; const w = width(u);
    return { w: s, h: s, bg: C.bg, body: `${panels({ x: (s - w) / 2, y: s * 0.22, u })}
      <div class="tag gilt" style="top:${s * 0.735}px;font-size:${s * 0.046}px;letter-spacing:${s * 0.021}px;padding-left:${s * 0.021}px">RISE &amp; BUILD</div>` };
  },
  // The horizontal lockup: RISE & BUILD, the panels, then PROVERBS 31 / MARKETPLACE.
  lockup: (s) => {
    const W = s * 1.5; const u = s * 0.336; const w = width(u);
    return { w: W, h: s, bg: C.bg, body: `<div class="tag gilt" style="top:${s * 0.135}px;font-size:${s * 0.044}px;letter-spacing:${s * 0.017}px;padding-left:${s * 0.017}px">RISE &amp; BUILD</div>
      ${panels({ x: (W - w) / 2, y: s * 0.215, u })}
      <div class="tag gilt" style="top:${s * 0.575}px;font-size:${s * 0.105}px;letter-spacing:${s * 0.006}px">PROVERBS 31</div>
      <div class="tag gilt" style="top:${s * 0.705}px;font-size:${s * 0.05}px;letter-spacing:${s * 0.026}px;padding-left:${s * 0.026}px">MARKETPLACE</div>` };
  },
  // App icon: the panels alone on plum, a little margin all round.
  icon: (s) => {
    const u = s * 0.64; const w = width(u);
    return { w: s, h: s, bg: C.bg, body: panels({ x: (s - w) / 2, y: (s - u) / 2, u }) };
  },
  // Maskable icon: the same, inside the 80% safe circle.
  maskable: (s) => {
    const u = s * 0.5; const w = width(u);
    return { w: s, h: s, bg: C.bg, body: panels({ x: (s - w) / 2, y: (s - u) / 2, u }) };
  },
  // Favicon: at 16–48 px the letters would only be noise, so the side panels are plain and 31 is large.
  favicon: (s) => {
    const u = s * 0.78; const w = width(u);
    return { w: s, h: s, bg: C.bg, body: panels({ x: (s - w) / 2, y: (s - u) / 2, u, letters: false, numScale: 1.25 }) };
  },
  // The mark with no background (for placing on designs and pages): just the panels, edge to edge.
  mark: (s) => {
    const u = s / 1.443; const w = width(u);
    return { w: s, h: Math.ceil(u), bg: 'transparent', body: panels({ x: (s - w) / 2, y: 0, u }) };
  },
  // Wide banners (Facebook cover, link previews): panels beside the wordmark, centred, sized so
  // the whole group fits inside `safeW` (phones crop a Facebook cover's sides).
  banner: (W, H, safeW = W) => {
    const k = Math.min(H, (Math.min(W, safeW) * 0.9) / 2.05);
    const u = k * 0.62; const w = width(u);
    const line = (size, ls, txt, extra = '') => `<div class="gilt" style="font-size:${size}px;letter-spacing:${ls}px;padding-left:0;font-weight:400;color:${C.cream};white-space:nowrap;line-height:1.1;${extra}">${txt}</div>`;
    return { w: W, h: H, bg: C.bg, body: `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:${k * 0.11}px">
      <div style="position:relative;width:${w}px;height:${u}px;flex:none">${panels({ x: 0, y: 0, u })}</div>
      <div style="display:grid;justify-items:start">
        ${line(k * 0.135, k * 0.004, 'PROVERBS 31')}
        ${line(k * 0.064, k * 0.034, 'MARKETPLACE', `margin-top:${k * 0.02}px`)}
        <div style="width:${k * 0.44}px;height:${Math.max(1, k * 0.003)}px;background:${C.gold};margin:${k * 0.05}px 0 ${k * 0.045}px"></div>
        ${line(k * 0.045, k * 0.03, 'RISE &amp; BUILD')}
      </div>
    </div>` };
  },
};

const page = (L, s) => `<!doctype html><meta charset="utf-8"><style>${css}
.art { --edge: ${Math.max(0.4, (s.edge || 1.1) * (Math.min(L.w, L.h) / 1000))}px; --sh: ${Math.max(0.3, Math.min(L.w, L.h) / 1000)}px; width:${L.w}px; height:${L.h}px; background:${L.bg}; }
</style><div class="art" id="art">${L.body}</div>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const tab = await browser.newPage();
async function draw(name, layout, args, opts = {}) {
  const L = LAYOUTS[layout](...args);
  const file = join(TMP, `${name}.html`);
  writeFileSync(file, page(L, opts));
  await tab.setViewport({ width: Math.ceil(L.w), height: Math.ceil(L.h), deviceScaleFactor: 1 });
  await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const el = await tab.$('#art');
  return el.screenshot({ omitBackground: L.bg === 'transparent' });
}

const out = (rel) => { const p = join(ROOT, rel); mkdirSync(dirname(p), { recursive: true }); return p; };
const png = async (buf, rel, size) => { await sharp(buf).resize(size, size).png({ compressionLevel: 9 }).toFile(out(rel)); console.log('wrote', rel); };

// Masters (brand kit)
const square = await draw('square', 'square', [2000]);
await sharp(square).png().toFile(out('marketing/brand/market/p31-market-logo-square.png'));
const lockup = await draw('lockup', 'lockup', [2048]);
await sharp(lockup).png().toFile(out('marketing/brand/market/p31-market-logo-horizontal.png'));
const mark = await draw('mark', 'mark', [1200]);
await sharp(mark).png().toFile(out('marketing/brand/market/p31-market-mark-transparent.png'));
const icon = await draw('icon', 'icon', [1024]);
await sharp(icon).png().toFile(out('marketing/brand/market/p31-market-icon.png'));

// Social
await sharp(await draw('profile', 'square', [1080])).png().toFile(out('marketing/brand/market/social/profile-1080.png'));
await sharp(await draw('fbcover', 'banner', [1640, 624, 1100])).png().toFile(out('marketing/brand/market/social/facebook-cover-1640x624.png'));
console.log('wrote social files');

// The site's icons (same paths as before, so the manifest, emails and PDFs pick them up).
await png(icon, 'public/icons/icon-512.png', 512);
await png(icon, 'public/icons/icon-192.png', 192);
await png(icon, 'public/icons/apple-touch-icon.png', 180);
await png(await draw('maskable', 'maskable', [1024]), 'public/icons/maskable-512.png', 512);
const fav = await draw('favicon', 'favicon', [512]);
await png(fav, 'public/favicon.png', 512);
const ico = await Promise.all([16, 32, 48].map((n) => sharp(fav).resize(n, n).png().toBuffer()));
// A PNG-in-ICO file with 16, 32 and 48 px images.
const head = Buffer.alloc(6 + 16 * ico.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(ico.length, 4);
let offset = head.length;
ico.forEach((b, i) => {
  const n = [16, 32, 48][i]; const e = 6 + i * 16;
  head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(b.length, e + 8); head.writeUInt32LE(offset, e + 12);
  offset += b.length;
});
writeFileSync(out('public/favicon.ico'), Buffer.concat([head, ...ico]));
console.log('wrote public/favicon.ico');

// The link preview for p31market.com (1200×630).
await sharp(await draw('og', 'banner', [1200, 630])).jpeg({ quality: 90 }).toFile(out('public/og-image.jpg'));
console.log('wrote public/og-image.jpg');

// Page and studio assets
await sharp(icon).resize(192, 192).webp({ quality: 92 }).toFile(out('src/assets/web/p31-market-mark-192.webp'));
await sharp(mark).resize(480).webp({ quality: 92, alphaQuality: 100 }).toFile(out('src/assets/design/mark-market.webp'));
console.log('wrote page and studio marks');

await browser.close();
