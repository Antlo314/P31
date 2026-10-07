// Photo Studio backdrops, filters and the auto-staging maths. Every backdrop
// is drawn procedurally, so there are no stock images to license or load.

export const FILTERS = [
  { id: 'none', name: 'Original', css: '' },
  { id: 'bright', name: 'Bright', css: 'brightness(1.08) contrast(1.05)' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.35) contrast(1.1)' },
  { id: 'warm', name: 'Warm', css: 'sepia(0.18) saturate(1.15) brightness(1.04)' },
  { id: 'golden', name: 'Golden Hour', css: 'sepia(0.3) saturate(1.3) hue-rotate(-10deg) brightness(1.05)' },
  { id: 'cool', name: 'Cool', css: 'hue-rotate(-8deg) saturate(1.05) brightness(1.03)' },
  { id: 'matte', name: 'Matte', css: 'contrast(0.9) brightness(1.06) saturate(0.9)' },
  { id: 'plum', name: 'Plum Luxe', css: 'saturate(1.12) hue-rotate(8deg) contrast(1.08)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.2)' },
];

export const OUTPUTS = [
  { id: '1:1', w: 1600, h: 1600, note: 'Shop grid' },
  { id: '4:5', w: 1440, h: 1800, note: 'Instagram' },
  { id: '3:4', w: 1350, h: 1800, note: 'Product page' },
  { id: '9:16', w: 1080, h: 1920, note: 'Stories' },
  { id: '16:9', w: 1920, h: 1080, note: 'Banner' },
];

// floor: where the product's base sits (fraction of height)
// fill: how tall the product is allowed to be (fraction of height)
export const STAGES = [
  { id: 'original', name: 'Original photo' },
  { id: 'transparent', name: 'Transparent', floor: 0.5, fill: 0.8, center: true, shadow: false },
  { id: 'white', name: 'Marketplace White', floor: 0.84, fill: 0.68 },
  { id: 'studio', name: 'Studio Grey', floor: 0.8, fill: 0.62 },
  { id: 'blush', name: 'Lavender Blush', floor: 0.8, fill: 0.62 },
  { id: 'linen', name: 'Warm Linen', floor: 0.8, fill: 0.62 },
  { id: 'marble', name: 'Marble', floor: 0.78, fill: 0.6, reflect: true },
  { id: 'botanical', name: 'Window Light', floor: 0.8, fill: 0.62 },
  { id: 'pedestal', name: 'Gold Pedestal', floor: 0.66, fill: 0.5, pedestal: true },
  { id: 'night', name: 'Plum Night', floor: 0.78, fill: 0.6, reflect: true },
  { id: 'emerald', name: 'Emerald', floor: 0.8, fill: 0.62 },
];

// Deterministic pseudo-random so a backdrop looks the same every redraw.
const rng = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const radial = (ctx, W, H, x, y, r, stops) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};

const linear = (ctx, W, H, x0, y0, x1, y1, stops) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};

const floorBand = (ctx, W, H, y, top, bottom) => {
  const g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, H - y);
};

export const drawBackdrop = (ctx, stage, W, H) => {
  const m = Math.max(W, H);
  const fy = H * (stage.floor ?? 0.8) - m * 0.02;
  switch (stage.id) {
    case 'transparent':
      ctx.clearRect(0, 0, W, H);
      break;
    case 'white':
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      break;
    case 'studio':
      radial(ctx, W, H, W / 2, H * 0.42, m * 0.75, [[0, '#f7f6f8'], [0.6, '#e4e2e7'], [1, '#c9c6ce']]);
      floorBand(ctx, W, H, fy, 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.06)');
      break;
    case 'blush':
      linear(ctx, W, H, 0, 0, W, H, [[0, '#fbf3ff'], [0.55, '#ecddfa'], [1, '#f6d9e6']]);
      radial(ctx, W, H, W * 0.75, H * 0.2, m * 0.5, [[0, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]);
      floorBand(ctx, W, H, fy, 'rgba(94,42,140,0.0)', 'rgba(94,42,140,0.08)');
      break;
    case 'linen': {
      linear(ctx, W, H, 0, 0, 0, H, [[0, '#f4ece0'], [1, '#e6d8c4']]);
      const r = rng(7);
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 1400; i++) {
        ctx.fillStyle = r() > 0.5 ? '#8a6d4a' : '#ffffff';
        ctx.fillRect(r() * W, r() * H, m * 0.004, m * 0.0012);
      }
      ctx.globalAlpha = 1;
      floorBand(ctx, W, H, fy, 'rgba(90,60,30,0)', 'rgba(90,60,30,0.1)');
      break;
    }
    case 'marble': {
      linear(ctx, W, H, 0, 0, W, H, [[0, '#fbfaf8'], [1, '#ebe8e4']]);
      const r = rng(31);
      ctx.save();
      ctx.filter = `blur(${Math.round(m * 0.002)}px)`;
      for (let i = 0; i < 9; i++) {
        ctx.strokeStyle = `rgba(120,115,125,${0.08 + r() * 0.14})`;
        ctx.lineWidth = m * (0.0015 + r() * 0.004);
        ctx.beginPath();
        let x = r() * W; let y = -10;
        ctx.moveTo(x, y);
        while (y < H + 10) {
          const nx = x + (r() - 0.45) * m * 0.12;
          const ny = y + m * (0.06 + r() * 0.08);
          ctx.quadraticCurveTo(x + (r() - 0.5) * m * 0.1, (y + ny) / 2, nx, ny);
          x = nx; y = ny;
        }
        ctx.stroke();
      }
      ctx.restore();
      floorBand(ctx, W, H, fy, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.05)');
      break;
    }
    case 'botanical': {
      linear(ctx, W, H, 0, 0, W, H, [[0, '#fbf6ec'], [1, '#efe4d0']]);
      // Soft leaf shadows falling from a window.
      const r = rng(11);
      ctx.save();
      ctx.filter = `blur(${Math.round(m * 0.012)}px)`;
      ctx.fillStyle = 'rgba(60,70,40,0.16)';
      for (let i = 0; i < 14; i++) {
        const x = W * (0.55 + r() * 0.5);
        const y = H * (r() * 0.6);
        const s = m * (0.04 + r() * 0.07);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.8 + r() * 1.2);
        ctx.beginPath();
        ctx.ellipse(0, 0, s, s * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      floorBand(ctx, W, H, fy, 'rgba(80,60,30,0)', 'rgba(80,60,30,0.08)');
      break;
    }
    case 'pedestal': {
      radial(ctx, W, H, W / 2, H * 0.35, m * 0.8, [[0, '#6b3299'], [0.55, '#3d1a63'], [1, '#1d0f2e']]);
      radial(ctx, W, H, W / 2, H * 0.3, m * 0.35, [[0, 'rgba(242,206,77,0.22)'], [1, 'rgba(242,206,77,0)']]);
      const top = H * stage.floor;
      const pw = Math.min(W * 0.62, m * 0.5);
      const ph = H - top;
      const rx = pw / 2;
      const ry = pw * 0.09;
      const body = ctx.createLinearGradient(W / 2 - rx, 0, W / 2 + rx, 0);
      body.addColorStop(0, '#2a1544'); body.addColorStop(0.45, '#56287f'); body.addColorStop(1, '#22113a');
      ctx.fillStyle = body;
      ctx.fillRect(W / 2 - rx, top, pw, ph);
      ctx.beginPath();
      ctx.ellipse(W / 2, top, rx, ry, 0, 0, Math.PI * 2);
      const cap = ctx.createLinearGradient(0, top - ry, 0, top + ry);
      cap.addColorStop(0, '#7a45a8'); cap.addColorStop(1, '#4a1f78');
      ctx.fillStyle = cap;
      ctx.fill();
      ctx.lineWidth = Math.max(2, m * 0.004);
      ctx.strokeStyle = '#F2CE4D';
      ctx.stroke();
      break;
    }
    case 'night':
      linear(ctx, W, H, 0, 0, 0, H, [[0, '#2a1544'], [1, '#12081d']]);
      radial(ctx, W, H, W / 2, H * 0.48, m * 0.45, [[0, 'rgba(242,206,77,0.28)'], [1, 'rgba(242,206,77,0)']]);
      floorBand(ctx, W, H, fy, 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.35)');
      break;
    case 'emerald':
      radial(ctx, W, H, W * 0.5, H * 0.35, m * 0.85, [[0, '#2bb07c'], [0.5, '#17603c'], [1, '#0f3d28']]);
      floorBand(ctx, W, H, fy, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.22)');
      break;
    default:
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
  }
};

// Bounding box of the visible subject in a cut-out (alpha > 40%).
export const subjectBox = (imageData) => {
  const { width, height, data } = imageData;
  let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 100) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

// Remove the faint haze background-removal models leave behind.
export const cleanAlpha = (imageData) => {
  const d = imageData.data;
  for (let i = 3; i < d.length; i += 4) {
    const a = d[i] / 255;
    d[i] = Math.round(255 * Math.max(0, Math.min(1, (a - 0.1) / 0.8)));
  }
  return imageData;
};

// Where the product goes: fit inside the stage's allowance, base on the floor.
export const placeSubject = (box, stage, W, H, sizeMul = 1, lift = 0) => {
  const maxH = H * stage.fill * sizeMul;
  const maxW = W * 0.78 * sizeMul;
  const scale = Math.min(maxH / box.h, maxW / box.w);
  const w = box.w * scale;
  const h = box.h * scale;
  const x = (W - w) / 2;
  const y = stage.center ? (H - h) / 2 - lift * H : H * stage.floor - h - lift * H;
  return { x, y, w, h, scale };
};
