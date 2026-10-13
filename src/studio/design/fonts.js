// The Design studio's typefaces, loaded on demand as FontFaces so the canvas can draw with
// them (and so the exported image matches the screen). Latin files only; all are open-source
// (SIL Open Font License) and served from this site, never a font CDN.
import spartan400 from '@fontsource/league-spartan/files/league-spartan-latin-400-normal.woff2?url';
import spartan700 from '@fontsource/league-spartan/files/league-spartan-latin-700-normal.woff2?url';
import spartan800 from '@fontsource/league-spartan/files/league-spartan-latin-800-normal.woff2?url';
import spartan900 from '@fontsource/league-spartan/files/league-spartan-latin-900-normal.woff2?url';
import yellowtail from '@fontsource/yellowtail/files/yellowtail-latin-400-normal.woff2?url';
import vibes from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url';
import playfair400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfair400i from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';
import playfair700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import playfair700i from '@fontsource/playfair-display/files/playfair-display-latin-700-italic.woff2?url';
import cormorant500 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2?url';
import cormorant500i from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2?url';
import cormorant700 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2?url';
import dmserif from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url';
import dmserifi from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-italic.woff2?url';
import bebas from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
import mont500 from '@fontsource/montserrat/files/montserrat-latin-500-normal.woff2?url';
import mont700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import mont800 from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff2?url';
import mont500i from '@fontsource/montserrat/files/montserrat-latin-500-italic.woff2?url';

// family → { label, kind, faces: [[url, weight, style]] }
export const FONTS = {
  'League Spartan': { label: 'League Spartan', kind: 'Bold sans', faces: [[spartan400, 400], [spartan700, 700], [spartan800, 800], [spartan900, 900]] },
  Montserrat: { label: 'Montserrat', kind: 'Clean sans', faces: [[mont500, 500], [mont700, 700], [mont800, 800], [mont500i, 500, 'italic']] },
  'Bebas Neue': { label: 'Bebas Neue', kind: 'Tall caps', faces: [[bebas, 400]] },
  'Playfair Display': { label: 'Playfair Display', kind: 'Elegant serif', faces: [[playfair400, 400], [playfair400i, 400, 'italic'], [playfair700, 700], [playfair700i, 700, 'italic']] },
  'Cormorant Garamond': { label: 'Cormorant', kind: 'Classic serif', faces: [[cormorant500, 500], [cormorant500i, 500, 'italic'], [cormorant700, 700]] },
  'DM Serif Display': { label: 'DM Serif', kind: 'Display serif', faces: [[dmserif, 400], [dmserifi, 400, 'italic']] },
  Yellowtail: { label: 'Yellowtail', kind: 'Script', faces: [[yellowtail, 400]] },
  'Great Vibes': { label: 'Great Vibes', kind: 'Signature', faces: [[vibes, 400]] },
  Manrope: { label: 'Manrope', kind: 'Site sans', faces: [['/fonts/Manrope-600.woff2', 600], ['/fonts/Manrope-800.woff2', 800]] },
  'Noto Serif': { label: 'Noto Serif', kind: 'Site serif', faces: [['/fonts/NotoSerif-400.woff2', 400], ['/fonts/NotoSerif-400-italic.woff2', 400, 'italic'], ['/fonts/NotoSerif-700.woff2', 700]] },
};
export const FONT_NAMES = Object.keys(FONTS);

/** The weights a family has (for the weight picker), and the nearest one to `w`. */
export const weightsOf = (family) => [...new Set((FONTS[family]?.faces || []).filter((f) => f[2] !== 'italic').map((f) => f[1]))];
export const nearestWeight = (family, w) => {
  const ws = weightsOf(family);
  return ws.length ? ws.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)) : w;
};
export const hasItalic = (family) => (FONTS[family]?.faces || []).some((f) => f[2] === 'italic');

const loaded = new Map();
/** Loads every face of the given families (all of them when omitted). Safe to call often. */
export function loadFonts(families = FONT_NAMES) {
  if (typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') return Promise.resolve();
  return Promise.all(families.filter((f) => FONTS[f]).flatMap((family) => FONTS[family].faces.map(([url, weight, style = 'normal']) => {
    const key = `${family}|${weight}|${style}`;
    if (!loaded.has(key)) {
      const face = new FontFace(family, `url(${url})`, { weight: String(weight), style });
      loaded.set(key, face.load().then((f) => { document.fonts.add(f); }).catch(() => { loaded.delete(key); }));
    }
    return loaded.get(key);
  })));
}

/** The families a design uses, so only those are fetched before drawing. */
export const familiesIn = (doc) => [...new Set((doc?.layers || []).filter((l) => l.type === 'text').map((l) => l.font))];
