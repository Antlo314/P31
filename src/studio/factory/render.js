// Draws a card spec to a JPEG in the browser (html-to-image, MIT) so the Studio can post the
// cards it previews without a server. Fonts are the site's own, so the export matches the screen.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { toJpeg } from 'html-to-image';
import Card, { CARD_W, CARD_H } from './Card';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Render `spec` at full size off-screen and return a JPEG File (1080×1350). */
export async function renderCard(spec, name = 'p31-card.jpg') {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1080px;height:1350px;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(React.createElement(Card, { spec, scale: 1 })));
    if (document.fonts?.ready) await document.fonts.ready;
    await sleep(60);
    const node = host.querySelector('.pc');
    const dataUrl = await toJpeg(node, { quality: 0.92, pixelRatio: 1, width: CARD_W, height: CARD_H, cacheBust: true, backgroundColor: '#140a22' });
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name, { type: 'image/jpeg' });
  } finally {
    root.unmount();
    host.remove();
  }
}
