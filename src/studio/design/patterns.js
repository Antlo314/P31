// Background patterns for the Design studio, drawn on a canvas from a seed so every design is
// reproducible (the preview, the exported image and each video frame match). "Topo" is the
// contour-line look from the CEO's Canva quote cards: smooth noise, traced into level lines.

// ── Seeded value noise (3D so the lines can drift slowly in a video) ─────────────
function hash(i, j, k, seed) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function noise3(x, y, z, seed) {
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
  const xf = x - xi; const yf = y - yi; const zf = z - zi;
  const u = fade(xf); const v = fade(yf); const w = fade(zf);
  const c = (a, b, d) => hash(xi + a, yi + b, zi + d, seed);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
export const rand = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// ── Contour lines (marching squares over the noise field) ───────────────────
const topoCache = new Map();
function contours(w, h, { seed = 1, scale = 1, density = 1, z = 0 }) {
  const key = `${w}x${h}|${seed}|${scale}|${density}|${z.toFixed(3)}`;
  if (topoCache.has(key)) return topoCache.get(key);
  const step = 14;
  const cols = Math.ceil(w / step) + 2; const rows = Math.ceil(h / step) + 2;
  const fr = 1 / (640 * scale); // feature size: a few big, slow sweeps across the page, like the Canva card
  const field = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = (i - 1) * step; const y = (j - 1) * step;
      field[j * cols + i] = noise3(x * fr, y * fr, z, seed) * 0.8 + noise3(x * fr * 2.3, y * fr * 2.3, z * 1.3 + 7.7, seed + 11) * 0.2;
    }
  }
  const count = Math.max(3, Math.round(7 * density));
  const levels = Array.from({ length: count }, (_, k) => 0.24 + (0.52 * (k + 0.5)) / count);
  const lines = levels.map((lv, li) => {
    // Segments between cell edges; each point is keyed by its edge so segments can be chained.
    const segs = [];
    const pt = (i, j, horiz) => {
      const a = field[j * cols + i]; const b = horiz ? field[j * cols + i + 1] : field[(j + 1) * cols + i];
      const t = (lv - a) / (b - a || 1e-6);
      return { id: `${horiz ? 'h' : 'v'}${i},${j}`, x: (i - 1 + (horiz ? t : 0)) * step, y: (j - 1 + (horiz ? 0 : t)) * step };
    };
    for (let j = 0; j < rows - 1; j += 1) {
      for (let i = 0; i < cols - 1; i += 1) {
        const tl = field[j * cols + i] > lv; const tr = field[j * cols + i + 1] > lv;
        const br = field[(j + 1) * cols + i + 1] > lv; const bl = field[(j + 1) * cols + i] > lv;
        const idx = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const top = () => pt(i, j, true); const bottom = () => pt(i, j + 1, true);
        const left = () => pt(i, j, false); const right = () => pt(i + 1, j, false);
        switch (idx) {
          case 1: case 14: segs.push([left(), bottom()]); break;
          case 2: case 13: segs.push([bottom(), right()]); break;
          case 3: case 12: segs.push([left(), right()]); break;
          case 4: case 11: segs.push([top(), right()]); break;
          case 6: case 9: segs.push([top(), bottom()]); break;
          case 7: case 8: segs.push([left(), top()]); break;
          case 5: segs.push([left(), top()], [bottom(), right()]); break;
          case 10: segs.push([left(), bottom()], [top(), right()]); break;
          default:
        }
      }
    }
    // Chain the segments into polylines.
    const byPoint = new Map();
    segs.forEach((s, n) => s.forEach((p) => { const l = byPoint.get(p.id); if (l) l.push(n); else byPoint.set(p.id, [n]); }));
    const used = new Uint8Array(segs.length);
    const polys = [];
    for (let n = 0; n < segs.length; n += 1) {
      if (used[n]) continue;
      used[n] = 1;
      const line = [segs[n][0], segs[n][1]];
      for (const dir of [1, -1]) {
        for (;;) {
          const end = dir === 1 ? line[line.length - 1] : line[0];
          const next = (byPoint.get(end.id) || []).find((m) => !used[m]);
          if (next === undefined) break;
          used[next] = 1;
          const s = segs[next]; const p = s[0].id === end.id ? s[1] : s[0];
          if (dir === 1) line.push(p); else line.unshift(p);
        }
      }
      if (line.length > 3) polys.push(line);
    }
    return { level: li, polys };
  });
  if (topoCache.size > 60) topoCache.clear();
  topoCache.set(key, lines);
  return lines;
}

function smoothLine(ctx, pts) {
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length - 1; k += 1) {
    const mx = (pts[k].x + pts[k + 1].x) / 2; const my = (pts[k].y + pts[k + 1].y) / 2;
    ctx.quadraticCurveTo(pts[k].x, pts[k].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

// ── The patterns ─────────────────────────────────────────────────────────────
// Each draws onto ctx (already sized w×h) with p = { color, opacity, weight, density, scale, seed }
// at time t seconds (0 for a still image).
const PATTERNS = {
  none: { label: 'None', draw: () => {} },
  topo: {
    label: 'Topo lines',
    draw(ctx, w, h, p, t) {
      const lines = contours(w, h, { seed: p.seed, scale: p.scale, density: p.density, z: (p.seed % 97) * 0.37 + t * 0.045 });
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      lines.forEach(({ level, polys }) => {
        ctx.lineWidth = (level % 3 === 0 ? 6.5 : level % 3 === 1 ? 2.6 : 4.4) * p.weight;
        ctx.beginPath();
        polys.forEach((pts) => smoothLine(ctx, pts));
        ctx.stroke();
      });
    },
  },
  waves: {
    label: 'Flowing waves',
    draw(ctx, w, h, p, t) {
      const r = rand(p.seed);
      const n = Math.max(4, Math.round(14 * p.density));
      const phase = r() * 6.28;
      ctx.lineCap = 'round';
      for (let k = 0; k < n; k += 1) {
        const y0 = (h * (k + 0.5)) / n;
        const a = (40 + r() * 50) * p.scale; const f = (0.004 + r() * 0.003) / p.scale;
        ctx.lineWidth = (k % 3 === 0 ? 5 : 2.4) * p.weight;
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += 12) {
          const y = y0 + a * Math.sin(x * f + phase + k * 0.55 + t * 0.35) + a * 0.4 * Math.sin(x * f * 2.3 + k + t * 0.2);
          if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
  },
  arches: {
    label: 'Arches',
    draw(ctx, w, h, p, t) {
      const n = Math.max(3, Math.round(7 * p.density));
      const cx = w * 0.72; const base = h + 4;
      ctx.lineWidth = 3 * p.weight;
      for (let k = 0; k < n; k += 1) {
        const r = (w * 0.22 + k * 70 * p.scale) * (1 + 0.012 * Math.sin(t * 0.8 + k));
        const top = base - r * 2.1;
        ctx.beginPath();
        ctx.moveTo(cx - r, base);
        ctx.lineTo(cx - r, top + r);
        ctx.arc(cx, top + r, r, Math.PI, 0);
        ctx.lineTo(cx + r, base);
        ctx.stroke();
      }
    },
  },
  rings: {
    label: 'Rings',
    draw(ctx, w, h, p, t) {
      const r = rand(p.seed);
      const cx = r() < 0.5 ? w * 0.08 : w * 0.92; const cy = r() < 0.5 ? h * 0.1 : h * 0.9;
      const gap = 46 * p.scale;
      const n = Math.ceil(Math.hypot(w, h) / gap * Math.min(1, p.density));
      for (let k = 1; k <= n; k += 1) {
        ctx.lineWidth = (k % 4 === 0 ? 5 : 2) * p.weight;
        ctx.beginPath();
        ctx.arc(cx, cy, k * gap + (t * 6) % gap, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },
  dots: {
    label: 'Halftone dots',
    draw(ctx, w, h, p, t) {
      const gap = 34 * p.scale;
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          const v = noise3(x / (380 * p.scale), y / (380 * p.scale), p.seed * 0.1 + t * 0.05, p.seed);
          const rad = Math.max(0, (v - 0.35) * 16 * p.weight * Math.min(1.4, p.density));
          if (rad < 0.6) continue;
          ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  },
  blobs: {
    label: 'Soft blobs',
    draw(ctx, w, h, p, t) {
      const r = rand(p.seed);
      const n = Math.max(2, Math.round(4 * p.density));
      for (let k = 0; k < n; k += 1) {
        const cx = r() * w; const cy = r() * h; const rad = (180 + r() * 260) * p.scale;
        ctx.beginPath();
        for (let a = 0; a <= 64; a += 1) {
          const th = (a / 64) * Math.PI * 2;
          const rr = rad * (0.78 + 0.32 * noise3(Math.cos(th) * 1.4 + k * 9, Math.sin(th) * 1.4, t * 0.08 + p.seed * 0.01, p.seed + k));
          const x = cx + Math.cos(th) * rr; const y = cy + Math.sin(th) * rr;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.45 * p.opacity;
        ctx.fill();
      }
    },
  },
  grain: {
    label: 'Paper grain',
    draw(ctx, w, h, p) {
      const r = rand(p.seed);
      const n = Math.round(9000 * p.density);
      for (let k = 0; k < n; k += 1) ctx.fillRect(r() * w, r() * h, 1.6 * p.weight, 1.6 * p.weight);
    },
  },
};
export const PATTERN_KINDS = Object.entries(PATTERNS).map(([key, v]) => ({ key, label: v.label }));

/** Draw the pattern `p` (with its defaults filled in) at time t. */
export function drawPattern(ctx, w, h, p, t = 0) {
  const def = PATTERNS[p?.kind] || PATTERNS.none;
  if (def === PATTERNS.none) return;
  const q = { color: '#AF9EAC', opacity: 1, weight: 1, density: 1, scale: 1, seed: 7, ...p };
  ctx.save();
  ctx.globalAlpha = q.opacity;
  ctx.strokeStyle = q.color; ctx.fillStyle = q.color;
  def.draw(ctx, w, h, q, t);
  ctx.restore();
}
