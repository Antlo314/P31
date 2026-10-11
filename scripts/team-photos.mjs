// Web-sized crops of the team photoshoot (marketing/team originals → src/assets/web/team).
//   node scripts/team-photos.mjs
import sharp from 'sharp';
import { copyFileSync } from 'node:fs';
const SRC = 'C:/Users/aarons/AppData/Local/Temp/claude/C--Users-aarons--gemini-antigravity-scratch-P31/fe125f9b-b575-4a0a-a0c1-149d1a666678/images/';
const OUT = 'src/assets/web/team/';
// Crop to an aspect ratio around a focal point (fractions of the image), then resize.
async function make(file, out, { ratio, fx, fy, width, zoom = 1 }) {
  const img = sharp(SRC + file); const m = await img.metadata();
  let w = m.width / zoom, h = w / ratio;
  if (h > m.height / zoom) { h = m.height / zoom; w = h * ratio; }
  w = Math.round(w); h = Math.round(h);
  const left = Math.min(Math.max(0, Math.round(fx * m.width - w / 2)), m.width - w);
  const top = Math.min(Math.max(0, Math.round(fy * m.height - h / 2)), m.height - h);
  const info = await img.extract({ left, top, width: w, height: h }).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(OUT + out);
  console.log(out.padEnd(26), `${m.width}x${m.height} -> crop ${w}x${h}@${left},${top} -> ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
}
// Melanie JC (8.jpg): the hero portrait, a square headshot, and a wide crop for cards.
await make('8.jpg', 'melanie-portrait.webp', { ratio: 4 / 5, fx: 0.5, fy: 0.42, width: 1000 });
await make('8.jpg', 'melanie-square.webp', { ratio: 1, fx: 0.53, fy: 0.3, width: 640, zoom: 1.35 });
await make('8.jpg', 'melanie-wide.webp', { ratio: 3 / 2, fx: 0.5, fy: 0.32, width: 1200, zoom: 1.15 });
// The team portraits (names to be confirmed): a = locs & leopard, b = floral skirt on the sofa, c = vest & jeans, d = black corset on the stool.
await make('9.jpg', 'team-a.webp', { ratio: 4 / 5, fx: 0.52, fy: 0.45, width: 900 });
await make('10.png', 'team-b.webp', { ratio: 4 / 5, fx: 0.5, fy: 0.5, width: 900 });
await make('11.png', 'team-c.webp', { ratio: 4 / 5, fx: 0.45, fy: 0.5, width: 900 });
await make('12.jpg', 'team-d.webp', { ratio: 4 / 5, fx: 0.5, fy: 0.42, width: 900 });
// The group (the P31 team at an event): tall for the pop-up and arches, wide-ish for banners.
await make('13.webp', 'team-group.webp', { ratio: 4 / 5, fx: 0.5, fy: 0.58, width: 1000 });
await make('13.webp', 'team-group-wide.webp', { ratio: 16 / 10, fx: 0.5, fy: 0.5, width: 1400, zoom: 1.0 });
for (const [f, name] of [['8.jpg', 'melanie-jc.jpg'], ['9.jpg', 'team-a.jpg'], ['10.png', 'team-b.png'], ['11.png', 'team-c.png'], ['12.jpg', 'team-d.jpg'], ['13.webp', 'team-group.webp']]) copyFileSync(SRC + f, 'marketing/team/' + name);
console.log('originals kept in marketing/team');
