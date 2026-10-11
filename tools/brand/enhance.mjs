// Enhance the P31 hands mark: upscale cleanly, firm up soft edges, and write every variant.
import { createRequire } from 'node:module';
const sharp = createRequire('C:/Users/aarons/.gemini/antigravity/scratch/P31/package.json')('sharp');
import { mkdirSync } from 'node:fs';
// The untouched 381px art (from git, 2ae70f8), next to this script.
const SRC = decodeURIComponent(new URL('./original-mark.png', import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync('out', { recursive: true });
const PLUM = '#2a1544', NIGHT = '#1d0f2e', GOLD = '#D9A93A';

// Rim rebuild: the original art carries a beaded, lighter outline along every edge (it shows as
// white dots on dark backgrounds), and upscaling adds its own halo. Erode the solid shape by
// `rim` px, then grow the interior colours back out over the rim, so edge pixels wear the body
// colour. Alpha is kept as is.
const erodeM = (m, W, H) => { const o = new Uint8Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; o[i] = (m[i] && m[i - 1] && m[i + 1] && m[i - W] && m[i + W] && m[i - W - 1] && m[i - W + 1] && m[i + W - 1] && m[i + W + 1]) ? 1 : 0; } return o; };
const dilateM = (m, W, H) => { const o = new Uint8Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; o[i] = (m[i] || m[i - 1] || m[i + 1] || m[i - W] || m[i + W] || m[i - W - 1] || m[i - W + 1] || m[i + W - 1] || m[i + W + 1]) ? 1 : 0; } return o; };

async function rimRebuild(png, rim, fill = 0) {
  const { data: px, info: pi } = await sharp(png).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const W = pi.width, H = pi.height, N = W * H;
  let known = new Uint8Array(N);
  for (let i = 0; i < N; i++) known[i] = px[i * 4 + 3] >= 200 ? 1 : 0;
  for (let k = 0; k < rim; k++) known = erodeM(known, W, H);
  const col = Buffer.from(px);
  for (let pass = 0; pass < rim * 3 + 8 + fill; pass++) {
    const next = new Uint8Array(known);
    let grew = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (known[i] || (px[i * 4 + 3] === 0 && pass >= rim * 3 + 8 - 4 + 0 && !fill) || (px[i * 4 + 3] === 0 && !fill)) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) if (known[j]) { r += col[j * 4]; g += col[j * 4 + 1]; b += col[j * 4 + 2]; n++; }
      if (!n) continue;
      col[i * 4] = Math.round(r / n); col[i * 4 + 1] = Math.round(g / n); col[i * 4 + 2] = Math.round(b / n);
      next[i] = 1; grew++;
    }
    known = next;
    if (!grew) break;
  }
  return sharp(col, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}


// 1. Master at 2048. Colour and alpha are upscaled separately: colour with a soft kernel plus a
// median (the 381px art is dithered, and a sharp kernel turns that into ribs), alpha with
// lanczos, then tightened (soft halo → crisp edge) and rounded (no stair-steps).
const meta = await sharp(SRC).metadata();
const cleaned = await rimRebuild(await sharp(SRC).png().toBuffer(), 3);
const cleanSrc = await sharp(await sharp(cleaned).removeAlpha().blur(1.0).toBuffer())
  .joinChannel(await sharp(cleaned).extractChannel(3).toBuffer()).png().toBuffer();
const bigRgb = await sharp(cleanSrc).removeAlpha().resize(2048, 2048, { kernel: 'mitchell' }).median(5).blur(2.5).toBuffer();
// (a grey PNG comes back as 3 channels from raw() unless asked for b-w; read with the real stride)
const { data: aRaw, info } = await sharp(await sharp(cleanSrc).extractChannel(3).toBuffer()).resize(2048, 2048, { kernel: 'lanczos3' }).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
const stride = info.channels;
const alpha = Buffer.alloc(info.width * info.height);
for (let i = 0; i < alpha.length; i++) { const a = aRaw[i * stride]; alpha[i] = a < 40 ? 0 : a > 150 ? 255 : Math.round(((a - 40) / 110) * 255); }
let mask = new Uint8Array(alpha.length);
for (let i = 0; i < alpha.length; i++) mask[i] = alpha[i] > 128 ? 1 : 0;
// Smooth the outline: a wide Gaussian on the mask, re-thresholded, flattens the bead-sized
// waves. Narrow background channels (the gaps between fingers) are put back exactly as they
// were, so smoothing never welds fingers together.
const W2 = info.width, H2 = info.height;
const smOut = await sharp(Buffer.from(mask.map((v) => v * 255)), { raw: { width: W2, height: H2, channels: 1 } }).blur(9).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true });
const sm = smOut.data, smS = smOut.info.channels; // (grey raw may come back with 3 channels)
let closed = mask; for (let k = 0; k < 9; k++) closed = dilateM(closed, W2, H2); for (let k = 0; k < 9; k++) closed = erodeM(closed, W2, H2);
const alphaClean = Buffer.alloc(alpha.length);
for (let i = 0; i < alpha.length; i++) {
  const gap = closed[i] && !mask[i]; // background inside a channel narrower than 18px
  alphaClean[i] = sm[i * smS] > 127 && !gap ? 255 : 0;
}
const alphaImg = await sharp(alphaClean, { raw: { width: W2, height: H2, channels: 1 } }).blur(1.0).png().toBuffer();
await sharp(alphaImg).toFile('out/dbg-alpha.png');
const rgb = bigRgb;
const master0 = await sharp(rgb).joinChannel(alphaImg).png().toBuffer();

// Colour: rebuild the rim, extend colour 18px past the edge (so blurring never pulls in black),
// then smooth hard, keeping only the dark finger lines from the lightly smoothed copy. The art
// is flat colour and broad gradients; the ribbed texture in the original is not worth keeping.
const master1 = await rimRebuild(master0, 10, 18);
const rgbOnly = await sharp(master1).removeAlpha().png().toBuffer();
const heavy = await sharp(rgbOnly).blur(11).raw().toBuffer();
const light = await sharp(rgbOnly).blur(1.5).raw().toBuffer();
const outRgb = Buffer.from(heavy);
for (let i = 0; i < heavy.length; i += 3) {
  const lh = 0.299 * heavy[i] + 0.587 * heavy[i + 1] + 0.114 * heavy[i + 2];
  const ll = 0.299 * light[i] + 0.587 * light[i + 1] + 0.114 * light[i + 2];
  if (ll < lh - 26) { outRgb[i] = light[i]; outRgb[i + 1] = light[i + 1]; outRgb[i + 2] = light[i + 2]; }
}
const master = await sharp(outRgb, { raw: { width: 2048, height: 2048, channels: 3 } }).joinChannel(await sharp(master1).extractChannel(3).toBuffer()).png().toBuffer();
await sharp(master).toFile('out/mark-2048.png');

// Trim to content + 6% padding so every size centres the same way.
const trimmed = await sharp(master).trim({ threshold: 10 }).toBuffer();
const tm = await sharp(trimmed).metadata();
const side = Math.round(Math.max(tm.width, tm.height) * 1.08);
const square = await sharp(trimmed).extend({ top: Math.round((side - tm.height) / 2), bottom: Math.round((side - tm.height) / 2), left: Math.round((side - tm.width) / 2), right: Math.round((side - tm.width) / 2), background: { r: 0, g: 0, b: 0, alpha: 0 } }).resize(2048, 2048).png().toBuffer();
await sharp(square).toFile('out/mark.png');

// 2. Mono versions (silhouette from alpha): white, plum, gold.
const tint = async (hex, name) => {
  const { data: px, info: inf } = await sharp(square).raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < px.length; i += 4) { px[i] = r; px[i + 1] = g; px[i + 2] = b; }
  await sharp(px, { raw: { width: inf.width, height: inf.height, channels: 4 } }).png().toFile(`out/${name}`);
};
await tint('#ffffff', 'mark-white.png'); await tint('#5E2A8C', 'mark-plum.png'); await tint(GOLD, 'mark-gold.png');

// 3. App icon: mark on a plum→night gradient tile, 16% padding (reads at 16px and on home screens).
const grad = Buffer.from(`<svg width="1024" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1a5e"/><stop offset="1" stop-color="${NIGHT}"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/></svg>`);
const markOnTile = async (pad, size, name, round = 0) => {
  const inner = Math.round(size * (1 - pad * 2));
  const m = await sharp(square).resize(inner, inner).toBuffer();
  let img = sharp(grad).resize(size, size).composite([{ input: m, gravity: 'centre' }]);
  if (round) {
    const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${round}" fill="#fff"/></svg>`);
    img = sharp(await img.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
  }
  await img.png().toFile(`out/${name}`);
};
await markOnTile(0.14, 1024, 'icon-1024.png');
await markOnTile(0.22, 1024, 'maskable-1024.png');
for (const s of [512, 192, 180, 96, 48, 32, 16]) await sharp('out/icon-1024.png').resize(s, s, { kernel: 'lanczos3' }).png().toFile(`out/icon-${s}.png`);
await sharp('out/maskable-1024.png').resize(512, 512).png().toFile('out/maskable-512.png');
// Round tile (circle) for places that want a round avatar.
await markOnTile(0.14, 1024, 'avatar-1024.png', 512);
// Profile picture for Instagram / Facebook: square tile, roomier padding so the circle crop keeps the whole mark.
await markOnTile(0.2, 1024, 'profile-1024.png');
// Header marks (transparent) in webp.
for (const s of [512, 192, 96]) await sharp(square).resize(s, s).webp({ quality: 92, alphaQuality: 95 }).toFile(`out/mark-${s}.webp`);
console.log('source', meta.width, '→ master 2048; written', 'out/*');
