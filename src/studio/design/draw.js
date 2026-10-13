// Draws a Design studio document onto a canvas: the page colour, an optional photo, the
// pattern, then every layer (text, shapes, images, the P31 mark). The same function draws the
// editor preview, the exported image and every frame of a video (pass the time `t`).
import { SIZES } from './brand';
import { drawPattern } from './patterns';

export const sizeOf = (doc) => SIZES[doc?.size] || SIZES.post;

// ── Images (photos, uploads, the mark) ──────────────────────────────────────
const images = new Map();
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!images.has(src)) {
    images.set(src, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { images.set(src, img); resolve(img); };
      img.onerror = () => { images.delete(src); resolve(null); };
      img.src = src;
    }));
  }
  const v = images.get(src);
  return v instanceof Promise ? v : Promise.resolve(v);
}
const ready = (src) => { const v = images.get(src); return v && !(v instanceof Promise) ? v : null; };
export const preloadImages = (doc) => Promise.all([doc?.photo?.src, ...(doc?.layers || []).filter((l) => l.type === 'image').map((l) => l.src)].filter(Boolean).map(loadImage));

// ── Text layout ─────────────────────────────────────────────────────────────
// Words wrapped in *asterisks* are emphasised (accent colour, a marker or an underline).
const fontOf = (l, size = l.size) => `${l.italic ? 'italic ' : ''}${l.weight || 400} ${size}px "${l.font}"`;
const setSpacing = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };
const textOf = (l) => { const t = String(l.text || '').replace(/\*/g, ''); return l.upper ? t.toUpperCase() : t; };

/** Paragraphs of words, each word knowing whether it sits inside *emphasis*. */
function wordsOf(l) {
  const src = l.upper ? String(l.text || '').toUpperCase() : String(l.text || '');
  let em = false;
  return src.split('\n').map((para) => para.split(/ +/).filter((w, i, arr) => w || arr.length === 1).map((raw) => {
    let w = raw; let on = em;
    if (w.startsWith('*')) { on = true; w = w.slice(1); em = true; }
    if (w.endsWith('*')) { w = w.slice(0, -1); em = false; }
    if (w.includes('*')) w = w.replace(/\*/g, '');
    return { w, em: on };
  }));
}

function wrapLines(ctx, paras, width) {
  const out = [];
  const str = (ws) => ws.map((x) => x.w).join(' ');
  for (const words of paras) {
    let line = [];
    for (const word of words) {
      const next = [...line, word];
      if (ctx.measureText(str(next)).width <= width || !line.length) {
        if (!line.length && ctx.measureText(word.w).width > width) {
          // A single word wider than the box is broken across lines.
          let w = word.w;
          while (w && ctx.measureText(w).width > width) {
            let i = w.length - 1;
            while (i > 1 && ctx.measureText(w.slice(0, i)).width > width) i -= 1;
            out.push([{ w: w.slice(0, i), em: word.em }]); w = w.slice(i);
          }
          line = [{ w, em: word.em }];
        } else line = next;
      } else { out.push(line); line = [word]; }
    }
    out.push(line);
  }
  return out.map((ws) => ({ words: ws, str: str(ws) }));
}

/** Lines, size and box of a text layer (before pins and animation). */
function measureText(ctx, l) {
  const paras = wordsOf(l);
  const lh = l.lh || 1.15;
  let size = l.size || 60;
  const min = Math.min(size, 14);
  let lines; let lineH;
  for (;;) {
    ctx.font = fontOf(l, size);
    setSpacing(ctx, (l.spacing || 0) * size / 100);
    lines = wrapLines(ctx, paras, l.w);
    lineH = size * lh;
    const tooTall = l.fit && l.h && lines.length * lineH > l.h;
    const tooWide = l.fit && lines.some((s) => ctx.measureText(s.str).width > l.w + 1);
    if ((!tooTall && !tooWide) || size <= min) break;
    size = Math.max(min, size - Math.max(1, Math.round(size * 0.04)));
  }
  const cap = ctx.measureText('H');
  const capH = cap.actualBoundingBoxAscent || size * 0.7;
  return { lines, size, lineH, capH, h: Math.max(lineH, lines.length * lineH), emph: lines.some((ln) => ln.words.some((x) => x.em)) };
}

/** Every layer's box ({x, y, w, h}), with text measured and pins resolved. */
export function layout(ctx, doc) {
  const out = {};
  const byId = Object.fromEntries((doc.layers || []).map((l) => [l.id, l]));
  const resolve = (l, depth = 0) => {
    if (out[l.id]) return out[l.id];
    let box;
    if (l.type === 'text') {
      const m = measureText(ctx, l);
      let y = l.y;
      if (l.anchor === 'middle') y = l.y - m.h / 2;
      else if (l.anchor === 'bottom') y = l.y - m.h;
      box = { x: l.x, y, w: l.w, h: m.h, text: m };
    } else box = { x: l.x, y: l.y, w: l.w, h: l.h ?? l.w };
    // A pinned layer keeps its gap to another (the handle stays just above the quote).
    const target = l.pin && byId[l.pin.to];
    if (target && depth < 4) {
      const tb = resolve(target, depth + 1);
      box.y = l.pin.side === 'below' ? tb.y + tb.h + (l.pin.gap || 0) : tb.y - (l.pin.gap || 0) - box.h;
    }
    out[l.id] = box;
    return box;
  };
  (doc.layers || []).forEach((l) => resolve(l));
  return out;
}

// ── Motion ──────────────────────────────────────────────────────────────────
// Entrances are deliberately soft: short travel (a fraction of the type size), long ease-outs
// and gentle staggers. Times are in seconds; p runs 0 → 1 across a layer's entrance.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeQuint = (p) => 1 - (1 - p) ** 5;
const easeExpo = (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
export const easeInOut = (p) => -(Math.cos(Math.PI * clamp01(p)) - 1) / 2;
const easeBack = (p) => { const c = 1.45; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
export const ANIMS = [
  ['blur', 'Soft focus'], ['reveal', 'Reveal, line by line'], ['rise', 'Rise'], ['words', 'Word by word'], ['letters', 'Letter cascade'],
  ['type', 'Typewriter'], ['fade', 'Fade'], ['pop', 'Pop'], ['slide', 'Slide in'], ['none', 'None'],
];
const canFilter = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
/** When each layer starts moving: its own delay, or one after another in layer order. */
const startOf = (doc, l, i) => (l.delay ?? (0.35 + i * 0.35));
/** How long a layer's entrance lasts, in seconds. */
export function animLength(l) {
  if (l.type !== 'text') return 0.9;
  const text = textOf(l);
  const anim = l.anim || 'rise';
  const words = text.split(/\s+/).filter(Boolean).length;
  if (anim === 'type') return Math.max(0.8, text.length * 0.045);
  if (anim === 'words') return Math.max(0.9, Math.min(3.2, words * 0.13 + 0.5));
  if (anim === 'letters') return Math.max(0.9, Math.min(3.6, text.length * 0.026 + 0.6));
  if (anim === 'fade') return 1.0;
  if (anim === 'reveal') return 1.2 + Math.min(1.2, words * 0.04);
  return 1.3;
}

// ── Shapes ──────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function drawShape(ctx, l, b) {
  ctx.beginPath();
  if (l.shape === 'circle') ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
  else if (l.shape === 'line') { ctx.moveTo(b.x, b.y + b.h / 2); ctx.lineTo(b.x + b.w, b.y + b.h / 2); }
  else if (l.shape === 'arch') { const r = b.w / 2; ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x, b.y + r); ctx.arc(b.x + r, b.y + r, r, Math.PI, 0); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.closePath(); }
  else roundRect(ctx, b.x, b.y, b.w, b.h, l.shape === 'pill' ? b.h / 2 : l.radius || 0);
  if (l.fill && l.shape !== 'line') { ctx.fillStyle = l.fill; ctx.fill(); }
  if (l.stroke || l.shape === 'line') { ctx.strokeStyle = l.stroke || l.fill || '#000'; ctx.lineWidth = l.strokeW || 3; ctx.lineCap = 'round'; ctx.stroke(); }
}

function drawImageFit(ctx, img, x, y, w, h, radius = 0) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s; const ih = img.height * s;
  ctx.save();
  if (radius) { roundRect(ctx, x, y, w, h, radius); ctx.clip(); } else { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

// ── Text drawing (with its entrance) ─────────────────────────────────────────
/** Where each word of a line starts, honouring the alignment. */
function wordXs(ctx, line, ax, align) {
  const lineW = ctx.measureText(line.str).width;
  const x0 = align === 'center' ? ax - lineW / 2 : align === 'right' ? ax - lineW : ax;
  const xs = []; let acc = '';
  line.words.forEach((wd, k) => { xs.push(x0 + (k ? ctx.measureText(`${acc} `).width : 0)); acc = k ? `${acc} ${wd.w}` : wd.w; });
  return xs;
}
const inkOf = (l, wd) => (wd.em && l.emph !== 'marker' && l.emph !== 'underline' ? l.emColor || l.color : l.color) || '#000';

/** One line, word by word (for emphasis and the word entrance); wordQ(k) says how far word k has arrived. */
function drawWords(ctx, l, m, line, ax, by, wordQ, markP) {
  const xs = wordXs(ctx, line, ax, l.align);
  const em = l.emColor || l.color;
  ctx.save();
  ctx.textAlign = 'left';
  line.words.forEach((wd, k) => {
    const q = wordQ ? wordQ(k) : 1;
    if (q <= 0) return;
    const ww = ctx.measureText(wd.w).width;
    ctx.save();
    if (q < 1) {
      const e = easeQuint(q);
      ctx.globalAlpha *= e;
      ctx.translate(0, (1 - e) * m.size * 0.16);
      if (canFilter) ctx.filter = `blur(${((1 - e) * m.size * 0.05).toFixed(2)}px)`;
    }
    const sweep = easeQuint(clamp01(markP ?? 1));
    if (wd.em && l.emph === 'marker' && sweep > 0) {
      const padX = m.size * 0.08;
      ctx.save(); ctx.globalAlpha *= 0.72; ctx.fillStyle = l.markColor || em;
      roundRect(ctx, xs[k] - padX, by - m.capH * 0.52, (ww + padX * 2) * sweep, m.capH * 0.7, m.size * 0.06);
      ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = inkOf(l, wd);
    ctx.fillText(wd.w, xs[k], by);
    if (wd.em && l.emph === 'underline' && sweep > 0) {
      ctx.fillStyle = em;
      ctx.fillRect(xs[k], by + m.size * 0.12, ww * sweep, Math.max(3, m.size * 0.06));
    }
    ctx.restore();
  });
  ctx.restore();
}

function drawText(ctx, l, b, p, anim, t) {
  const m = b.text;
  ctx.font = fontOf(l, m.size);
  setSpacing(ctx, (l.spacing || 0) * m.size / 100);
  ctx.textBaseline = 'alphabetic';
  const ax = l.align === 'center' ? b.x + b.w / 2 : l.align === 'right' ? b.x + b.w : b.x;
  ctx.textAlign = l.align || 'left';
  const live = p != null && anim !== 'none';
  if (l.bg) {
    const pad = (l.bgPad ?? 0.35) * m.size;
    const widest = Math.max(...m.lines.map((s) => ctx.measureText(s.str).width));
    const bx = l.align === 'center' ? ax - widest / 2 : l.align === 'right' ? ax - widest : ax;
    const k = live ? easeQuint(clamp01(p * 2.2)) : 1;
    const bw = widest + pad * 2; const bh = b.h + pad * 1.4; const cx = bx - pad + bw / 2; const cy = b.y - pad * 0.7 + bh / 2;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(cx, cy); ctx.scale(0.94 + 0.06 * k, 0.94 + 0.06 * k); ctx.translate(-cx, -cy);
    ctx.fillStyle = l.bg;
    roundRect(ctx, bx - pad, b.y - pad * 0.7, bw, bh, l.bgRadius ?? pad * 1.4);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = l.color || '#000';
  const base = (i) => b.y + i * m.lineH + (m.lineH + m.capH) / 2;
  const n = m.lines.length;
  // The marker or underline sweeps in just after the words land.
  const markP = live ? (p - 0.8) / 0.45 : 1;
  const plain = (s, i) => (m.emph ? drawWords(ctx, l, m, s, ax, base(i), null, markP) : ctx.fillText(s.str, ax, base(i)));

  if (!live || (p >= 1 && markP >= 1 && anim !== 'type')) { m.lines.forEach(plain); return; }

  if (anim === 'type') {
    const total = m.lines.reduce((a, s) => a + s.str.length, 0);
    let left = Math.floor(total * clamp01(p));
    let caret = null;
    m.lines.forEach((s, i) => {
      if (left <= 0) return;
      const part = s.str.slice(0, left);
      const lineW = ctx.measureText(s.str).width;
      const x0 = l.align === 'center' ? ax - lineW / 2 : l.align === 'right' ? ax - lineW : ax;
      if (m.emph && part.length === s.str.length) drawWords(ctx, l, m, s, ax, base(i), null, 1);
      else { ctx.save(); ctx.textAlign = 'left'; ctx.fillText(part, x0, base(i)); ctx.restore(); }
      caret = { x: x0 + ctx.measureText(part).width + m.size * 0.06, y: base(i) };
      left -= s.str.length;
    });
    // A thin caret that blinks while typing and for a moment after.
    if (caret && p < 1.6 && Math.floor((t || 0) * 2.4) % 2 === 0) ctx.fillRect(caret.x, caret.y - m.capH, Math.max(2, m.size * 0.05), m.capH * 1.12);
    return;
  }

  if (anim === 'words' || anim === 'letters') {
    const flat = m.lines.flatMap((s) => s.words);
    const units = anim === 'letters' ? flat.reduce((a, w) => a + w.w.length, 0) : flat.length;
    const st = Math.min(anim === 'letters' ? 0.05 : 0.11, 0.62 / Math.max(1, units)); const d = 1 - (units - 1) * st;
    let u = 0;
    m.lines.forEach((s, i) => {
      if (anim === 'words') {
        const first = u;
        drawWords(ctx, l, m, s, ax, base(i), (k) => clamp01((p - (first + k) * st) / d), markP);
        u += s.words.length;
        return;
      }
      // Letters: each character drifts up and in, one after another.
      const xs = wordXs(ctx, s, ax, l.align);
      ctx.save(); ctx.textAlign = 'left';
      s.words.forEach((wd, k) => {
        let x = xs[k];
        ctx.fillStyle = inkOf(l, wd);
        [...wd.w].forEach((ch, ci) => {
          const q = clamp01((p - u * st) / d);
          const cw = ctx.measureText(wd.w.slice(0, ci + 1)).width - ctx.measureText(wd.w.slice(0, ci)).width;
          if (q > 0) {
            ctx.save();
            ctx.globalAlpha *= easeQuint(q);
            ctx.translate(0, (1 - easeQuint(q)) * m.size * 0.22);
            ctx.fillText(ch, x, base(i));
            ctx.restore();
          }
          x += cw; u += 1;
        });
      });
      ctx.restore();
    });
    return;
  }

  // Line by line: soft focus, reveal, rise, fade, pop, slide.
  const st = Math.min(0.16, 0.5 / n); const d = 1 - (n - 1) * st;
  m.lines.forEach((s, i) => {
    const q = clamp01((p - i * st) / d);
    if (q <= 0) return;
    const by = base(i);
    ctx.save();
    if (anim === 'reveal') {
      // The line rises out of an invisible slot, like the type on a title card.
      const e = easeExpo(q);
      const top = by - m.capH - m.size * 0.3; const hgt = m.lineH + m.size * 0.12;
      ctx.beginPath(); ctx.rect(b.x - m.size, top, b.w + m.size * 2, hgt); ctx.clip();
      ctx.translate(0, (1 - e) * hgt);
    } else {
      const e = easeQuint(q);
      ctx.globalAlpha *= anim === 'pop' ? easeOut(clamp01(q * 1.6)) : e;
      const cy = by - m.capH / 2;
      if (anim === 'rise') ctx.translate(0, (1 - e) * m.size * 0.3);
      else if (anim === 'slide') ctx.translate((1 - e) * -m.size * 0.45, 0);
      else if (anim === 'blur') {
        const k = 1.035 - 0.035 * e;
        ctx.translate(ax, cy); ctx.scale(k, k); ctx.translate(-ax, -cy);
        if (canFilter) ctx.filter = `blur(${((1 - e) * m.size * 0.14).toFixed(2)}px)`;
      } else if (anim === 'pop') { const k = 0.82 + 0.18 * easeBack(q); ctx.translate(ax, cy); ctx.scale(k, k); ctx.translate(-ax, -cy); }
    }
    plain(s, i);
    ctx.restore();
  });
}

export const CAMERAS = [['push', 'Slow push in'], ['drift', 'Gentle drift'], ['still', 'Still']];
export const INTROS = [['draw', 'Lines draw in'], ['fade', 'Pattern fades in'], ['none', 'Already there']];

/**
 * Draw `doc` on `ctx` (a canvas exactly the page size). `t` is the time in seconds for video
 * frames; leave it null for the finished still. `length` (the video's seconds) paces the camera.
 * Returns the layer boxes (for the editor).
 */
export function drawDesign(ctx, doc, t = null, { length = 10 } = {}) {
  const { w, h } = sizeOf(doc);
  const motion = doc.motion || {};
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  // The camera: a slow push in, or a gentle drift, over the whole video (never on a still).
  if (t != null) {
    const k = easeInOut(t / Math.max(1, length));
    const cam = motion.camera || 'push';
    if (cam === 'push') { const z = 1 + 0.035 * k; ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2); }
    else if (cam === 'drift') { const z = 1.03; ctx.translate(w / 2 + (k - 0.5) * w * 0.022, h / 2 - (k - 0.5) * h * 0.012); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2); }
  }
  // Page
  const bg = doc.bg || {};
  if (bg.color2) {
    const a = ((bg.angle ?? 160) * Math.PI) / 180;
    const dx = Math.sin(a) * h / 2; const dy = -Math.cos(a) * h / 2;
    const g = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy);
    g.addColorStop(0, bg.color || '#fff'); g.addColorStop(1, bg.color2);
    ctx.fillStyle = g;
  } else ctx.fillStyle = bg.color || '#fff';
  ctx.fillRect(0, 0, w, h);
  // Photo (slow push-in on video)
  const ph = doc.photo?.src && ready(doc.photo.src);
  if (ph) {
    const z = t == null ? 1 : 1 + Math.min(t, 30) * 0.006;
    ctx.save();
    ctx.translate(w / 2, h / 2); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2);
    drawImageFit(ctx, ph, 0, 0, w, h);
    ctx.restore();
    if (doc.photo.dim) { ctx.fillStyle = doc.photo.tint || '#1E0F1C'; ctx.globalAlpha = doc.photo.dim; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
  }
  // The pattern draws itself in (or fades in) during the first two seconds of a video.
  const intro = motion.intro || 'draw';
  const reveal = t == null || intro === 'none' ? 1 : clamp01(t / 2.2);
  drawPattern(ctx, w, h, doc.pattern, t ?? 0, intro === 'fade' ? Math.min(1, reveal * 1.4) : reveal, intro === 'draw');
  // Layers
  const boxes = layout(ctx, doc);
  (doc.layers || []).forEach((l, i) => {
    if (l.hidden) return;
    const b = boxes[l.id];
    const anim = l.anim || 'rise';
    const p = t == null ? null : (t - startOf(doc, l, i)) / animLength(l);
    if (p != null && p <= 0 && anim !== 'none') return;
    ctx.save();
    ctx.globalAlpha = l.opacity ?? 1;
    if (l.rotate) { ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate((l.rotate * Math.PI) / 180); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2)); }
    if (l.type === 'text') drawText(ctx, l, b, p, anim, t);
    else {
      if (p != null && anim !== 'none' && p < 1) {
        const q = easeQuint(clamp01(p));
        ctx.globalAlpha *= q;
        const cx = b.x + b.w / 2; const cy = b.y + b.h / 2;
        if (anim === 'pop') { const k = 0.8 + 0.2 * easeBack(clamp01(p)); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); }
        else if (anim === 'rise' || anim === 'reveal') ctx.translate(0, (1 - q) * 28);
        else if (anim === 'slide') ctx.translate((1 - q) * -48, 0);
        else if (anim === 'blur' && canFilter) { ctx.filter = `blur(${((1 - q) * 10).toFixed(2)}px)`; const k = 1.03 - 0.03 * q; ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); }
      }
      if (l.type === 'shape') drawShape(ctx, l, b);
      else if (l.type === 'image') { const img = ready(l.src); if (img) { if (l.contain) { const s = Math.min(b.w / img.width, b.h / img.height); ctx.drawImage(img, b.x + (b.w - img.width * s) / 2, b.y + (b.h - img.height * s) / 2, img.width * s, img.height * s); } else drawImageFit(ctx, img, b.x, b.y, b.w, b.h, l.radius || 0); } }
    }
    ctx.restore();
  });
  ctx.restore();
  return boxes;
}

/** How long the design's entrances take (the shortest sensible video). */
export function motionLength(doc) {
  let end = 0;
  (doc.layers || []).forEach((l, i) => { if (!l.hidden && (l.anim || 'rise') !== 'none') end = Math.max(end, startOf(doc, l, i) + animLength(l)); });
  return end;
}
