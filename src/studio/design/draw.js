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
const fontOf = (l, size = l.size) => `${l.italic ? 'italic ' : ''}${l.weight || 400} ${size}px "${l.font}"`;
const setSpacing = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };
const textOf = (l) => (l.upper ? String(l.text || '').toUpperCase() : String(l.text || ''));

function wrapLines(ctx, text, width) {
  const out = [];
  for (const para of text.split('\n')) {
    const words = para.split(/ +/).filter((w, i, a) => w || a.length === 1);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width || !line) {
        if (!line && ctx.measureText(word).width > width) {
          // A single word wider than the box is broken across lines.
          let w = word;
          while (w && ctx.measureText(w).width > width) {
            let i = w.length - 1;
            while (i > 1 && ctx.measureText(w.slice(0, i)).width > width) i -= 1;
            out.push(w.slice(0, i)); w = w.slice(i);
          }
          line = w;
        } else line = next;
      } else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

/** Lines, size and box of a text layer (before pins and animation). */
function measureText(ctx, l) {
  const text = textOf(l);
  const lh = l.lh || 1.15;
  let size = l.size || 60;
  const min = Math.min(size, 14);
  let lines; let lineH;
  for (;;) {
    ctx.font = fontOf(l, size);
    setSpacing(ctx, (l.spacing || 0) * size / 100);
    lines = wrapLines(ctx, text, l.w);
    lineH = size * lh;
    const tooTall = l.fit && l.h && lines.length * lineH > l.h;
    const tooWide = l.fit && lines.some((s) => ctx.measureText(s).width > l.w + 1);
    if ((!tooTall && !tooWide) || size <= min) break;
    size = Math.max(min, size - Math.max(1, Math.round(size * 0.04)));
  }
  const cap = ctx.measureText('H');
  const capH = cap.actualBoundingBoxAscent || size * 0.7;
  return { lines, size, lineH, capH, h: Math.max(lineH, lines.length * lineH) };
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
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (p) => 1 - (1 - p) ** 3;
const easeBack = (p) => { const c = 1.6; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
export const ANIMS = [
  ['rise', 'Rise'], ['words', 'Word by word'], ['type', 'Typewriter'], ['fade', 'Fade'], ['pop', 'Pop'], ['slide', 'Slide in'], ['none', 'None'],
];
/** When each layer starts moving: its own delay, or one after another in layer order. */
const startOf = (doc, l, i) => (l.delay ?? (0.35 + i * 0.35));
/** How long a layer's entrance lasts, in seconds. */
function animLength(l) {
  if (l.type !== 'text') return 0.9;
  const text = textOf(l);
  const anim = l.anim || 'rise';
  if (anim === 'type') return Math.max(0.8, text.length * 0.045);
  if (anim === 'words') return Math.max(0.9, Math.min(3.2, text.split(/\s+/).length * 0.14));
  return 1.4;
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
function drawText(ctx, l, b, p, anim) {
  const m = b.text;
  ctx.font = fontOf(l, m.size);
  setSpacing(ctx, (l.spacing || 0) * m.size / 100);
  ctx.textBaseline = 'alphabetic';
  const ax = l.align === 'center' ? b.x + b.w / 2 : l.align === 'right' ? b.x + b.w : b.x;
  ctx.textAlign = l.align || 'left';
  if (l.bg) {
    const pad = (l.bgPad ?? 0.35) * m.size;
    const widest = Math.max(...m.lines.map((s) => ctx.measureText(s).width));
    const bx = l.align === 'center' ? ax - widest / 2 : l.align === 'right' ? ax - widest : ax;
    ctx.save();
    ctx.globalAlpha *= anim === 'none' || p == null ? 1 : easeOut(clamp01(p * 3));
    ctx.fillStyle = l.bg;
    roundRect(ctx, bx - pad, b.y - pad * 0.7, widest + pad * 2, b.h + pad * 1.4, l.bgRadius ?? pad * 1.4);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = l.color || '#000';
  const base = (i) => b.y + i * m.lineH + (m.lineH + m.capH) / 2;
  if (p == null || anim === 'none' || p >= 1) {
    m.lines.forEach((s, i) => ctx.fillText(s, ax, base(i)));
    return;
  }
  if (anim === 'type') {
    let left = Math.floor(m.lines.join('').length * clamp01(p));
    m.lines.forEach((s, i) => { if (left <= 0) return; ctx.fillText(s.slice(0, left), ax, base(i)); left -= s.length; });
    return;
  }
  if (anim === 'words') {
    const words = m.lines.map((s) => s.split(' '));
    const total = words.flat().length;
    const st = Math.min(0.12, 0.6 / Math.max(1, total)); const d = 1 - (total - 1) * st;
    let n = 0;
    words.forEach((ws, i) => {
      const lineW = ctx.measureText(ws.join(' ')).width;
      let x = l.align === 'center' ? ax - lineW / 2 : l.align === 'right' ? ax - lineW : ax;
      ctx.save(); ctx.textAlign = 'left';
      ws.forEach((w) => {
        const q = easeOut(clamp01((p - n * st) / d));
        const ww = ctx.measureText(`${w} `).width;
        if (q > 0) {
          ctx.save();
          ctx.globalAlpha *= q;
          const cx = x + ww / 2; const cy = base(i) - m.capH / 2;
          ctx.translate(cx, cy + (1 - q) * 18); ctx.scale(0.86 + 0.14 * q, 0.86 + 0.14 * q); ctx.translate(-cx, -cy);
          ctx.fillText(w, x, base(i));
          ctx.restore();
        }
        x += ww; n += 1;
      });
      ctx.restore();
    });
    return;
  }
  // rise / fade / pop / slide: line by line.
  const st = Math.min(0.18, 0.5 / m.lines.length); const d = 1 - (m.lines.length - 1) * st;
  m.lines.forEach((s, i) => {
    const q = clamp01((p - i * st) / d);
    if (q <= 0) return;
    ctx.save();
    ctx.globalAlpha *= easeOut(q);
    if (anim === 'rise') ctx.translate(0, (1 - easeOut(q)) * 46);
    else if (anim === 'slide') ctx.translate((1 - easeOut(q)) * -70, 0);
    else if (anim === 'pop') { const k = 0.7 + 0.3 * easeBack(q); const cy = base(i) - m.capH / 2; ctx.translate(ax, cy); ctx.scale(k, k); ctx.translate(-ax, -cy); }
    ctx.fillText(s, ax, base(i));
    ctx.restore();
  });
}

/**
 * Draw `doc` on `ctx` (a canvas exactly the page size). `t` is the time in seconds for video
 * frames; leave it null for the finished still. Returns the layer boxes (for the editor).
 */
export function drawDesign(ctx, doc, t = null) {
  const { w, h } = sizeOf(doc);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
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
  drawPattern(ctx, w, h, doc.pattern, t ?? 0);
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
    if (l.type === 'text') drawText(ctx, l, b, p, anim);
    else {
      if (p != null && anim !== 'none' && p < 1) {
        const q = easeOut(clamp01(p));
        ctx.globalAlpha *= q;
        if (anim === 'pop') { const k = 0.6 + 0.4 * easeBack(clamp01(p)); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(k, k); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2)); }
        else if (anim === 'rise') ctx.translate(0, (1 - q) * 40);
        else if (anim === 'slide') ctx.translate((1 - q) * -60, 0);
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
