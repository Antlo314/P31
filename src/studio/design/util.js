// Small helpers for the Design studio.

/** Read an image file, shrunk to at most `max` px on its long side, as a data URL. */
export function readImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const png = /png|webp|gif/.test(file.type);
      resolve({ src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.86), w: c.width, h: c.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That picture could not be opened.')); };
    img.src = url;
  });
}

/** Wraps the longest word of `text` in *asterisks* (a one-tap highlight). */
export function highlightLongest(text) {
  const ws = String(text || '').split(' ');
  const bare = (w) => w.replace(/[^\p{L}\p{N}']/gu, '');
  const i = ws.reduce((a, w, j) => (bare(w).length > bare(ws[a]).length ? j : a), 0);
  ws[i] = ws[i].replace(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u, '$1*$2*$3');
  return ws.join(' ');
}
