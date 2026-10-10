// Caption engine for Clip Studio: clean word timing (snapped to the speech itself) →
// non-overlapping caption pages → measured, wrapped layout → drawing (used by the renderer
// and the live preview, so what you see is what you export).

// Fonts the captions can use. The first two are the site's own; the rest load from Google
// Fonts the first time a caption uses them (only inside the Studio, never on the public pages).
export const CAPTION_FONTS = [
  { id: 'Manrope', label: 'Manrope · clean', css: 'Manrope', weights: [400, 600, 800] },
  { id: 'Noto Serif', label: 'Noto Serif · elegant', css: '"Noto Serif"', weights: [400, 700], italic: true },
  { id: 'Bebas Neue', label: 'Bebas Neue · bold caps', css: '"Bebas Neue"', weights: [400], google: 'Bebas+Neue', caps: true },
  { id: 'Anton', label: 'Anton · impact', css: 'Anton', weights: [400], google: 'Anton' },
  { id: 'Montserrat', label: 'Montserrat · heavy', css: 'Montserrat', weights: [800, 900], google: 'Montserrat:wght@800;900' },
  { id: 'Poppins', label: 'Poppins · friendly', css: 'Poppins', weights: [700, 800], google: 'Poppins:wght@700;800' },
  { id: 'Oswald', label: 'Oswald · tall', css: 'Oswald', weights: [600], google: 'Oswald:wght@600' },
  { id: 'Playfair Display', label: 'Playfair · editorial', css: '"Playfair Display"', weights: [700], italic: true, google: 'Playfair+Display:ital,wght@0,700;1,700' },
  { id: 'Caveat', label: 'Caveat · handwritten', css: 'Caveat', weights: [700], google: 'Caveat:wght@700' },
  { id: 'Space Grotesk', label: 'Space Grotesk · modern', css: '"Space Grotesk"', weights: [700], google: 'Space+Grotesk:wght@700' },
];

export const HIGHLIGHTS = [
  ['color', 'Color the spoken word'],
  ['box', 'Box behind the spoken word'],
  ['underline', 'Underline the spoken word'],
  ['glow', 'Glow on the spoken word'],
  ['scale', 'Grow the spoken word'],
  ['none', 'No highlight'],
];

export const ANIMATIONS = [
  ['pop', 'Pop in'],
  ['fade', 'Fade'],
  ['rise', 'Rise up'],
  ['slide', 'Slide in'],
  ['words', 'Word by word'],
  ['bounce', 'Bounce each word'],
  ['typewriter', 'Typewriter'],
  ['karaoke', 'Karaoke sweep'],
  ['none', 'None'],
];

export const BACKGROUNDS = [
  ['none', 'None'],
  ['dark', 'Dark box'],
  ['light', 'Light box'],
  ['plum', 'P31 plum box'],
  ['gold', 'Gold box'],
  ['band', 'Full-width band'],
];
const BG = { dark: 'rgba(0,0,0,0.72)', light: 'rgba(255,255,255,0.92)', plum: 'rgba(42,21,68,0.78)', gold: 'rgba(242,206,77,0.95)', band: 'rgba(0,0,0,0.55)' };

export const FILLS = [['solid', 'Solid color'], ['gold', 'Gold shimmer'], ['plum', 'Plum gradient']];

/**
 * Ready-made text styles: pick one, then fine-tune anything. Each is a patch over the
 * current settings, so the position and timing you chose stay put.
 */
export const CAPTION_PRESETS = [
  { id: 'bold', name: 'Bold caps', note: 'The classic Reels look', patch: { font: 'Bebas Neue', weight: 400, italic: false, upper: true, size: 0.085, color: '#FFFFFF', active: '#F2CE4D', highlight: 'color', outline: true, outlineColor: '#000000', outlineWidth: 0.16, background: 'none', animation: 'pop', shadow: false, fill: 'solid', letterSpacing: 0.02, lines: 2 } },
  { id: 'karaoke', name: 'Karaoke', note: 'Color sweeps as each word is said', patch: { font: 'Montserrat', weight: 900, italic: false, upper: true, size: 0.07, color: '#FFFFFF', active: '#F2CE4D', highlight: 'none', outline: true, outlineColor: '#1d0f2e', outlineWidth: 0.14, background: 'none', animation: 'karaoke', shadow: true, fill: 'solid', letterSpacing: 0, lines: 2 } },
  { id: 'bounce', name: 'Bounce', note: 'Each word jumps as it lands', patch: { font: 'Poppins', weight: 800, italic: false, upper: false, size: 0.072, color: '#FFFFFF', active: '#17A673', highlight: 'color', outline: true, outlineColor: '#000000', outlineWidth: 0.14, background: 'none', animation: 'bounce', shadow: false, fill: 'solid', letterSpacing: 0, lines: 2 } },
  { id: 'boxed', name: 'Boxed', note: 'Dark box, spoken word in plum', patch: { font: 'Manrope', weight: 800, italic: false, upper: false, size: 0.06, color: '#FFFFFF', active: '#FFFFFF', activeBox: '#5E2A8C', highlight: 'box', outline: false, background: 'dark', animation: 'fade', shadow: false, fill: 'solid', letterSpacing: 0, lines: 2 } },
  { id: 'elegant', name: 'Elegant', note: 'Serif italic with a gold accent', patch: { font: 'Playfair Display', weight: 700, italic: true, upper: false, size: 0.058, color: '#FFF8E6', active: '#F2CE4D', highlight: 'color', outline: false, background: 'none', animation: 'rise', shadow: true, fill: 'solid', letterSpacing: 0, lines: 2 } },
  { id: 'gold', name: 'Gold shimmer', note: 'Gradient gold, P31 luxe', patch: { font: 'Noto Serif', weight: 700, italic: false, upper: false, size: 0.064, color: '#F2CE4D', active: '#FFFFFF', highlight: 'color', outline: false, background: 'plum', animation: 'pop', shadow: true, fill: 'gold', letterSpacing: 0.01, lines: 2 } },
  { id: 'typewriter', name: 'Typewriter', note: 'Letters arrive as they are spoken', patch: { font: 'Space Grotesk', weight: 700, italic: false, upper: false, size: 0.06, color: '#FFFFFF', active: '#F2CE4D', highlight: 'none', outline: false, background: 'band', animation: 'typewriter', shadow: false, fill: 'solid', letterSpacing: 0.03, lines: 2 } },
  { id: 'hand', name: 'Handwritten', note: 'Warm and personal', patch: { font: 'Caveat', weight: 700, italic: false, upper: false, size: 0.085, color: '#FFFFFF', active: '#F2CE4D', highlight: 'underline', outline: true, outlineColor: '#2a1544', outlineWidth: 0.12, background: 'none', animation: 'words', shadow: false, fill: 'solid', letterSpacing: 0, lines: 2 } },
  { id: 'minimal', name: 'Minimal', note: 'Small, quiet, lower case', patch: { font: 'Manrope', weight: 600, italic: false, upper: false, size: 0.046, color: '#FFFFFF', active: '#FFFFFF', highlight: 'none', outline: false, background: 'dark', animation: 'fade', shadow: false, fill: 'solid', letterSpacing: 0.04, lines: 1 } },
  { id: 'impact', name: 'Impact', note: 'Huge, tall, unmissable', patch: { font: 'Anton', weight: 400, italic: false, upper: true, size: 0.1, color: '#FFFFFF', active: '#F2CE4D', highlight: 'scale', outline: true, outlineColor: '#000000', outlineWidth: 0.1, background: 'none', animation: 'bounce', shadow: true, fill: 'solid', letterSpacing: 0.01, lines: 2 } },
];

/** Turn an edit style's caption preset into full, editable caption settings. */
export function captionSettings(preset) {
  const box = preset.box ? (preset.box.startsWith('rgba(255') ? 'light' : preset.box.startsWith('rgba(42') ? 'plum' : 'dark') : 'none';
  return {
    font: preset.font,
    weight: preset.weight,
    italic: !!preset.italic,
    size: preset.size,            // fraction of the short side
    upper: !!preset.upper,
    color: preset.color,
    active: preset.active,
    highlight: preset.activeBox ? 'box' : 'color',
    activeBox: preset.activeBox || '#5E2A8C',
    outline: !!preset.stroke,
    outlineColor: '#000000',
    outlineWidth: 0.14,           // fraction of the font size
    background: box,
    fill: 'solid',                // solid | gold | plum (text fill)
    shadow: false,                // soft drop shadow
    letterSpacing: 0,             // fraction of the font size
    y: preset.y,                  // 0 top … 1 bottom (centre of the caption)
    words: preset.words,          // most words per caption
    lines: 2,                     // most lines per caption
    animation: 'pop',
    offset: 0,                    // seconds: shift every caption earlier (−) or later (+)
    minShow: 0.7,                 // seconds a caption stays up at least
    hang: 0.3,                    // seconds a caption lingers after its last word
  };
}

const MIN_WORD = 0.12;
const GAP_BREAK = 0.55; // a pause this long starts a new caption
const FRAME = 0.02;     // 20 ms energy frames (matches analyze.js)
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * Snap word timing to the speech itself. Speech-to-text often ends a word where the
 * next one begins — pause included — so captions used to linger over silence. Using the
 * audio's own loudness: a word starts at the nearest onset of sound and ends when the
 * sound it sits in ends (or when the next word starts), never later.
 */
export function snapWordsToSpeech(words, pcm, rate = 16000) {
  if (!words?.length || !pcm || pcm.length < rate) return words;
  const n = Math.floor(FRAME * rate);
  const frames = Math.floor(pcm.length / n);
  const db = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * n; i < (f + 1) * n; i++) sum += pcm[i] * pcm[i];
    db[f] = 10 * Math.log10(sum / n + 1e-10);
  }
  const sorted = Float32Array.from(db).sort();
  const q = (p) => sorted[Math.min(frames - 1, Math.floor(p * frames))];
  const floor = q(0.1);
  const loud = q(0.9);
  if (loud - floor < 8) return words; // steady sound (music, hum): nothing to learn from it
  const threshold = Math.max(floor + (loud - floor) * 0.3, -55);
  const active = (f) => f >= 0 && f < frames && db[f] >= threshold;
  const fr = (t) => Math.round(t / FRAME);
  const out = words.map((w) => ({ ...w }));
  for (let i = 0; i < out.length; i++) {
    const w = out[i];
    const next = out[i + 1];
    // Start: the nearest moment sound begins within a quarter second, searching forward first.
    let s = fr(w.start);
    if (!active(s)) {
      let fwd = s;
      while (fwd < s + 15 && !active(fwd)) fwd++;
      if (active(fwd)) s = fwd;
      else {
        let back = s;
        while (back > s - 8 && !active(back)) back--;
        if (active(back)) s = back;
      }
    } else {
      let back = s;
      while (back > s - 6 && active(back - 1)) back--; // catch the onset a few frames earlier
      s = back;
    }
    const start = s * FRAME;
    // End: where this stretch of sound stops (plus a hair), capped by the next word's start.
    let e = s;
    const limit = next ? Math.max(s + 2, fr(next.start)) : fr(w.end) + 25;
    while (e < limit && active(e)) e++;
    let quiet = 0;
    while (e < limit && quiet < 4) { if (active(e)) { quiet = 0; } else quiet++; e++; } // ride over micro-gaps inside a word
    e -= quiet;
    const spoken = Math.max(MIN_WORD, Math.min(1.2, 0.07 * Math.max(2, w.text.replace(/[^\p{L}\p{N}]/gu, '').length) + 0.1));
    let end = Math.min(w.end > start ? w.end : start + spoken, e * FRAME + 0.06);
    if (next) end = Math.min(end, next.start);
    if (end < start + MIN_WORD) end = start + MIN_WORD;
    w.start = start;
    w.end = end;
  }
  return out;
}

/**
 * Clean raw speech-to-text words: sort, drop blanks and the duplicates that
 * appear where audio chunks overlap, and make every word's time its own —
 * no two words ever share the same moment.
 */
export function cleanWords(raw) {
  const words = raw
    .map((w) => ({ text: String(w.text || '').trim(), start: Number(w.start), end: Number(w.end) }))
    .filter((w) => w.text && Number.isFinite(w.start))
    .map((w) => ({ ...w, end: Number.isFinite(w.end) && w.end > w.start ? w.end : w.start + 0.3 }))
    .sort((a, b) => a.start - b.start);

  const out = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    // Same word again, overlapping in time: a chunk-boundary repeat.
    if (prev && norm(prev.text) === norm(w.text) && w.start < prev.end + 0.15) {
      prev.end = Math.max(prev.end, w.end);
      continue;
    }
    // Punctuation that came through as its own "word" joins the word before it.
    if (prev && /^[.,!?;:…'")\]]+$/.test(w.text)) { prev.text += w.text; prev.end = Math.max(prev.end, w.end); continue; }
    out.push({ ...w });
  }
  // No overlaps: each word ends where the next begins, at the latest.
  for (let i = 0; i < out.length; i++) {
    const w = out[i];
    const next = out[i + 1];
    if (next && next.start < w.start + MIN_WORD) next.start = w.start + MIN_WORD;
    if (next && w.end > next.start) w.end = next.start;
    if (w.end - w.start < MIN_WORD) w.end = w.start + MIN_WORD;
  }
  return out;
}

/**
 * Group clean words into caption pages. A page breaks at the word limit, at a
 * pause, after a sentence ends, or when it would be too long to read.
 * Each page gets a display window that never overlaps the next one.
 */
export function buildPages(words, settings) {
  const per = Math.max(1, settings.words);
  const maxChars = per * 9 + 6;
  const pages = [];
  let cur = [];
  const flush = () => { if (cur.length) pages.push(cur); cur = []; };
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0);
    if (cur.length >= per || (prev && w.start - prev.end > GAP_BREAK) || (prev && /[.!?]$/.test(prev.text)) || chars + w.text.length > maxChars) flush();
    cur.push(w);
  }
  flush();
  return timePages(pages.map((ws) => ({ words: ws, start: ws[0].start, end: ws[ws.length - 1].end })), settings);
}

/**
 * Work out when each page shows: a touch before its first word until shortly after its
 * last word (the "hang"), held up to the minimum show time, and never into the next page.
 * A long pause before the next page doesn't keep the old caption up: it clears.
 */
export function timePages(pages, settings) {
  const sorted = [...pages].sort((a, b) => a.start - b.start);
  const hang = settings?.hang ?? 0.3;
  const minShow = settings?.minShow ?? 0.7;
  return sorted.map((p, i) => {
    const next = sorted[i + 1];
    const showStart = Math.max(0, p.start - 0.04);
    const want = Math.max(p.end + hang, showStart + minShow);
    const showEnd = next ? Math.min(want, Math.max(next.start - 0.04, showStart + 0.2)) : Math.min(want, p.end + Math.max(hang, 0.5));
    return { ...p, showStart, showEnd };
  });
}

/** Re-time edited caption text. Same word count keeps each word's timing; otherwise time is shared by word length. */
export function retimePage(page, text) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  if (tokens.length === page.words.length) return { ...page, words: page.words.map((w, i) => ({ ...w, text: tokens[i] })) };
  const span = Math.max(0.2, page.end - page.start);
  const weights = tokens.map((t) => Math.max(2, t.replace(/[^\p{L}\p{N}]/gu, '').length));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = page.start;
  return {
    ...page,
    words: tokens.map((tok, i) => {
      const d = (span * weights[i]) / total;
      const w = { text: tok, start: t, end: t + d };
      t += d;
      return w;
    }),
  };
}

/** Move a whole page in time (keeps its words' rhythm). */
export function shiftPage(page, dStart, dEnd = dStart) {
  const start = Math.max(0, page.start + dStart);
  const end = Math.max(start + 0.2, page.end + dEnd);
  const k = (end - start) / Math.max(0.01, page.end - page.start);
  return { ...page, start, end, words: page.words.map((w) => ({ ...w, start: start + (w.start - page.start) * k, end: start + (w.end - page.start) * k })) };
}

export function splitPage(page) {
  if (page.words.length < 2) return [page];
  const mid = Math.ceil(page.words.length / 2);
  const a = page.words.slice(0, mid);
  const b = page.words.slice(mid);
  return [{ words: a, start: a[0].start, end: a[a.length - 1].end }, { words: b, start: b[0].start, end: b[b.length - 1].end }];
}

export function mergePages(a, b) {
  const words = [...a.words, ...b.words];
  return { words, start: words[0].start, end: words[words.length - 1].end };
}

const fontDef = (id) => CAPTION_FONTS.find((f) => f.id === id) || CAPTION_FONTS[0];
const fontCss = (s, size) => `${s.italic ? 'italic ' : ''}${s.weight} ${size}px ${fontDef(s.font).css}`;

// Google-hosted caption fonts: one stylesheet, added the first time any of them is used.
let extrasLoaded = false;
const ensureExtraFonts = () => {
  if (extrasLoaded || typeof document === 'undefined') return;
  extrasLoaded = true;
  const families = CAPTION_FONTS.filter((f) => f.google).map((f) => `family=${f.google}`).join('&');
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?${families}&display=swap` });
  document.head.appendChild(link);
};

/** Make sure the caption font is loaded before anything is measured. */
export async function loadCaptionFont(s) {
  if (fontDef(s.font).google) ensureExtraFonts();
  try {
    await document.fonts.load(fontCss(s, 48), 'Ag');
    // A freshly added stylesheet needs a moment: wait for the face to really land.
    if (!document.fonts.check(fontCss(s, 48))) await new Promise((r) => setTimeout(r, 400));
    await document.fonts.load(fontCss(s, 48), 'Ag');
  } catch { /* fall back quietly */ }
}

/** Find the page on screen at time T (binary search over the display windows). */
export function pageAt(pages, T) {
  let lo = 0;
  let hi = pages.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = pages[mid];
    if (T < p.showStart) hi = mid - 1;
    else if (T >= p.showEnd) lo = mid + 1;
    else return p;
  }
  return null;
}

const applySpacing = (ctx, s, size) => { try { ctx.letterSpacing = `${Math.round(size * (s.letterSpacing || 0))}px`; } catch { /* older browsers */ } };

/** Lay a page out: wrap into ≤ settings.lines lines within 86% width, shrinking the font if needed. */
function layout(ctx, page, s, W, base) {
  let size = Math.round(base * s.size);
  const label = (t) => (s.upper || fontDef(s.font).caps ? t.toUpperCase() : t);
  for (let attempt = 0; attempt < 8; attempt++) {
    ctx.font = fontCss(s, size);
    applySpacing(ctx, s, size);
    const space = ctx.measureText(' ').width * 1.05;
    const pad = s.outline ? size * s.outlineWidth : 0;
    const maxW = W * 0.86;
    const lines = [[]];
    let lineW = 0;
    let fits = true;
    for (const w of page.words) {
      const text = label(w.text);
      const width = ctx.measureText(text).width + pad;
      if (width > maxW) fits = false;
      if (lineW && lineW + space + width > maxW) { lines.push([]); lineW = 0; }
      lines[lines.length - 1].push({ ...w, label: text, w: width });
      lineW += (lineW ? space : 0) + width;
    }
    if (fits && lines.length <= s.lines) return { size, space, lines };
    size = Math.round(size * 0.88);
  }
  ctx.font = fontCss(s, size);
  applySpacing(ctx, s, size);
  return { size, space: ctx.measureText(' ').width * 1.05, lines: [page.words.map((w) => ({ ...w, label: label(w.text), w: ctx.measureText(label(w.text)).width }))] };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOutBack = (p) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

const textFill = (ctx, s, x, y, w, size, spoken) => {
  if (s.fill === 'gold') {
    const g = ctx.createLinearGradient(x, y - size * 0.5, x + w, y + size * 0.5);
    g.addColorStop(0, '#F7E3A1'); g.addColorStop(0.45, '#F2CE4D'); g.addColorStop(1, '#D9A93A');
    return g;
  }
  if (s.fill === 'plum') {
    const g = ctx.createLinearGradient(x, y - size * 0.5, x + w, y + size * 0.5);
    g.addColorStop(0, '#A855E8'); g.addColorStop(1, '#5E2A8C');
    return g;
  }
  return spoken && s.highlight === 'color' ? s.active : s.color;
};

/** Draw the caption that belongs at time T. */
export function drawCaption(ctx, pages, T, s, W, H) {
  if (!pages?.length) return;
  const t = T - (s.offset || 0);
  const page = pageAt(pages, t);
  if (!page) return;
  const base = Math.min(W, H);
  const { size, space, lines } = layout(ctx, page, s, W, base);
  const lh = size * 1.28;
  const blockH = lines.length * lh;
  const cy = H * s.y;
  const top = Math.min(H - blockH - base * 0.04, Math.max(base * 0.04, cy - blockH / 2));
  const age = t - page.showStart;
  const outAge = page.showEnd - t;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = fontCss(s, size);
  applySpacing(ctx, s, size);
  let alpha = 1;
  let lift = 0;
  let shift = 0;
  let scale = 1;
  if (s.animation === 'pop') scale = 0.9 + 0.1 * clamp01(age / 0.12);
  if (s.animation === 'fade') alpha = clamp01(age / 0.18) * clamp01(outAge / 0.15);
  if (s.animation === 'rise') { alpha = clamp01(age / 0.2); lift = (1 - clamp01(age / 0.22)) * size * 0.5; }
  if (s.animation === 'slide') { alpha = clamp01(age / 0.18); shift = -(1 - easeOutBack(clamp01(age / 0.3))) * W * 0.1; }
  ctx.globalAlpha = alpha;
  const centerY = top + blockH / 2;
  ctx.translate(W / 2 + shift, centerY + lift);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -centerY);

  if (s.background === 'band') {
    ctx.fillStyle = BG.band;
    ctx.fillRect(0, top - size * 0.45, W, blockH + size * 0.9);
  }

  lines.forEach((line, li) => {
    const total = line.reduce((sum, w, k) => sum + w.w + (k ? space : 0), 0);
    let x = (W - total) / 2;
    const y = top + li * lh + lh / 2;
    if (s.background !== 'none' && s.background !== 'band') {
      ctx.fillStyle = BG[s.background] || BG.dark;
      ctx.beginPath();
      ctx.roundRect(x - size * 0.4, y - lh / 2, total + size * 0.8, lh, size * 0.3);
      ctx.fill();
    }
    for (const w of line) {
      const spoken = t >= w.start && t < w.end + 0.04;
      const said = t >= w.start;
      const wordAge = t - w.start;
      if ((s.animation === 'words' || s.animation === 'bounce' || s.animation === 'typewriter') && !said) { x += w.w + space; continue; }
      const pad = s.outline ? (size * s.outlineWidth) / 2 : 0;
      ctx.save();
      // Per-word motion: bounce lands each word; "scale" grows the spoken one.
      let ws = 1;
      if (s.animation === 'bounce') ws = easeOutBack(clamp01(wordAge / 0.28)) * 0.3 + 0.7 + (spoken ? 0.06 : 0);
      if (spoken && s.highlight === 'scale') ws *= 1.14;
      if (ws !== 1) { ctx.translate(x + w.w / 2, y); ctx.scale(ws, ws); ctx.translate(-(x + w.w / 2), -y); }
      if (spoken && s.highlight === 'box') {
        ctx.fillStyle = s.activeBox;
        ctx.beginPath();
        ctx.roundRect(x - size * 0.12, y - lh / 2 + size * 0.1, w.w + size * 0.24, lh - size * 0.2, size * 0.18);
        ctx.fill();
      }
      let label = w.label;
      if (s.animation === 'typewriter') {
        const n = Math.ceil(label.length * clamp01(wordAge / Math.max(0.12, (w.end - w.start) * 0.8)));
        label = label.slice(0, n);
      }
      if (s.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.25; ctx.shadowOffsetY = size * 0.06; }
      if (spoken && s.highlight === 'glow') { ctx.shadowColor = s.active; ctx.shadowBlur = size * 0.7; ctx.shadowOffsetY = 0; }
      if (s.outline) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * s.outlineWidth;
        ctx.strokeStyle = s.outlineColor;
        ctx.strokeText(label, x + pad, y);
      }
      ctx.fillStyle = textFill(ctx, s, x + pad, y, w.w, size, spoken);
      ctx.fillText(label, x + pad, y);
      if (s.animation === 'karaoke' && said) {
        // The spoken color sweeps across the word with the voice; said words stay colored.
        const p = spoken ? clamp01(wordAge / Math.max(0.08, w.end - w.start)) : 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y - lh / 2, (w.w - pad * 2) * p + pad, lh);
        ctx.clip();
        ctx.shadowBlur = 0;
        ctx.fillStyle = s.active;
        ctx.fillText(label, x + pad, y);
        ctx.restore();
      }
      if (spoken && s.highlight === 'underline') {
        ctx.shadowBlur = 0;
        ctx.fillStyle = s.active;
        ctx.fillRect(x + pad, y + size * 0.52, w.w - pad * 2, Math.max(2, size * 0.07));
      }
      ctx.restore();
      x += w.w + space;
    }
  });
  ctx.restore();
}

/**
 * The Instagram safe zone for 9:16: the app draws its own UI over the bottom ~22% and the
 * right ~10%, so captions and hooks should stay clear. Drawn on previews only.
 */
export function drawSafeZone(ctx, W, H) {
  if (H / W < 1.5) return;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 80, 80, 0.16)';
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
  ctx.fillRect(W * 0.9, H * 0.3, W * 0.1, H * 0.48);
  ctx.fillRect(0, 0, W, H * 0.08);
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.7)';
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(1, H * 0.08, W - 2, H * 0.7);
  ctx.restore();
}

/**
 * The hook: big words for the first couple of seconds, when people decide to keep watching.
 * Drawn above the captions, inside the safe zone, with a quick pop and a soft dark backing.
 */
export const HOOK_SECONDS = 2.4;
export function drawHook(ctx, text, T, W, H) {
  if (!text || T < 0 || T > HOOK_SECONDS) return;
  const base = Math.min(W, H);
  const a = clamp01(T / 0.22) * clamp01((HOOK_SECONDS - T) / 0.3);
  const scale = 0.85 + 0.15 * easeOutBack(clamp01(T / 0.35));
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.55);
  let size = Math.round(base * 0.095);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = text.toUpperCase().split(/\s+/);
  const lines = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    ctx.font = `800 ${size}px Manrope`;
    lines.length = 0;
    let cur = '';
    for (const w of words) {
      const trial = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(trial).width > W * 0.82 && cur) { lines.push(cur); cur = w; } else cur = trial;
    }
    if (cur) lines.push(cur);
    if (lines.length <= 3 && lines.every((l) => ctx.measureText(l).width <= W * 0.82)) break;
    size = Math.round(size * 0.88);
  }
  const lh = size * 1.12;
  const y0 = H * 0.3 - ((lines.length - 1) * lh) / 2;
  ctx.translate(W / 2, H * 0.3);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H * 0.3);
  ctx.lineJoin = 'round';
  lines.forEach((l, i) => {
    const y = y0 + i * lh;
    ctx.lineWidth = size * 0.18;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(l, W / 2, y);
    ctx.fillStyle = i === lines.length - 1 && lines.length > 1 ? '#F2CE4D' : '#FFFFFF';
    ctx.fillText(l, W / 2, y);
  });
  ctx.restore();
}
