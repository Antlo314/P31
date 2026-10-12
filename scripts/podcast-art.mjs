// Cuts the P31 Podcast flyer (marketing/brand/podcast/p31-podcast-flyer.png, 640×330) into the
// pieces the site's podcast band uses, each on a transparent background so it sits on any dark
// section: the emblem (crown, P31, microphone), the five platform icons and the lotus ornament.
// The flat plum background is removed by colour-to-alpha (each pixel is un-mixed from the
// background), then the pieces are enlarged 2× for sharp screens.
//   node scripts/podcast-art.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'marketing/brand/podcast/p31-podcast-flyer.png');
const OUT = join(ROOT, 'src/assets/podcast');
mkdirSync(OUT, { recursive: true });

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const at = (x, y) => (y * W + x) * 3;

// The background: the median of the four corners.
const corners = [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]].map(([x, y]) => [...data.subarray(at(x, y), at(x, y) + 3)]);
const BG = [0, 1, 2].map((c) => corners.map((p) => p[c]).sort((a, b) => a - b)[2]);

/** RGBA for a rectangle, with the background turned into transparency. */
function cutout(x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(x0 + x, y0 + y);
      const c = [data[i], data[i + 1], data[i + 2]];
      // How far is this pixel from the background, as a fraction of the way to white or black?
      let a = 0;
      for (let k = 0; k < 3; k++) {
        // Lighter than the background: gold and white. Darker (the black lines in the microphone grille)
        // is scaled gently, or the faint noise in the near-zero channels would read as shape.
        const d = c[k] > BG[k] ? (c[k] - BG[k]) / (255 - BG[k]) : (BG[k] - c[k]) / 80;
        a = Math.max(a, d);
      }
      a = Math.max(0, (a - 0.04) / 0.96); // the background is not perfectly flat: ignore its faint noise
      a = Math.min(1, a * 1.08); // a touch more body for the thin gold lines
      const o = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) out[o + k] = a > 0.004 ? Math.max(0, Math.min(255, Math.round((c[k] - BG[k] * (1 - a)) / a))) : 0;
      out[o + 3] = Math.round(a * 255);
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } });
}

async function save(name, x0, y0, w, h, scale = 2) {
  const img = cutout(x0, y0, w, h).resize(Math.round(w * scale), Math.round(h * scale), { kernel: 'lanczos3' }).sharpen({ sigma: 0.6 });
  await img.webp({ quality: 86, alphaQuality: 90, effort: 6 }).toFile(join(OUT, `${name}.webp`));
  console.log(`${name}.webp  ${Math.round(w * scale)}×${Math.round(h * scale)}`);
}

/** Bright clusters along a band, separated by empty columns: used to find each icon. */
function clusters(x0, x1, y0, y1, minWidth = 8) {
  const bright = (x) => { for (let y = y0; y <= y1; y++) { const i = at(x, y); if (Math.max(Math.abs(data[i] - BG[0]), Math.abs(data[i + 1] - BG[1]), Math.abs(data[i + 2] - BG[2])) > 40) return true; } return false; };
  const found = []; let start = -1;
  for (let x = x0; x <= x1 + 1; x++) {
    const on = x <= x1 && bright(x);
    if (on && start < 0) start = x;
    if (!on && start >= 0) { if (x - start >= minWidth) found.push([start, x - 1]); start = -1; }
  }
  return found;
}
/** Top and bottom of the bright pixels between two columns. */
function rows(x0, x1, y0, y1) {
  let top = -1; let bottom = -1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = at(x, y);
      if (Math.max(Math.abs(data[i] - BG[0]), Math.abs(data[i + 1] - BG[1]), Math.abs(data[i + 2] - BG[2])) > 40) { if (top < 0) top = y; bottom = y; break; }
    }
  }
  return [top, bottom];
}

console.log('background', BG.join(','));

// 1. The emblem: the whole left circle.
await save('emblem', 6, 0, 334, 330, 2);

// 2. The five platform icons (the band above the labels; thin divider lines are skipped).
const ICONS = ['apple', 'spotify', 'iheart', 'audible', 'youtube'];
const iconCols = clusters(356, 634, 30, 58, 12);
if (iconCols.length !== ICONS.length) throw new Error(`expected 5 icons, found ${iconCols.length}: ${JSON.stringify(iconCols)}`);
for (const [n, [a, b]] of iconCols.entries()) {
  const [top, bottom] = rows(a, b, 26, 58);
  await save(`icon-${ICONS[n]}`, a - 1, top - 1, b - a + 3, bottom - top + 3, 3);
}

// 3. The lotus under "HER PODCAST SERIES".
const lotus = clusters(470, 512, 108, 124, 8)[0];
const [lt, lb] = rows(lotus[0], lotus[1], 106, 126);
await save('lotus', lotus[0] - 1, lt - 1, lotus[1] - lotus[0] + 3, lb - lt + 3, 3);
