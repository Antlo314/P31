// Promo images for a product, drawn on a canvas: four looks × three sizes, with the product
// photo, name, price, the shop name, a QR to the product and an optional headline.
// Also a booth sign (QR + "Scan to shop") for the physical market.

export const PROMO_LOOKS = [
  { id: 'clean', name: 'Clean', blurb: 'Cream, serif, lots of air', bg: '#FCFBFE', ink: '#201431', accent: '#5E2A8C', soft: '#F3ECFB' },
  { id: 'plum', name: 'Plum', blurb: 'Deep plum and gold', bg: '#2A1544', ink: '#FFFFFF', accent: '#F2CE4D', soft: 'rgba(255,255,255,0.08)' },
  { id: 'sale', name: 'Sale', blurb: 'Gold burst, strike-through price', bg: '#FFF7E0', ink: '#2A1544', accent: '#B8860B', soft: '#F6E7B5' },
  { id: 'noir', name: 'Noir', blurb: 'Black and gold, evening', bg: '#120A1A', ink: '#F5EFE6', accent: '#D9A93A', soft: 'rgba(255,255,255,0.06)' },
];

export const PROMO_SIZES = [
  { id: 'square', name: 'Post 1:1', w: 1080, h: 1080 },
  { id: 'portrait', name: 'Post 4:5', w: 1080, h: 1350 },
  { id: 'story', name: 'Story 9:16', w: 1080, h: 1920 },
];

const SERIF = '"Noto Serif", Georgia, serif';
const SANS = '"Noto Sans", -apple-system, "Segoe UI", Helvetica, Arial, sans-serif';

export const loadImage = (src) => new Promise((resolve) => {
  if (!src) return resolve(null);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

const money = (n) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;

const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Draw an image to cover a box.
const cover = (ctx, img, x, y, w, h, r) => {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s; const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
};

// Wrap text to a width; returns the lines drawn.
const wrap = (ctx, text, x, y, maxW, lineH, maxLines = 3) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*\S*$/, '')}…`;
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return lines.length;
};

/**
 * Draw the promo onto `canvas`.
 * opts: { product, shop, look, size, headline, productImg, logoImg, qrCanvas, showQr, showLogo }
 */
export function drawPromo(canvas, opts) {
  const look = PROMO_LOOKS.find((l) => l.id === opts.look) || PROMO_LOOKS[0];
  const size = PROMO_SIZES.find((s) => s.id === opts.size) || PROMO_SIZES[0];
  const { product: p, shop, headline, productImg, logoImg, qrCanvas } = opts;
  const W = size.w; const H = size.h;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pad = 72;
  const story = size.id === 'story';

  // Background
  ctx.fillStyle = look.bg;
  ctx.fillRect(0, 0, W, H);
  if (look.id === 'plum' || look.id === 'noir') {
    const g = ctx.createRadialGradient(W * 0.8, H * 0.1, 0, W * 0.8, H * 0.1, W * 0.9);
    g.addColorStop(0, look.id === 'plum' ? 'rgba(168,85,232,0.35)' : 'rgba(217,169,58,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (look.id === 'sale') {
    ctx.fillStyle = look.soft;
    ctx.beginPath(); ctx.arc(W * 0.85, H * 0.12, W * 0.3, 0, Math.PI * 2); ctx.fill();
  }

  // Layout: image on top, text below. Story leaves room top and bottom for the app's UI.
  const top = story ? 250 : pad;
  const imgH = story ? Math.round(H * 0.46) : Math.round(H * (size.id === 'square' ? 0.56 : 0.6));
  const imgX = pad; const imgW = W - pad * 2;
  if (productImg) cover(ctx, productImg, imgX, top, imgW, imgH, 36);
  else {
    ctx.fillStyle = look.soft; rr(ctx, imgX, top, imgW, imgH, 36); ctx.fill();
    ctx.fillStyle = look.accent; ctx.font = `600 40px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText('Add a product photo', W / 2, top + imgH / 2); ctx.textAlign = 'left';
  }

  // Badge / headline ribbon on the image
  const ribbon = headline || p?.badge || '';
  if (ribbon) {
    ctx.font = `800 34px ${SANS}`;
    const tw = ctx.measureText(ribbon.toUpperCase()).width + 56;
    ctx.fillStyle = look.id === 'sale' ? '#2A1544' : look.accent;
    rr(ctx, imgX + 28, top + 28, tw, 64, 32); ctx.fill();
    ctx.fillStyle = look.id === 'sale' || look.id === 'plum' || look.id === 'noir' ? (look.id === 'sale' ? '#F2CE4D' : '#2A1544') : '#fff';
    ctx.fillText(ribbon.toUpperCase(), imgX + 56, top + 72);
  }

  // Text block
  let y = top + imgH + 72;
  ctx.fillStyle = look.ink;
  ctx.font = `400 ${story ? 64 : 58}px ${SERIF}`;
  const lines = wrap(ctx, p?.name || 'Product name', pad, y, W - pad * 2 - (opts.showQr && qrCanvas ? 260 : 0), story ? 74 : 68, 2);
  y += lines * (story ? 74 : 68) + 18;

  // Price
  const onSale = Number(p?.compare_at_price) > Number(p?.price);
  ctx.font = `800 ${story ? 56 : 50}px ${SANS}`;
  ctx.fillStyle = look.accent;
  const priceText = money(p?.price || 0);
  ctx.fillText(priceText, pad, y + 40);
  if (onSale) {
    const pw = ctx.measureText(priceText).width;
    ctx.font = `500 34px ${SANS}`;
    ctx.fillStyle = look.id === 'plum' || look.id === 'noir' ? 'rgba(255,255,255,0.6)' : '#6E6580';
    const was = money(p.compare_at_price);
    ctx.fillText(was, pad + pw + 22, y + 38);
    const ww = ctx.measureText(was).width;
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pad + pw + 20, y + 26); ctx.lineTo(pad + pw + 24 + ww, y + 26); ctx.stroke();
  }
  y += 100;

  // Shop line with logo
  const shopName = shop?.business_name || 'My shop';
  let sx = pad;
  if (opts.showLogo !== false && logoImg) {
    ctx.save(); ctx.beginPath(); ctx.arc(pad + 30, y + 10, 30, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logoImg, pad, y - 20, 60, 60); ctx.restore();
    sx = pad + 78;
  }
  ctx.fillStyle = look.ink; ctx.font = `700 30px ${SANS}`;
  ctx.fillText(shopName, sx, y + 20);
  ctx.fillStyle = look.id === 'plum' || look.id === 'noir' ? 'rgba(255,255,255,0.7)' : '#6E6580';
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText(`p31market.com/${shop?.slug || ''}`.replace(/\/$/, ''), sx, y + 56);

  // QR bottom right
  if (opts.showQr && qrCanvas) {
    const q = story ? 230 : 200;
    const qx = W - pad - q; const qy = H - (story ? 300 : pad) - q;
    ctx.fillStyle = '#fff'; rr(ctx, qx - 14, qy - 14, q + 28, q + 28, 24); ctx.fill();
    ctx.drawImage(qrCanvas, qx, qy, q, q);
    ctx.fillStyle = look.id === 'plum' || look.id === 'noir' ? 'rgba(255,255,255,0.7)' : '#6E6580';
    ctx.font = `700 22px ${SANS}`; ctx.textAlign = 'center';
    ctx.fillText('SCAN TO SHOP', qx + q / 2, qy + q + 50); ctx.textAlign = 'left';
  }

  // Market mark
  ctx.fillStyle = look.accent; ctx.font = `800 22px ${SANS}`;
  ctx.fillText('PROVERBS 31 MARKETPLACE', pad, H - (story ? 230 : pad) + 8);
  ctx.fillStyle = look.id === 'plum' || look.id === 'noir' ? 'rgba(255,255,255,0.6)' : '#6E6580';
  ctx.font = `500 22px ${SANS}`;
  ctx.fillText('Where her gifts make room.', pad, H - (story ? 230 : pad) + 42);
}

/** A table sign for the market: shop name, "Scan to shop", QR, the link. 5x7 in at 300 dpi. */
export function drawSign(canvas, { shop, qrCanvas, logoImg, line = 'Scan to shop & follow' }) {
  const W = 1500; const H = 2100;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FCFBFE'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#D9A93A'; ctx.lineWidth = 10; rr(ctx, 60, 60, W - 120, H - 120, 48); ctx.stroke();
  ctx.strokeStyle = '#5E2A8C'; ctx.lineWidth = 3; rr(ctx, 90, 90, W - 180, H - 180, 36); ctx.stroke();

  let y = 300;
  if (logoImg) {
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, y, 120, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(logoImg, W / 2 - 120, y - 120, 240, 240); ctx.restore();
    y += 200;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#201431'; ctx.font = `400 96px ${SERIF}`;
  const n = wrap(ctx, shop?.business_name || 'My shop', W / 2, y + 40, W - 300, 110, 2);
  y += n * 110 + 60;
  ctx.fillStyle = '#5E2A8C'; ctx.font = `700 54px ${SANS}`;
  ctx.fillText(line, W / 2, y);
  y += 90;
  const q = 760;
  ctx.fillStyle = '#fff'; rr(ctx, W / 2 - q / 2 - 30, y - 30, q + 60, q + 60, 40); ctx.fill();
  ctx.strokeStyle = '#E7DCF4'; ctx.lineWidth = 4; rr(ctx, W / 2 - q / 2 - 30, y - 30, q + 60, q + 60, 40); ctx.stroke();
  if (qrCanvas) ctx.drawImage(qrCanvas, W / 2 - q / 2, y, q, q);
  y += q + 130;
  ctx.fillStyle = '#201431'; ctx.font = `600 46px ${SANS}`;
  ctx.fillText(`p31market.com/${shop?.slug || ''}`.replace(/\/$/, ''), W / 2, y);
  ctx.fillStyle = '#D9A93A'; ctx.font = `800 34px ${SANS}`;
  ctx.fillText('PROVERBS 31 MARKETPLACE', W / 2, H - 230);
  ctx.fillStyle = '#6E6580'; ctx.font = `500 32px ${SANS}`;
  ctx.fillText('Where her gifts make room.  ·  Proverbs 31:31', W / 2, H - 175);
  ctx.textAlign = 'left';
}

export const downloadCanvas = (canvas, name) => {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = name;
  a.click();
};
