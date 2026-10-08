// Caption engine for Clip Studio: clean word timing → non-overlapping caption
// pages → measured, wrapped layout → drawing (used by the renderer and the
// live preview, so what you see is what you export).

export const CAPTION_FONTS = [
  { id: 'Manrope', label: 'Manrope (clean sans)', css: 'Manrope' },
  { id: 'Noto Serif', label: 'Noto Serif (elegant)', css: '"Noto Serif"' },
];

export const HIGHLIGHTS = [
  ['color', 'Color the spoken word'],
  ['box', 'Box behind the spoken word'],
  ['underline', 'Underline the spoken word'],
  ['none', 'No highlight'],
];

export const ANIMATIONS = [
  ['pop', 'Pop in'],
  ['fade', 'Fade'],
  ['rise', 'Rise up'],
  ['words', 'Word by word'],
  ['none', 'None'],
];

export const BACKGROUNDS = [
  ['none', 'None'],
  ['dark', 'Dark box'],
  ['light', 'Light box'],
  ['plum', 'P31 plum box'],
];
const BG = { dark: 'rgba(0,0,0,0.72)', light: 'rgba(255,255,255,0.92)', plum: 'rgba(42,21,68,0.78)' };

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
    y: preset.y,                  // 0 top … 1 bottom (centre of the caption)
    words: preset.words,          // most words per caption
    lines: 2,                     // most lines per caption
    animation: 'pop',
    offset: 0,                    // seconds: shift every caption earlier (−) or later (+)
    minShow: 0.7,                 // seconds a caption stays up at least
  };
}

const MIN_WORD = 0.12;
const GAP_BREAK = 0.55; // a pause this long starts a new caption
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

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

/** Work out when each page shows: from its first word until the next page (held a little after speech, never overlapping). */
export function timePages(pages, settings) {
  const sorted = [...pages].sort((a, b) => a.start - b.start);
  return sorted.map((p, i) => {
    const next = sorted[i + 1];
    const showStart = Math.max(0, p.start - 0.04);
    const want = Math.max(p.end + 0.35, showStart + (settings?.minShow ?? 0.7));
    const showEnd = next ? Math.min(want, Math.max(next.start - 0.04, showStart + 0.2)) : want;
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

const fontCss = (s, size) => `${s.italic ? 'italic ' : ''}${s.weight} ${size}px ${CAPTION_FONTS.find((f) => f.id === s.font)?.css || 'Manrope'}`;

/** Make sure the caption font is loaded before anything is measured. */
export async function loadCaptionFont(s) {
  try { await document.fonts.load(fontCss(s, 48), 'Ag'); } catch { /* fall back quietly */ }
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

/** Lay a page out: wrap into ≤ settings.lines lines within 86% width, shrinking the font if needed. */
function layout(ctx, page, s, W, base) {
  let size = Math.round(base * s.size);
  const label = (t) => (s.upper ? t.toUpperCase() : t);
  for (let attempt = 0; attempt < 8; attempt++) {
    ctx.font = fontCss(s, size);
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
  return { size, space: ctx.measureText(' ').width * 1.05, lines: [page.words.map((w) => ({ ...w, label: label(w.text), w: ctx.measureText(label(w.text)).width }))] };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

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
  let alpha = 1;
  let lift = 0;
  let scale = 1;
  if (s.animation === 'pop') scale = 0.9 + 0.1 * clamp01(age / 0.12);
  if (s.animation === 'fade') alpha = clamp01(age / 0.18) * clamp01(outAge / 0.15);
  if (s.animation === 'rise') { alpha = clamp01(age / 0.2); lift = (1 - clamp01(age / 0.22)) * size * 0.5; }
  ctx.globalAlpha = alpha;
  const centerY = top + blockH / 2;
  ctx.translate(W / 2, centerY + lift);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -centerY);

  lines.forEach((line, li) => {
    const total = line.reduce((sum, w, k) => sum + w.w + (k ? space : 0), 0);
    let x = (W - total) / 2;
    const y = top + li * lh + lh / 2;
    if (s.background !== 'none') {
      ctx.fillStyle = BG[s.background] || BG.dark;
      ctx.beginPath();
      ctx.roundRect(x - size * 0.4, y - lh / 2, total + size * 0.8, lh, size * 0.3);
      ctx.fill();
    }
    for (const w of line) {
      const spoken = t >= w.start && t < w.end + 0.04;
      const said = t >= w.start;
      if (s.animation === 'words' && !said) { x += w.w + space; continue; }
      const pad = s.outline ? (size * s.outlineWidth) / 2 : 0;
      if (spoken && s.highlight === 'box') {
        ctx.fillStyle = s.activeBox;
        ctx.beginPath();
        ctx.roundRect(x - size * 0.12, y - lh / 2 + size * 0.1, w.w + size * 0.24, lh - size * 0.2, size * 0.18);
        ctx.fill();
      }
      if (s.outline) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * s.outlineWidth;
        ctx.strokeStyle = s.outlineColor;
        ctx.strokeText(w.label, x + pad, y);
      }
      ctx.fillStyle = spoken && s.highlight === 'color' ? s.active : s.color;
      ctx.fillText(w.label, x + pad, y);
      if (spoken && s.highlight === 'underline') {
        ctx.fillStyle = s.active;
        ctx.fillRect(x + pad, y + size * 0.52, w.w - pad * 2, Math.max(2, size * 0.07));
      }
      x += w.w + space;
    }
  });
  ctx.restore();
}
