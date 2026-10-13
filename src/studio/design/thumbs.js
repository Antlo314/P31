import { drawDesign, sizeOf } from './draw';
import { prepare } from './export';

// Thumbnails are drawn one at a time (full size, then scaled down) so a grid of forty
// designs never blocks the page; each waits its turn in this queue.
let chain = Promise.resolve();
const queue = (job) => { chain = chain.then(job, job); return chain; };
const big = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/** Draw `doc` small into a canvas (async, in turn). */
export function paintThumb(canvas, doc) {
  return queue(async () => {
    if (!canvas?.isConnected) return;
    await prepare(doc);
    const { w, h } = sizeOf(doc);
    big.width = w; big.height = h;
    drawDesign(big.getContext('2d'), doc, null);
    const k = canvas.width / w;
    canvas.height = Math.round(h * k);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(big, 0, 0, canvas.width, canvas.height);
  });
}

/** A small JPEG data URL of a design (for saved-design cards). */
export async function thumbDataUrl(doc, width = 240) {
  const c = document.createElement('canvas'); c.width = width;
  c.height = Math.round(width * (sizeOf(doc).h / sizeOf(doc).w));
  document.body.appendChild(c); c.style.cssText = 'position:fixed;left:-9999px';
  try { await paintThumb(c, doc); return c.toDataURL('image/jpeg', 0.8); } finally { c.remove(); }
}
