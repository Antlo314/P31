// P31 merch designs for Printful: print-ready PNGs (300 DPI, transparent) and quick previews.
//   node scripts/merch-designs.mjs            everything
//   node scripts/merch-designs.mjs --preview  previews only (reuses the print files)
// Output: marketing/merch/print/<design>-<dark|light>.png  (12 x 16 in, 3600 x 4800 px, apparel and totes)
//         marketing/merch/print/mug-<design>.png            (11 oz wrap, 2700 x 1050 px)
//         marketing/merch/print/sticker-<design>.png        (3 x 3 in + bleed, 1000 x 1000 px)
//         marketing/merch/print/journal-<design>.png        (8 x 5.75 in cover, 2400 x 1725 px)
//         marketing/merch/preview/*.jpg and marketing/merch/preview/sheet.jpg
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(ROOT, 'package.json'));
const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
const OUT = join(ROOT, 'marketing/merch/print');
const PREV = join(ROOT, 'marketing/merch/preview');
mkdirSync(OUT, { recursive: true }); mkdirSync(PREV, { recursive: true });
const previewOnly = process.argv.includes('--preview');

// Brand
const C = { plum: '#3A1C36', plumDeep: '#21101E', thistle: '#E3D0EA', amethyst: '#9B71B2', gold: '#D9A93A', goldHi: '#F2CE4D', goldDeep: '#A8802E', cream: '#FBF2E4', olive: '#6C6D11', green: '#374126', panel: '#582A51', ink: '#FFFBF3' };
// Fonts go in as data URLs: file:// fonts do not always load into a page made with setContent.
const font = (fam, w, style = 'normal') => `data:font/woff2;base64,${readFileSync(join(ROOT, `node_modules/@fontsource/${fam}/files/${fam}-latin-${w}-${style}.woff2`)).toString('base64')}`;
const dataUrl = (p) => `data:image/png;base64,${readFileSync(join(ROOT, p)).toString('base64')}`;
const HANDS = { color: dataUrl('marketing/brand/collective/hands-color.png'), white: dataUrl('marketing/brand/collective/hands-white.png') };

const CSS = `
@font-face { font-family: Bod; font-weight: 400; src: url(${font('bodoni-moda', 400)}); }
@font-face { font-family: Bod; font-weight: 700; src: url(${font('bodoni-moda', 700)}); }
@font-face { font-family: Bod; font-weight: 800; src: url(${font('bodoni-moda', 800)}); }
@font-face { font-family: Cor; font-weight: 500; src: url(${font('cormorant-garamond', 500)}); }
@font-face { font-family: Cor; font-weight: 600; src: url(${font('cormorant-garamond', 600)}); }
@font-face { font-family: Cor; font-weight: 500; font-style: italic; src: url(${font('cormorant-garamond', 500, 'italic')}); }
@font-face { font-family: Cor; font-weight: 700; font-style: italic; src: url(${font('cormorant-garamond', 700, 'italic')}); }
@font-face { font-family: Spar; font-weight: 700; src: url(${font('league-spartan', 700)}); }
@font-face { font-family: Spar; font-weight: 900; src: url(${font('league-spartan', 900)}); }
@font-face { font-family: GreatVibes; font-weight: 400; font-style: normal; src: url(${font('great-vibes', 400)}) format('woff2'); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: transparent; }
.art { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.serif { font-family: Bod, serif; } .cor { font-family: Cor, serif; } .spar { font-family: Spar, sans-serif; } .script { font-family: GreatVibes, cursive; } .nw { white-space: nowrap; }
.caps { text-transform: uppercase; }
.gilt { color: ${C.ink}; -webkit-text-stroke: var(--edge) ${C.gold}; paint-order: stroke fill; text-shadow: var(--sh) var(--sh) 0 ${C.goldDeep}; }
.rule { height: 3px; background: currentColor; opacity: 0.9; }
.panels { display: grid; grid-template-columns: 1fr 1fr 1fr; }
.panel { background: ${C.panel}; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: space-between; border: 2px solid ${C.gold}; }
.col { font-family: Bod; font-weight: 800; line-height: 1; }
.num { position: absolute; inset: 0; display: grid; place-items: center; font-family: Bod; font-weight: 500; line-height: 1; }
`;

// The Market's three panels (PROVERBS · 31 · MARKETS); u = panel height in px.
function panels(u, { onLight = false } = {}) {
  const pw = u * 0.445, gap = u * 0.054, size = u * 0.088;
  const bg = onLight ? C.plum : C.panel;
  const col = (word) => `<div class="panel" style="background:${bg};padding:${u * 0.07}px 0 ${u * 0.06}px">${[...word].map((ch) => `<span class="col gilt" style="font-size:${size}px">${ch}</span>`).join('')}</div>`;
  return `<div class="panels" style="--edge:${u * 0.004}px;--sh:${u * 0.004}px;width:${pw * 3 + gap * 2}px;height:${u}px;column-gap:${gap}px">${col('PROVERBS')}<div class="panel" style="background:${bg}"><span class="num gilt" style="font-size:${u * 0.3}px">31</span></div>${col('MARKETS')}</div>`;
}
const flame = (h, color) => `<svg width="${h * 0.6}" height="${h}" viewBox="0 0 60 100" fill="none"><path d="M30 2c6 18 26 28 26 54a26 26 0 0 1-52 0c0-14 8-20 12-30 2 8 6 12 10 12 6-8 6-22 4-36z" fill="${color}"/><path d="M30 46c3 9 12 13 12 24a12 12 0 0 1-24 0c0-7 4-10 6-15 1 4 3 6 5 6 3-4 3-10 1-15z" fill="${C.plumDeep}" opacity="0.55"/></svg>`;

// Each design: a body for a 1200 x 1600 CSS-px canvas (rendered at 3x = 12 x 16 in at 300 DPI).
// t = tone: { ink, soft, accent } chosen for a dark or a light garment.
const DESIGNS = [
  { id: 'strength', name: 'Strength & Honour', line: 'Proverbs 31:25', body: (t) => `
    <div class="cor caps" style="font-size:44px;letter-spacing:14px;color:${t.accent};font-weight:600">Proverbs 31 : 25</div>
    <div class="rule" style="width:120px;margin:34px 0 46px;color:${t.accent}"></div>
    <div class="serif caps" style="font-size:150px;line-height:0.92;font-weight:700;color:${t.ink};letter-spacing:2px">Strength<br>&amp; Honour</div>
    <div class="cor" style="font-size:112px;font-style:italic;font-weight:500;color:${t.accent};margin-top:28px;line-height:1">are her clothing</div>
    <div class="cor caps nw" style="font-size:30px;letter-spacing:9px;color:${t.soft};margin-top:70px">and she shall rejoice in time to come</div>` },
  { id: 'candle', name: 'Her Candle', line: 'Proverbs 31:18', body: (t) => `
    ${flame(170, t.accent)}
    <div class="cor" style="font-size:118px;font-style:italic;font-weight:500;color:${t.ink};line-height:1.08;margin-top:40px;max-width:1000px">Her candle goeth<br>not out by night.</div>
    <div class="rule" style="width:90px;margin:52px 0 40px;color:${t.accent}"></div>
    <div class="cor caps" style="font-size:40px;letter-spacing:14px;color:${t.accent};font-weight:600">Proverbs 31 : 18</div>` },
  { id: 'merchandise', name: 'Her Merchandise Is Good', line: 'Proverbs 31:18', body: (t) => `
    <div class="cor caps" style="font-size:38px;letter-spacing:13px;color:${t.accent};font-weight:600">She perceiveth that</div>
    <div class="serif caps nw" style="font-size:150px;line-height:0.92;font-weight:800;color:${t.ink};margin:36px 0 0;letter-spacing:-2px">Her<br>Merchandise</div>
    <div class="script" style="font-size:190px;line-height:1;color:${t.accent}">is good</div>
    <div class="cor caps nw" style="font-size:30px;letter-spacing:9px;color:${t.soft};margin-top:54px">Proverbs 31 : 18 &nbsp;·&nbsp; p31market.com</div>` },
  { id: 'praised', name: 'She Shall Be Praised', line: 'Proverbs 31:30', body: (t) => `
    <div class="cor nw" style="font-size:78px;font-style:italic;color:${t.soft};line-height:1.1">A woman that feareth the Lord,</div>
    <div class="serif caps" style="font-size:168px;line-height:0.95;font-weight:700;color:${t.ink};margin:40px 0">She shall<br>be praised</div>
    <div class="rule" style="width:120px;color:${t.accent}"></div>
    <div class="cor caps" style="font-size:40px;letter-spacing:14px;color:${t.accent};font-weight:600;margin-top:40px">Proverbs 31 : 30</div>` },
  { id: 'rise', name: 'Rise & Build', line: 'Proverbs 31 Marketplace', body: (t, onLight) => `
    <div class="cor caps" style="font-size:66px;letter-spacing:26px;padding-left:26px;color:${t.accent};font-weight:600">Rise &amp; Build</div>
    <div style="margin:70px 0 80px">${panels(620, { onLight })}</div>
    <div class="serif caps" style="font-size:78px;letter-spacing:8px;color:${t.ink};font-weight:700">Proverbs 31</div>
    <div class="cor caps" style="font-size:44px;letter-spacing:18px;padding-left:18px;color:${t.soft};margin-top:14px">Marketplace</div>` },
  { id: 'room', name: 'Where Her Gifts Make Room', line: 'Proverbs 18:16', body: (t) => `
    <div class="cor" style="font-size:150px;font-style:italic;font-weight:500;line-height:1.02;color:${t.ink}">Where her gifts<br>make room.</div>
    <div class="rule" style="width:140px;margin:64px 0 44px;color:${t.accent}"></div>
    <div class="cor caps" style="font-size:40px;letter-spacing:14px;color:${t.accent};font-weight:600">Proverbs 31 Marketplace</div>
    <div class="cor caps" style="font-size:30px;letter-spacing:10px;color:${t.soft};margin-top:18px">Atlanta, Georgia</div>` },
  { id: 'pray', name: 'Pray. Plan. Build.', line: 'Habakkuk 2:2', body: (t) => `
    <div class="spar caps" style="font-size:250px;line-height:0.9;font-weight:900;color:${t.ink};letter-spacing:-4px">Pray.</div>
    <div class="spar caps" style="font-size:250px;line-height:0.9;font-weight:900;color:${t.accent};letter-spacing:-4px">Plan.</div>
    <div class="spar caps" style="font-size:250px;line-height:0.9;font-weight:900;color:${t.ink};letter-spacing:-4px">Build.</div>
    <div class="cor caps nw" style="font-size:32px;letter-spacing:9px;color:${t.soft};margin-top:70px">Write the vision &nbsp;·&nbsp; Habakkuk 2 : 2</div>` },
  { id: 'hands', name: 'Built by Her Hands', line: 'The P31 Collective', body: (t, onLight) => `
    <img src="${onLight ? HANDS.color : HANDS.white}" style="width:520px;height:520px;object-fit:contain">
    <div class="serif caps" style="font-size:118px;line-height:1;font-weight:700;color:${t.ink};margin-top:40px;letter-spacing:4px">Built by<br>her hands</div>
    <div class="cor caps nw" style="font-size:34px;letter-spacing:11px;color:${t.accent};font-weight:600;margin-top:48px">The P31 Collective by NEBA</div>` },
  { id: 'collective', name: 'The P31 Collective', line: 'Member', body: (t, onLight) => `
    <img src="${onLight ? HANDS.color : HANDS.white}" style="width:640px;height:640px;object-fit:contain">
    <div class="serif caps" style="font-size:96px;line-height:1;font-weight:700;color:${t.ink};margin-top:48px;letter-spacing:6px">The P31 Collective</div>
    <div class="cor caps nw" style="font-size:34px;letter-spacing:12px;padding-left:12px;color:${t.accent};font-weight:600;margin-top:24px">Kingdom women in business</div>` },
  { id: 'virtuous', name: 'Virtuous Woman', line: 'Proverbs 31:10', body: (t) => `
    <div class="cor caps" style="font-size:40px;letter-spacing:14px;color:${t.accent};font-weight:600">Who can find a</div>
    <div class="script" style="font-size:300px;line-height:0.95;color:${t.ink};margin:10px 0 0">Virtuous</div>
    <div class="serif caps" style="font-size:150px;line-height:1;font-weight:700;color:${t.ink};letter-spacing:14px;padding-left:14px">Woman</div>
    <div class="cor nw" style="font-size:66px;font-style:italic;color:${t.accent};margin-top:36px">for her price is far above rubies</div>
    <div class="cor caps" style="font-size:34px;letter-spacing:12px;color:${t.soft};margin-top:48px">Proverbs 31 : 10</div>` },
];
const TONES = {
  dark: { ink: C.cream, soft: C.thistle, accent: C.goldHi },   // on black, plum, navy, forest
  light: { ink: C.plum, soft: C.amethyst, accent: C.goldDeep }, // on white, cream, sand, lilac
};
const page = (w, h, body, bg = 'transparent') => `<!doctype html><html><head><style>${CSS}</style></head><body><div class="art" style="width:${w}px;height:${h}px;background:${bg}">${body}</div></body></html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const tab = await browser.newPage();
async function render(file, w, h, body, { scale = 3, bg = 'transparent' } = {}) {
  await tab.setViewport({ width: w, height: h, deviceScaleFactor: scale });
  await tab.setContent(page(w, h, body, bg), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: file, omitBackground: bg === 'transparent', clip: { x: 0, y: 0, width: w, height: h } });
  console.log('wrote', file.replace(ROOT, '').replace(/\\/g, '/'));
}
const wrap = (inner, pad = 100) => `<div style="padding:${pad}px;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%">${inner}</div>`;

if (!previewOnly) {
  for (const d of DESIGNS) {
    for (const tone of ['dark', 'light']) {
      const file = join(OUT, `${d.id}-${tone}.png`);
      await render(file, 1200, 1600, wrap(d.body(TONES[tone], tone === 'light')));
      const buf = await sharp(file).trim().extend({ top: 60, bottom: 60, left: 60, right: 60, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      await sharp(buf).toFile(file);
    }
  }
  // Mugs (11 oz wrap 9 x 3.5 in): the design on each side, so it reads right- and left-handed.
  const mugs = { 'candle': 'light', 'merchandise': 'light', 'pray': 'light', 'room': 'light', 'rise': 'light' };
  for (const [id, tone] of Object.entries(mugs)) {
    const d = DESIGNS.find((x) => x.id === id);
    const side = `<div style="width:300px;height:340px;display:flex;align-items:center;justify-content:center;transform:scale(0.245);transform-origin:center"><div style="flex:none;width:1100px;height:1300px;display:flex;flex-direction:column;align-items:center;justify-content:center">${d.body(TONES[tone], true)}</div></div>`;
    await render(join(OUT, `mug-${id}.png`), 900, 350, `<div style="display:flex;justify-content:space-between;align-items:center;width:100%;height:100%;padding:0 40px">${side}${side}</div>`);
  }
  // Stickers (3 x 3 in with bleed): a round badge on cream.
  const stickers = ['rise', 'hands', 'pray', 'candle'];
  for (const id of stickers) {
    const d = DESIGNS.find((x) => x.id === id);
    await render(join(OUT, `sticker-${id}.png`), 1000, 1000, `<div style="width:1000px;height:1000px;border-radius:50%;background:${C.cream};border:14px solid ${C.gold};display:flex;align-items:center;justify-content:center;overflow:hidden"><div style="flex:none;transform:scale(0.56);width:1200px;height:1600px;display:flex;flex-direction:column;align-items:center;justify-content:center">${d.body(TONES.light, true)}</div></div>`, { scale: 1 });
  }
  // Journal covers (8 x 5.75 in): full plum cover, gold design.
  const journals = ['pray', 'room', 'strength'];
  for (const id of journals) {
    const d = DESIGNS.find((x) => x.id === id);
    await render(join(OUT, `journal-${id}.png`), 800, 575, `<div style="width:800px;height:575px;background:${C.plum};display:flex;align-items:center;justify-content:center;overflow:hidden"><div style="flex:none;transform:scale(0.33);width:1200px;height:1600px;display:flex;flex-direction:column;align-items:center;justify-content:center">${d.body(TONES.dark, false)}</div></div>`, { scale: 3, bg: C.plum });
  }
}

// Previews: each print file on a garment-coloured background, then one sheet.
const GARMENT = { dark: ['Black', '#0c0c0c'], light: ['Natural', '#fef1d1'] };
const previews = [];
for (const d of DESIGNS) {
  for (const tone of ['dark', 'light']) {
    const art = await sharp(join(OUT, `${d.id}-${tone}.png`)).resize(520, 600, { fit: 'inside' }).png().toBuffer();
    const m = await sharp(art).metadata();
    const out = join(PREV, `${d.id}-${tone}.jpg`);
    await sharp({ create: { width: 700, height: 900, channels: 3, background: GARMENT[tone][1] } }).composite([{ input: art, top: Math.round(180 - 0) + Math.round((600 - m.height) / 2), left: 90 + Math.round((520 - m.width) / 2) }]).jpeg({ quality: 82 }).toFile(out);
    previews.push(out);
  }
}
const tiles = await Promise.all(previews.map((p) => sharp(p).resize(350, 450).toBuffer()));
const cols = 5, rows = Math.ceil(tiles.length / cols);
await sharp({ create: { width: 350 * cols, height: 450 * rows, channels: 3, background: '#ffffff' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * 350, top: Math.floor(i / cols) * 450 })))
  .jpeg({ quality: 80 }).toFile(join(PREV, 'sheet.jpg'));
await browser.close();
console.log(`done: ${DESIGNS.length} designs, previews in marketing/merch/preview`);
