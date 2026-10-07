import React from 'react';
import LazyVideo from './LazyVideo';

/**
 * The dark brand hero that opens every inner page.
 *   title / accent  — "Market" + accent "dates" renders the accent in gold italic
 *   media           — { src, poster?, video?: true, portrait?: true, alt? } in an arch frame
 *   children        — extra row under the copy (search bars, filters, actions)
 */
const PageHeader = ({ eyebrow, title, accent, lead, media, actions, children }) => (
  <header className={`k-hero k-dark ${media ? 'k-hero--media' : ''}`}>
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
