// A PDF copy of a form submission, in the P31 look: a plum band with the mark, the form's title,
// when it was submitted and its reference, every answer, the signature when there is one, and
// page numbers. Built with pdf-lib (pure JavaScript, MIT) so it runs inside an Edge Function.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';

export type PdfSection = {
  heading?: string;
  rows?: [string, string | null | undefined][];
  bullets?: string[];
  paragraph?: string;
};
export type PdfSpec = {
  brand: 'market' | 'collective';
  title: string;
  submittedAt: string;          // ISO time
  reference: string;            // the row id
  intro?: string;
  sections: PdfSection[];
  signature?: string | null;    // a data:image/png;base64 URL
  signedName?: string | null;
  signedOn?: string | null;     // YYYY-MM-DD
};

const PLUM = rgb(0x3a / 255, 0x1c / 255, 0x36 / 255);
const GOLD = rgb(0xd9 / 255, 0xa9 / 255, 0x3a / 255);
const INK = rgb(0x2a / 255, 0x15 / 255, 0x26 / 255);
const MUTED = rgb(0x74 / 255, 0x65 / 255, 0x7a / 255);
const LINE = rgb(0xe3 / 255, 0xd0 / 255, 0xea / 255);
const BRAND = {
  market: { name: 'Proverbs 31 Marketplace', site: 'p31market.com · Where her gifts make room.', icon: 'https://www.p31market.com/icons/icon-192.png' },
  collective: { name: 'The Proverbs 31 Collective', site: 'thep31collective.org · The P31 Collective by NEBA', icon: 'https://www.thep31collective.org/c/icons/icon-192.png' },
};
const W = 612; const H = 792; const M = 48; // US Letter, margins

const iconCache = new Map<string, Uint8Array | null>();
async function icon(url: string) {
  if (iconCache.has(url)) return iconCache.get(url)!;
  try {
    const res = await fetch(url);
    const bytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    iconCache.set(url, bytes);
    return bytes;
  } catch { iconCache.set(url, null); return null; }
}

// The standard PDF fonts only know Western characters: anything else (emoji, some symbols) is
// swapped for a plain look-alike or dropped, so a submission can never break its own copy.
const SWAP: Record<string, string> = { '★': '*', '☆': '-', '✓': 'v', '→': '->', '·': '·', ' ': ' ' };
function safe(font: PDFFont, s: string, cache: Map<string, boolean>) {
  let out = '';
  for (const ch of String(s ?? '')) {
    if (ch === '\n') { out += ch; continue; }
    let ok = cache.get(ch);
    if (ok === undefined) { try { font.encodeText(ch); ok = true; } catch { ok = false; } cache.set(ch, ok); }
    out += ok ? ch : (SWAP[ch] ?? '');
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      // A single word wider than the line (a long link or email) is broken by characters.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) {
        let i = w.length; while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i -= 1;
        out.push(w.slice(0, i)); w = w.slice(i);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

const eastern = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });
const longDate = (d: string) => new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export async function formPdf(spec: PdfSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(spec.title); doc.setAuthor(BRAND[spec.brand].name); doc.setCreator('P31'); doc.setProducer('P31');
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const caches = new Map<PDFFont, Map<string, boolean>>([[serif, new Map()], [sans, new Map()], [bold, new Map()]]);
  const t = (f: PDFFont, s: string) => safe(f, s, caches.get(f)!);
  const brand = BRAND[spec.brand];
  const logoBytes = await icon(brand.icon);
  const logo = logoBytes ? await doc.embedPng(logoBytes).catch(() => null) : null;

  let page: PDFPage = doc.addPage([W, H]);
  let y = 0;
  const header = (first: boolean) => {
    page.drawRectangle({ x: 0, y: H - 78, width: W, height: 78, color: PLUM });
    page.drawRectangle({ x: 0, y: H - 80, width: W, height: 2, color: GOLD });
    if (logo) page.drawImage(logo, { x: M, y: H - 66, width: 54, height: 54 });
    const tx = logo ? M + 68 : M;
    page.drawText(t(serif, brand.name), { x: tx, y: H - 40, size: 18, font: serif, color: rgb(1, 1, 1) });
    page.drawText(t(bold, first ? 'SUBMITTED FORM' : 'SUBMITTED FORM (CONTINUED)'), { x: tx, y: H - 58, size: 8, font: bold, color: GOLD });
    y = H - 110;
  };
  const ensure = (need: number) => { if (y - need < 64) { page = doc.addPage([W, H]); header(false); } };
  const text = (f: PDFFont, s: string, size: number, color = INK, x = M, width = W - 2 * M, lead = 1.35) => {
    for (const ln of wrap(f, t(f, s), size, width)) { ensure(size * lead); page.drawText(ln, { x, y: y - size, size, font: f, color }); y -= size * lead; }
  };

  header(true);
  text(serif, spec.title, 22, PLUM);
  y -= 2;
  text(sans, `Submitted ${eastern(spec.submittedAt)} (Eastern) · Reference ${String(spec.reference).slice(0, 8).toUpperCase()}`, 9, MUTED);
  y -= 8;
  if (spec.intro) { text(sans, spec.intro, 10.5, INK); y -= 6; }

  for (const s of spec.sections) {
    if (s.heading) {
      ensure(30); y -= 8;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: LINE });
      y -= 6;
      text(bold, s.heading.toUpperCase(), 8.5, GOLD);
      y -= 2;
    }
    for (const [label, raw] of s.rows || []) {
      const value = raw == null || String(raw).trim() === '' ? '—' : String(raw);
      const lines = wrap(sans, t(sans, value), 10.5, W - 2 * M - 160);
      ensure(Math.max(14, lines.length * 14));
      const top = y;
      for (const [i, ln] of wrap(sans, t(sans, label), 9, 150).entries()) page.drawText(ln, { x: M, y: top - 10 - i * 12, size: 9, font: sans, color: MUTED });
      lines.forEach((ln, i) => page.drawText(ln, { x: M + 160, y: top - 10.5 - i * 14, size: 10.5, font: sans, color: INK }));
      y = top - Math.max(16, lines.length * 14 + 4);
    }
    for (const b of s.bullets || []) {
      const lines = wrap(sans, t(sans, b), 10, W - 2 * M - 16);
      ensure(lines.length * 13.5 + 2);
      page.drawCircle({ x: M + 4, y: y - 6.5, size: 1.6, color: PLUM });
      lines.forEach((ln, i) => page.drawText(ln, { x: M + 14, y: y - 10 - i * 13.5, size: 10, font: sans, color: INK }));
      y -= lines.length * 13.5 + 3;
    }
    if (s.paragraph) text(sans, s.paragraph, 10, INK);
  }

  if (spec.signature || spec.signedName) {
    ensure(120); y -= 12;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: LINE });
    y -= 6;
    text(bold, 'SIGNATURE', 8.5, GOLD);
    const m = String(spec.signature || '').match(/^data:image\/(png|jpe?g);base64,(.+)$/);
    if (m) {
      try {
        const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
        const img = m[1] === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const scale = Math.min(220 / img.width, 70 / img.height, 1);
        ensure(img.height * scale + 8);
        page.drawImage(img, { x: M, y: y - img.height * scale - 4, width: img.width * scale, height: img.height * scale });
        y -= img.height * scale + 10;
      } catch { /* an unreadable drawing: the typed name below still records the signature */ }
    }
    if (spec.signedName) text(sans, `Signed as ${spec.signedName}${spec.signedOn ? ` on ${longDate(spec.signedOn)}` : ''}`, 10, INK);
  }

  // Footer on every page.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.6, color: LINE });
    p.drawText(t(sans, brand.site), { x: M, y: 32, size: 8, font: sans, color: MUTED });
    const n = `Page ${i + 1} of ${pages.length}`;
    p.drawText(n, { x: W - M - sans.widthOfTextAtSize(n, 8), y: 32, size: 8, font: sans, color: MUTED });
  });
  return await doc.save();
}

/** Base64 for an email attachment. */
export function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
