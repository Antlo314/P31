import React from 'react';
import LazyVideo from './LazyVideo';
import Ornaments from './Ornaments';

/**
 * The dark brand hero that opens every inner page.
 *   title / accent  — "Market" + accent "dates" renders the accent in gold italic
 *   media           — { src, poster?, video?: true, portrait?: true, alt? } in an arch frame
 *   children        — extra row under the copy (search bars, filters, actions)
 *   visual          — a 3D accent (or any node) shown where media would go
 */
const PageHeader = ({ eyebrow, title, accent, lead, media, visual, actions, children }) => (
  <header className={`k-hero k-dark ${media || visual ? 'k-hero--media' : ''}`}>
    <Ornaments />
    <span className="k-hero__arch" aria-hidden="true" data-reveal="fade" />
    <div className="k-hero__inner">
      <div className="k-hero__copy">
        {eyebrow && <p className="k-eyebrow" data-intro="0">{eyebrow}</p>}
        {/* keyed so a changed title remounts instead of fighting the line animation */}
        <h1 className="k-h1" data-split="intro" key={`${title}|${accent || ''}`}>
          {title}{accent && <> <em>{accent}</em></>}
        </h1>
        {lead && <p className="k-lede" data-intro="0.25">{lead}</p>}
        {actions && <div className="k-actions" data-intro="0.35">{actions}</div>}
        {children && <div className="k-hero__extra" data-intro="0.4">{children}</div>}
      </div>
      {visual && !media && <div className="k-hero__visual" data-reveal="fade">{visual}</div>}
      {media && (
        <div className={`k-hero__media ${media.portrait ? 'is-portrait' : ''}`} data-reveal="clip">
          {media.video
            ? <LazyVideo src={media.src} poster={media.poster} eager />
            : <img src={media.src} alt={media.alt || ''} data-parallax={media.portrait ? undefined : '6'} />}
        </div>
      )}
    </div>
  </header>
);

export default PageHeader;
