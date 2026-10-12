// Web-sized crops of the team photoshoot (marketing/team originals → src/assets/web/team).
//   node scripts/team-photos.mjs
// Portraits, Melanie JC's hero and card crops, the group photo, and a round headshot per person.
import sharp from 'sharp';
const SRC = 'marketing/team/';
const OUT = 'src/assets/web/team/';
// Crop to an aspect ratio around a focal point (fractions of the image), then resize.
async function make(file, out, { ratio, fx, fy, width, zoom = 1, enlarge = false }) {
  const img = sharp(SRC + file); const m = await img.metadata();
  let w = m.width / zoom, h = w / ratio;
  if (h > m.height / zoom) { h = m.height / zoom; w = h * ratio; }
  w = Math.round(w); h = Math.round(h);
  const left = Math.min(Math.max(0, Math.round(fx * m.width - w / 2)), m.width - w);
  const top = Math.min(Math.max(0, Math.round(fy * m.height - h / 2)), m.height - h);
  const info = await img.extract({ left, top, width: w, height: h }).resize({ width, withoutEnlargement: !enlarge }).webp({ quality: 84 }).toFile(OUT + out);
  console.log(out.padEnd(26), `${m.width}x${m.height} -> crop ${w}x${h}@${left},${top} -> ${info.width}x${info.height} ${Math.round(info.size / 1024)} KB`);
}
// Melanie JC: the hero portrait, a square card crop, a wide crop, and a tight headshot.
await make('melanie-jc.jpg', 'melanie-portrait.webp', { ratio: 4 / 5, fx: 0.5, fy: 0.42, width: 1000 });
await make('melanie-jc.jpg', 'melanie-square.webp', { ratio: 1, fx: 0.53, fy: 0.3, width: 640, zoom: 1.35 });
await make('melanie-jc.jpg', 'melanie-wide.webp', { ratio: 3 / 2, fx: 0.5, fy: 0.32, width: 1200, zoom: 1.15 });
await make('melanie-jc.jpg', 'melanie-head.webp', { ratio: 1, fx: 0.535, fy: 0.275, width: 480, zoom: 2.6, enlarge: true });
// The team portraits (a = Alexia Thomas, b = Savannah Campbell, c = Shanay Prince, d = Yanni Bratcher; from the original
// file names alexa.jpg, savannah.png, shnay.png, yanni.jpg),
// and a headshot of each (just the head and shoulders).
await make('team-a.jpg', 'team-a.webp', { ratio: 4 / 5, fx: 0.52, fy: 0.45, width: 900 });
await make('team-b.png', 'team-b.webp', { ratio: 4 / 5, fx: 0.5, fy: 0.5, width: 900 });
await make('team-c.png', 'team-c.webp', { ratio: 4 / 5, fx: 0.45, fy: 0.5, width: 900 });
await make('team-d.jpg', 'team-d.webp', { ratio: 4 / 5, fx: 0.5, fy: 0.42, width: 900 });
await make('team-a.jpg', 'team-a-head.webp', { ratio: 1, fx: 0.5, fy: 0.31, width: 480, zoom: 2.15, enlarge: true });
await make('team-b.png', 'team-b-head.webp', { ratio: 1, fx: 0.47, fy: 0.43, width: 480, zoom: 2.4, enlarge: true });
await make('team-c.png', 'team-c-head.webp', { ratio: 1, fx: 0.355, fy: 0.3, width: 480, zoom: 2.3, enlarge: true });
await make('team-d.jpg', 'team-d-head.webp', { ratio: 1, fx: 0.47, fy: 0.155, width: 480, zoom: 2.9, enlarge: true });
// The group (the P31 team at an event): tall for the pop-up and arches, wide-ish for banners.
await make('team-group.webp', 'team-group.webp', { ratio: 4 / 5, fx: 0.5, fy: 0.58, width: 1000 });
await make('team-group.webp', 'team-group-wide.webp', { ratio: 16 / 10, fx: 0.5, fy: 0.5, width: 1400, zoom: 1.0 });
