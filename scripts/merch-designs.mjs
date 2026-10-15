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
@font-face { font-family: Bebas; font-weight: 400; src: url(${font('bebas-neue', 400)}); }
@font-face { font-family: GreatVibes; font-weight: 400; font-style: normal; src: url(${font('great-vibes', 400)}) format('woff2'); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: transparent; }
.art { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.serif { font-family: Bod, serif; } .cor { font-family: Cor, serif; } .spar { font-family: Spar, sans-serif; } .script { font-family: GreatVibes, cursive; } .bebas { font-family: Bebas, sans-serif; } .nw { white-space: nowrap; }
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
// ── Proverbs 31 symbols, drawn as vectors so they print sharp at any size ──
const svgWrap = (w, vb, inner, h) => `<svg width="${w}" height="${h || w}" viewBox="${vb}" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const flame = (h, color) => `<svg width="${h * 0.6}" height="${h}" viewBox="0 0 60 100" fill="none"><path d="M30 2c6 18 26 28 26 54a26 26 0 0 1-52 0c0-14 8-20 12-30 2 8 6 12 10 12 6-8 6-22 4-36z" fill="${color}"/><path d="M30 46c3 9 12 13 12 24a12 12 0 0 1-24 0c0-7 4-10 6-15 1 4 3 6 5 6 3-4 3-10 1-15z" fill="${C.plumDeep}" opacity="0.55"/></svg>`;
/** Laurel: two branches meeting at the bottom; full = a closed wreath, otherwise a low half wreath. */
function laurel(w, color, { full = false } = {}) {
  const leaves = []; const from = full ? 96 : 110; const to = full ? 262 : 210; const r = 82;
  for (let a = from; a <= to; a += full ? 11 : 13) {
    const t = (a * Math.PI) / 180; const x = 100 + r * Math.cos(t); const y = 100 + r * Math.sin(t);
    const rot = a + 90 + 28;
    for (const side of [-1, 1]) {
      const lx = side < 0 ? x : 200 - x; const lr = side < 0 ? rot : 180 - rot;
      leaves.push(`<ellipse cx="${lx.toFixed(1)}" cy="${y.toFixed(1)}" rx="12" ry="4.6" transform="rotate(${lr.toFixed(1)} ${lx.toFixed(1)} ${y.toFixed(1)})" fill="${color}"/>`);
    }
  }
  const arc = (side) => { const p = (a) => { const t = (a * Math.PI) / 180; const x = 100 + (r - 6) * Math.cos(t); return [side < 0 ? x : 200 - x, 100 + (r - 6) * Math.sin(t)]; }; const [x1, y1] = p(from); const [x2, y2] = p(to); return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A ${r - 6} ${r - 6} 0 0 ${side < 0 ? 1 : 0} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${color}" stroke-width="2.4"/>`; };
  return svgWrap(w, full ? '0 0 200 200' : '0 60 200 140', `${arc(-1)}${arc(1)}${leaves.join('')}`, full ? w : w * 0.7);
}
/** A cut ruby: crown and pavilion facets with a gold edge. */
const gem = (w, edge) => svgWrap(w, '0 0 100 90', `
  <path d="M28 8 L72 8 L94 32 L50 86 L6 32 Z" fill="#8E1B3A" stroke="${edge}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M6 32 L94 32 M28 8 L38 32 L50 86 L62 32 L72 8 M38 32 L50 8 L62 32" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/>
  <path d="M28 8 L38 32 L6 32 Z" fill="#C2405F" opacity="0.8"/><path d="M50 8 L62 32 L38 32 Z" fill="#D9627E" opacity="0.7"/><path d="M62 32 L50 86 L94 32 Z" fill="#5E0F26" opacity="0.6"/>`, w * 0.9);
/** A clay oil lamp with its flame (the candle that goeth not out by night). */
const lamp = (w, body, flameColor) => svgWrap(w, '0 0 200 130', `
  <path d="M100 18c4 12 16 18 16 34a16 16 0 0 1-32 0c0-9 5-13 8-19 1 5 4 8 6 8 4-5 4-14 2-23z" fill="${flameColor}"/>
  <path d="M22 92 Q22 66 70 62 L150 66 Q186 68 188 80 Q186 92 150 94 L72 104 Q22 108 22 92 Z" fill="${body}"/>
  <circle cx="17" cy="84" r="13" stroke="${body}" stroke-width="7"/>
  <ellipse cx="96" cy="70" rx="22" ry="5" fill="${C.plumDeep}" opacity="0.35"/>
  <path d="M60 108 L140 108" stroke="${body}" stroke-width="6" stroke-linecap="round"/>`, w * 0.65);
/** The distaff and the spindle, crossed (Proverbs 31:19). */
const spindle = (w, color, fiber) => svgWrap(w, '0 0 200 200', `
  <path d="M46 170 L158 34" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="62" cy="151" rx="22" ry="8" transform="rotate(-50 62 151)" fill="${color}"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => { const x = 98 + i * 6; const y = 108 - i * 7.3; return `<path d="M${x - 9} ${y - 2} L${x + 9} ${y + 2}" stroke="${fiber}" stroke-width="3" stroke-linecap="round"/>`; }).join('')}
  <path d="M154 170 L52 46" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
  <g fill="${fiber}"><circle cx="50" cy="38" r="18"/><circle cx="66" cy="30" r="14"/><circle cx="38" cy="54" r="14"/><circle cx="60" cy="52" r="13"/><circle cx="36" cy="30" r="11"/></g>
  <path d="M60 60 C 90 90, 70 110, 104 112" stroke="${fiber}" stroke-width="2.4" fill="none"/>`);
/** A grapevine: cluster, leaf and tendril (Proverbs 31:16). */
function vine(w, grape, leaf) {
  const g = []; const rows = [4, 3, 3, 2, 1];
  rows.forEach((n, row) => { for (let i = 0; i < n; i++) g.push(`<circle cx="${100 + (i - (n - 1) / 2) * 19}" cy="${86 + row * 17}" r="10.5" fill="${grape}"/>`); });
  return svgWrap(w, '0 0 200 200', `
    <path d="M100 74 C 100 50, 120 40, 140 34" stroke="${leaf}" stroke-width="4" stroke-linecap="round"/>
    <path d="M118 46 C 132 24, 168 22, 178 42 C 166 44, 160 58, 168 70 C 150 68, 138 74, 132 60 C 126 64, 118 58, 118 46 Z" fill="${leaf}"/>
    <path d="M86 62 C 70 52, 72 36, 86 36 C 96 36, 94 48, 86 48" stroke="${leaf}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    ${g.join('')}`);
}
/** A crown with three jewels. */
const crown = (w, color, jewel) => svgWrap(w, '0 0 120 80', `
  <path d="M10 62 L16 22 L38 44 L60 10 L82 44 L104 22 L110 62 Z" fill="${color}"/>
  <rect x="10" y="62" width="100" height="10" rx="2" fill="${color}"/>
  <circle cx="16" cy="20" r="5" fill="${color}"/><circle cx="60" cy="8" r="6" fill="${color}"/><circle cx="104" cy="20" r="5" fill="${color}"/>
  <circle cx="38" cy="66" r="3.4" fill="${jewel}"/><circle cx="60" cy="66" r="3.8" fill="${jewel}"/><circle cx="82" cy="66" r="3.4" fill="${jewel}"/>`, w * 0.67);
/** A snowflake (she is not afraid of the snow). */
const snow = (w, color) => svgWrap(w, '0 0 100 100', [0, 60, 120].map((a) => `<g transform="rotate(${a} 50 50)" stroke="${color}" stroke-width="4" stroke-linecap="round"><path d="M50 6 L50 94"/><path d="M50 20 L40 12 M50 20 L60 12 M50 80 L40 88 M50 80 L60 88 M50 34 L42 28 M50 34 L58 28 M50 66 L42 72 M50 66 L58 72"/></g>`).join(''));

// Each design: a body for a 1200 x 1600 CSS-px canvas (rendered at 3x = 12 x 16 in at 300 DPI).
// t = tone: { ink, soft, accent } chosen for a dark or a light garment.
const DESIGNS = [
  { id: 'strength', name: 'Strength & Honour', line: 'Proverbs 31:25', body: (t) => `
    ${laurel(440, t.accent)}
    <div class="cor caps" style="font-size:42px;letter-spacing:14px;color:${t.accent};font-weight:600;margin-top:10px">Proverbs 31 : 25</div>
    <div class="serif caps" style="font-size:150px;line-height:0.92;font-weight:700;color:${t.ink};letter-spacing:2px;margin-top:42px">Strength<br>&amp; Honour</div>
    <div class="cor" style="font-size:112px;font-style:italic;font-weight:500;color:${t.accent};margin-top:28px;line-height:1">are her clothing</div>
    <div class="cor caps nw" style="font-size:30px;letter-spacing:9px;color:${t.soft};margin-top:64px">and she shall rejoice in time to come</div>` },
  { id: 'candle', name: 'Her Candle', line: 'Proverbs 31:18', body: (t) => `
    ${lamp(470, t.accent, t.flame)}
    <div class="cor" style="font-size:118px;font-style:italic;font-weight:500;color:${t.ink};line-height:1.08;margin-top:44px">Her candle goeth<br>not out by night.</div>
    <div class="rule" style="width:90px;margin:52px 0 40px;color:${t.accent}"></div>
    <div class="cor caps" style="font-size:40px;letter-spacing:14px;color:${t.accent};font-weight:600">Proverbs 31 : 18</div>` },
  { id: 'merchandise', name: 'Her Merchandise Is Good', line: 'Proverbs 31:18', body: (t) => `
    <div class="cor caps" style="font-size:38px;letter-spacing:13px;color:${t.accent};font-weight:600">✦ &nbsp;She perceiveth that&nbsp; ✦</div>
    <div class="serif caps nw" style="font-size:150px;line-height:0.92;font-weight:800;color:${t.ink};margin:36px 0 0;letter-spacing:-2px">Her<br>Merchandise</div>
    <div class="script" style="font-size:190px;line-height:1;color:${t.accent}">is good</div>
    <div class="cor caps nw" style="font-size:30px;letter-spacing:9px;color:${t.soft};margin-top:54px">Proverbs 31 : 18 &nbsp;·&nbsp; p31market.com</div>` },
  { id: 'praised', name: 'She Shall Be Praised', line: 'Proverbs 31:30', body: (t) => `
    ${crown(250, t.accent, t.jewel)}
    <div class="cor nw" style="font-size:78px;font-style:italic;color:${t.soft};line-height:1.1;margin-top:36px">A woman that feareth the Lord,</div>
    <div class="serif caps" style="font-size:168px;line-height:0.95;font-weight:700;color:${t.ink};margin:40px 0">She shall<br>be praised</div>
    <div class="rule" style="width:120px;color:${t.accent}"></div>
    <div class="cor caps" style="font-size:40px;letter-spacing:14px;color:${t.accent};font-weight:600;margin-top:40px">Proverbs 31 : 30</div>` },
  { id: 'rise', name: 'Rise & Build', line: 'Proverbs 31 Marketplace', body: (t, onLight) => `
    <div class="cor caps" style="font-size:66px;letter-spacing:26px;padding-left:26px;color:${t.accent};font-weight:600">Rise &amp; Build</div>
    <div style="margin:70px 0 80px">${panels(620, { onLight })}</div>
    <div class="serif caps" style="font-size:78px;letter-spacing:8px;color:${t.ink};font-weight:700">Proverbs 31</div>
    <div class="cor caps" style="font-size:44px;letter-spacing:18px;padding-left:18px;color:${t.soft};margin-top:14px">Marketplace</div>` },
  { id: 'room', name: 'Where Her Gifts Make Room', line: 'Proverbs 18:16', body: (t) => `
    <div style="border:7px solid ${t.accent};border-bottom:0;border-radius:520px 520px 0 0;padding:190px 90px 70px;display:flex;flex-direction:column;align-items:center">
      <div class="cor caps" style="font-size:34px;letter-spacing:12px;color:${t.accent};font-weight:600">✦</div>
      <div class="cor" style="font-size:142px;font-style:italic;font-weight:500;line-height:1.02;color:${t.ink};margin-top:24px">Where her gifts<br>make room.</div>
    </div>
    <div class="rule" style="width:980px;color:${t.accent};height:7px"></div>
    <div class="cor caps" style="font-size:40px;letter-spacing:14px;color:${t.accent};font-weight:600;margin-top:44px">Proverbs 31 Marketplace</div>
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
    ${gem(170, t.accent)}
    <div class="cor caps" style="font-size:40px;letter-spacing:14px;color:${t.accent};font-weight:600;margin-top:30px">Who can find a</div>
    <div class="script" style="font-size:300px;line-height:0.95;color:${t.ink};margin:10px 0 0">Virtuous</div>
    <div class="serif caps" style="font-size:150px;line-height:1;font-weight:700;color:${t.ink};letter-spacing:14px;padding-left:14px">Woman</div>
    <div class="cor nw" style="font-size:66px;font-style:italic;color:${t.accent};margin-top:36px">for her price is far above rubies</div>
    <div class="cor caps" style="font-size:34px;letter-spacing:12px;color:${t.soft};margin-top:48px">Proverbs 31 : 10</div>` },
  // ── New: symbols and powerful pieces from Proverbs 31 ──
  { id: 'rubies', name: 'Far Above Rubies', line: 'Proverbs 31:10', body: (t) => `
    ${gem(400, t.accent)}
    <div class="cor caps nw" style="font-size:66px;letter-spacing:30px;padding-left:30px;color:${t.accent};font-weight:600;margin-top:70px">Far above</div>
    <div class="serif caps" style="font-size:250px;line-height:0.95;font-weight:800;color:${t.ink};letter-spacing:6px">Rubies</div>
    <div class="cor nw" style="font-size:62px;font-style:italic;color:${t.soft};margin-top:34px">Who can find a virtuous woman?</div>
    <div class="cor caps" style="font-size:34px;letter-spacing:12px;color:${t.accent};margin-top:40px;font-weight:600">Proverbs 31 : 10</div>` },
  { id: 'spindle', name: 'The Spindle', line: 'Proverbs 31:19', body: (t) => `
    <div style="width:700px;height:700px;border-radius:50%;border:8px solid ${t.accent};display:grid;place-items:center;position:relative">
      <div style="position:absolute;inset:22px;border-radius:50%;border:2px solid ${t.accent};opacity:0.7"></div>
      ${spindle(470, t.accent, t.soft)}
    </div>
    <div class="cor" style="font-size:84px;font-style:italic;font-weight:500;color:${t.ink};line-height:1.1;margin-top:60px">She layeth her hands<br>to the spindle</div>
    <div class="cor" style="font-size:60px;font-style:italic;color:${t.soft};margin-top:24px">and her hands hold the distaff.</div>
    <div class="cor caps" style="font-size:34px;letter-spacing:12px;color:${t.accent};font-weight:600;margin-top:40px">Proverbs 31 : 19</div>` },
  { id: 'vineyard', name: 'She Planteth a Vineyard', line: 'Proverbs 31:16', body: (t) => `
    ${vine(480, t.grape, t.accent)}
    <div class="cor nw" style="font-size:76px;font-style:italic;color:${t.soft};margin-top:24px">With the fruit of her hands</div>
    <div class="serif caps" style="font-size:122px;line-height:0.98;font-weight:700;color:${t.ink};letter-spacing:3px;margin-top:30px">She planteth<br>a vineyard</div>
    <div class="cor caps" style="font-size:36px;letter-spacing:13px;color:${t.accent};font-weight:600;margin-top:50px">Proverbs 31 : 16</div>` },
  { id: 'girded', name: 'Girded With Strength', line: 'Proverbs 31:17', body: (t) => `
    <div class="bebas caps nw" style="font-size:228px;line-height:0.86;color:${t.ink};letter-spacing:2px">She girdeth</div>
    <div class="bebas caps nw" style="font-size:228px;line-height:0.86;color:${t.ink};letter-spacing:2px">her loins</div>
    <div class="bebas caps nw" style="font-size:228px;line-height:0.86;color:${t.accent};letter-spacing:2px">with strength</div>
    <div class="rule" style="width:760px;color:${t.accent};height:6px;margin:44px 0 36px"></div>
    <div class="cor caps nw" style="font-size:30px;letter-spacing:9px;color:${t.soft};font-weight:600">and strengtheneth her arms · Proverbs 31 : 17</div>` },
  { id: 'crest', name: 'A Woman of Valor', line: 'Proverbs XXXI', body: (t) => `
    ${crown(230, t.accent, t.jewel)}
    <div style="position:relative;width:820px;height:820px;display:grid;place-items:center;margin-top:-10px">
      <div style="position:absolute;inset:0">${laurel(820, t.accent, { full: true })}</div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <div class="cor caps nw" style="font-size:36px;letter-spacing:14px;padding-left:14px;color:${t.soft};font-weight:600">Proverbs</div>
        <div class="serif" style="font-size:165px;line-height:1;font-weight:700;color:${t.ink};letter-spacing:2px">XXXI</div>
      </div>
    </div>
    <div class="cor caps nw" style="font-size:58px;letter-spacing:22px;padding-left:22px;color:${t.accent};font-weight:600;margin-top:20px">A woman of valor</div>` },
  { id: 'notafraid', name: 'She Is Not Afraid', line: 'Proverbs 31:21', body: (t) => `
    ${snow(170, t.accent)}
    <div class="cor caps nw" style="font-size:70px;letter-spacing:30px;padding-left:30px;color:${t.accent};font-weight:600;margin-top:50px">She is</div>
    <div class="serif caps nw" style="font-size:146px;line-height:0.95;font-weight:800;color:${t.ink};letter-spacing:1px;margin-top:14px">Not afraid</div>
    <div class="cor" style="font-size:58px;font-style:italic;color:${t.soft};line-height:1.18;margin-top:42px">of the snow for her household:<br>for all her household<br>are clothed with scarlet.</div>
    <div class="cor caps" style="font-size:34px;letter-spacing:12px;color:${t.accent};margin-top:44px;font-weight:600">Proverbs 31 : 21</div>` },
];
const TONES = {
  dark: { ink: C.cream, soft: C.thistle, accent: C.goldHi, flame: '#F7E08A', jewel: '#C2405F', grape: '#B98CCB' },   // on black, plum, navy, forest
  light: { ink: C.plum, soft: C.amethyst, accent: C.goldDeep, flame: C.gold, jewel: '#8E1B3A', grape: C.plum }, // on white, cream, sand, lilac
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
  const mugs = Object.fromEntries(['candle', 'merchandise', 'pray', 'room', 'rise', 'rubies', 'spindle', 'vineyard', 'notafraid', 'crest'].map((id) => [id, 'light']));
  for (const [id, tone] of Object.entries(mugs)) {
    const d = DESIGNS.find((x) => x.id === id);
    const side = `<div style="width:300px;height:340px;display:flex;align-items:center;justify-content:center;transform:scale(0.245);transform-origin:center"><div style="flex:none;width:1100px;height:1300px;display:flex;flex-direction:column;align-items:center;justify-content:center">${d.body(TONES[tone], true)}</div></div>`;
    await render(join(OUT, `mug-${id}.png`), 900, 350, `<div style="display:flex;justify-content:space-between;align-items:center;width:100%;height:100%;padding:0 40px">${side}${side}</div>`);
  }
  // Stickers (3 x 3 in with bleed): a round badge on cream.
  const stickers = ['rise', 'hands', 'pray', 'candle', 'rubies', 'crest', 'spindle'];
  for (const id of stickers) {
    const d = DESIGNS.find((x) => x.id === id);
    await render(join(OUT, `sticker-${id}.png`), 1000, 1000, `<div style="width:1000px;height:1000px;border-radius:50%;background:${C.cream};border:14px solid ${C.gold};display:flex;align-items:center;justify-content:center;overflow:hidden"><div style="flex:none;transform:scale(0.56);width:1200px;height:1600px;display:flex;flex-direction:column;align-items:center;justify-content:center">${d.body(TONES.light, true)}</div></div>`, { scale: 1 });
  }
  // Journal covers (5.75 x 8 in, upright): full plum cover with a gold frame and the design.
  const journals = ['pray', 'room', 'strength', 'crest', 'vineyard'];
  for (const id of journals) {
    const d = DESIGNS.find((x) => x.id === id);
    await render(join(OUT, `journal-${id}.png`), 575, 800, `<div style="width:575px;height:800px;background:${C.plum};display:flex;align-items:center;justify-content:center;overflow:hidden;border:10px solid ${C.plum};outline:3px solid ${C.gold};outline-offset:-26px"><div style="flex:none;transform:scale(0.4);width:1200px;height:1600px;display:flex;flex-direction:column;align-items:center;justify-content:center">${d.body(TONES.dark, false)}</div></div>`, { scale: 3, bg: C.plum });
  }
}

// Cap embroidery (front, 4 x 1.75 in): flat thread colours only. White on black, Printful purple on stone.
// THREADS lists the exact Printful thread colours each file uses (sent with the order).
const THREADS = { 'hat-pray-dark': ['#FFFFFF', '#FFCC00'], 'hat-pray-light': ['#6B5294', '#A67843'], 'hat-crest-dark': ['#FFFFFF', '#FFCC00'], 'hat-crest-light': ['#6B5294', '#A67843'] };
if (!previewOnly) {
  for (const [tone, ink, accent] of [['dark', '#FFFFFF', '#FFCC00'], ['light', '#6B5294', '#A67843']]) {
    await render(join(OUT, `hat-crest-${tone}.png`), 400, 175, `<div style="display:flex;flex-direction:column;align-items:center"><div class="serif nw" style="font-size:84px;font-weight:700;line-height:0.95;color:${ink};letter-spacing:3px">XXXI</div><div class="serif caps nw" style="font-size:22px;font-weight:700;letter-spacing:7px;padding-left:7px;color:${accent};margin-top:6px">Proverbs</div></div>`);
    await render(join(OUT, `hat-pray-${tone}.png`), 400, 175, `<div class="spar caps nw" style="font-size:58px;font-weight:900;letter-spacing:1px;color:${ink}">Pray<span style="color:${accent}">.</span> Plan<span style="color:${accent}">.</span> Build<span style="color:${accent}">.</span></div>`);
  }
}

// Every print file goes to public/merch/print (Printful downloads them from the website) with its size.
{
  const { readdirSync, copyFileSync, writeFileSync } = await import('node:fs');
  const PUB = join(ROOT, 'public/merch/print');
  mkdirSync(PUB, { recursive: true });
  const sizes = {};
  for (const name of readdirSync(OUT).filter((n) => n.endsWith('.png')).sort()) {
    copyFileSync(join(OUT, name), join(PUB, name));
    // A light web copy for the merch page (the print file is for Printful only).
    mkdirSync(join(ROOT, 'public/merch/thumbs'), { recursive: true });
    await sharp(join(OUT, name)).resize(720, 720, { fit: 'inside' }).webp({ quality: 86 }).toFile(join(ROOT, 'public/merch/thumbs', name.replace(/.png$/, '.webp')));
    const m = await sharp(join(OUT, name)).metadata();
    sizes[name.replace(/\.png$/, '')] = [m.width, m.height];
  }
  writeFileSync(join(ROOT, 'supabase/functions/_shared/merch-files.js'), [
    '// GENERATED by scripts/merch-designs.mjs: each print file in public/merch/print and its size in pixels.',
    `export const PRINT_FILES = ${JSON.stringify(sizes, null, 1)};`,
    `export const THREADS = ${JSON.stringify(THREADS)};`,
    '',
  ].join('\n'));
  console.log('print files:', Object.keys(sizes).length);
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
