// Re-tunes every colour in the sites to the P31 brand palette (October 2026):
//   Thistle #E3D0EA (primary surfaces) · Dark Purple #3A1C36 (sub) · Amethyst #9B71B2 ·
//   Olive #6C6D11 and Gold #D9A93A / #F2CE4D (accents) · Cal Poly Green #374126 (deep accent)
// Old values map to the nearest brand value so tokens, hard-coded CSS, inline styles, the
// console themes, the Studio cards and the email templates all move together.
//   node scripts/palette.mjs          apply
//   node scripts/palette.mjs --dry    list what would change
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const HEX = {
  // deep backgrounds → the dark purple scale
  '12081d': '21101E', '140a22': '21101E', '150a24': '21101E', '120a1a': '21101E', '0d0616': '21101E', '160a24': '21101E', '170c27': '21101E', '0f0718': '21101E',
  '1d0f2e': '2D1529', '1e1031': '2D1529', '1c0f30': '2D1529', '1a0d2c': '2D1529', '1f1134': '2D1529', '1d0f33': '2D1529', '22123a': '2D1529', '241533': '2D1529',
  '2a1544': '3A1C36', '2a1240': '3A1C36', '26143c': '3A1C36', '23123b': '3A1C36', '29173f': '3A1C36', '2b1745': '3A1C36', '2b1646': '3A1C36',
  '351a5b': '4C2546', '33195a': '4C2546', '3a1a5c': '4C2546', '4a1f78': '4C2546', '3b1a5e': '4C2546', '3a2352': '4C2546',
  // the royal purple → dark purple (text, buttons) and the bright amethyst → brand amethyst
  '5e2a8c': '3A1C36', 'a855e8': '9B71B2', '8b3fd0': '9B71B2', '8a4fd0': '9B71B2', '6b2fa3': '6E4A82', '6a2fa0': '7E5A94',
  'd7b3f7': 'C9A8DA', 'dcbcff': 'C9A8DA', 'dcb7ff': 'C9A8DA', 'c4aaff': 'C9A8DA', 'b388ff': 'C9A8DA', 'd9ccff': 'E3D0EA',
  // light surfaces → thistle tints
  'fcfbfe': 'F8F3FA', 'fbf3ff': 'F8F3FA', 'f6f0fc': 'F3EAF6', 'f5f1fb': 'EFE4F3', 'f3ecfb': 'EFE4F3', 'f6f1fb': 'EFE4F3', 'f1ebfa': 'EADBF0',
  'eee6f8': 'E3D0EA', 'e9e0f6': 'E3D0EA', 'ecddfa': 'E3D0EA', 'eaddf7': 'E3D0EA',
  'e7dcf4': 'DCCBE3', 'cbb9e2': 'C3A9CE', 'cfc6da': 'C3A9CE',
  // ink
  '201431': '2A1526', '4a3b5c': '4E3A4B', '6e6580': '74657A', '8a7f96': '8C7E92',
  // greens → olive and Cal Poly green
  '1b6e44': '374126', '7e8c1e': '6C6D11', '123d28': '374126', '27341b': '374126', '0f3d28': '374126', '17603c': '374126',
  '146b4a': '4F6B2E', '0f7a54': '4F6B2E', '2e7d32': '4F6B2E', '2e9e63': '8A8B2A',
};
const RGBA = [
  [/rgba\(\s*168\s*,\s*85\s*,\s*232\s*,/g, 'rgba(155, 113, 178,'],
  [/rgba\(\s*94\s*,\s*42\s*,\s*140\s*,/g, 'rgba(58, 28, 54,'],
  [/rgba\(\s*120\s*,\s*60\s*,\s*170\s*,/g, 'rgba(155, 113, 178,'],
  [/rgba\(\s*150\s*,\s*70\s*,\s*210\s*,/g, 'rgba(155, 113, 178,'],
  [/rgba\(\s*196\s*,\s*170\s*,\s*255\s*,/g, 'rgba(201, 168, 218,'],
  [/rgba\(\s*181\s*,\s*124\s*,\s*255\s*,/g, 'rgba(155, 113, 178,'],
  [/rgba\(\s*29\s*,\s*15\s*,\s*46\s*,/g, 'rgba(42, 21, 38,'],
  [/rgba\(\s*32\s*,\s*20\s*,\s*49\s*,/g, 'rgba(42, 21, 38,'],
  [/rgba\(\s*42\s*,\s*21\s*,\s*68\s*,/g, 'rgba(58, 28, 54,'],
  [/rgba\(\s*20\s*,\s*10\s*,\s*34\s*,/g, 'rgba(33, 16, 30,'],
  [/rgba\(\s*21\s*,\s*10\s*,\s*36\s*,/g, 'rgba(33, 16, 30,'],
  [/rgba\(\s*18\s*,\s*8\s*,\s*29\s*,/g, 'rgba(33, 16, 30,'],
  [/rgba\(\s*58\s*,\s*26\s*,\s*92\s*,/g, 'rgba(76, 37, 70,'],
];

const dry = process.argv.includes('--dry');
const ROOT = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..');
const EXT = new Set(['.css', '.jsx', '.js', '.ts', '.html', '.webmanifest', '.mjs']);
const SKIP = /node_modules|[\\/]dist[\\/]|[\\/]assets[\\/]|demo-studio\.json|[\\/]marketing[\\/]social[\\/]/;
const files = [];
const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (SKIP.test(p)) continue; if (statSync(p).isDirectory()) walk(p); else if (EXT.has(extname(p)) && !/palette\.mjs$/.test(p)) files.push(p); } };
['src', 'supabase/functions', 'public', 'scripts'].forEach((d) => { try { walk(join(ROOT, d)); } catch { /* optional */ } });
['index.html', 'middleware.js'].forEach((f) => files.push(join(ROOT, f)));

let changed = 0; let total = 0;
for (const file of files) {
  let s; try { s = readFileSync(file, 'utf8'); } catch { continue; }
  let out = s.replace(/#([0-9a-fA-F]{6})\b/g, (m, hex) => { const to = HEX[hex.toLowerCase()]; if (!to) return m; total += 1; return `#${to}`; });
  for (const [re, to] of RGBA) out = out.replace(re, () => { total += 1; return to; });
  if (out !== s) { changed += 1; if (dry) console.log('would change', file.replace(ROOT, '')); else writeFileSync(file, out); }
}
console.log(`palette: ${total} colours in ${changed} files${dry ? ' (dry run)' : ''}`);
