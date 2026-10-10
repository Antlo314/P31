import React from 'react';
import Ornaments from './Ornaments';
import './ParallaxStory.css';

/**
 * A parallax scroll view: giant outlined words drift sideways, photos float past at
 * different depths, and the message stays pinned in the middle while you scroll.
 *   words  — 2–4 short words for the drifting lines
 *   images — up to 4 { src, alt }
 *   children — the pinned message (eyebrow, heading, text, actions)
 */
const ParallaxStory = ({ words = [], images = [], children, id }) => (
  <section className="pxs k-dark" id={id}>
    <Ornaments variant="story" />
    <div className="pxs__words" aria-hidden="true">
      {words.map((w, i) => (
        <span key={w} className={`pxs__word pxs__word--${i}`} data-drift={i % 2 ? 22 : -26}>{w}</span>
      ))}
    </div>
    <div className="pxs__stage">
      {images.slice(0, 4).map((img, i) => (
        <figure key={img.src} className={`pxs__img pxs__img--${i}`} data-depth={[0.18, 0.55, 0.34, 0.7][i]}>
          <img src={img.src} alt={img.alt || ''} loading="lazy" decoding="async" />
        </figure>
      ))}
      <div className="pxs__copy">{children}</div>
    </div>
  </section>
);

export default ParallaxStory;
