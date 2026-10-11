import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { hrefFor } from '../lib/site';

/** A link inside this site, or a full link when the page lives on the other domain. */
export const Go = ({ to, className, children }) => {
  const href = hrefFor(to);
  return href === to ? <Link to={to} className={className}>{children}</Link> : <a href={href} className={className}>{children}</a>;
};

const SITE_LABEL = { market: 'Market', collective: 'Collective' };

/** One "needs attention" card: a count, the first few items, and a way in. Used on Today and the Systems overview. */
const AttentionCard = ({ card, showSite = false }) => {
  const { Icon, title, count, items = [], to, cta, empty, tone, site } = card;
  return (
    <article className={`td2-card ${count ? 'has-items' : ''} ${tone ? `td2-card--${tone}` : ''}`}>
      <header className="td2-card__head">
        <span className="td2-card__icon"><Icon size={18} /></span>
        <h3>{title}</h3>
        {showSite && SITE_LABEL[site] && <span className={`td2-site td2-site--${site}`}>{SITE_LABEL[site]}</span>}
        <span className="td2-card__count" aria-label={`${count} waiting`}>{count > 99 ? '99+' : count}</span>
      </header>
      {items.length ? (
        <ul className="td2-items">
          {items.slice(0, 4).map((it) => (
            <li key={it.key}><Go to={it.to || to}><strong>{it.title}</strong><small>{it.sub}</small></Go></li>
          ))}
        </ul>
      ) : <p className="td2-empty"><CheckCircle2 size={15} /> {empty}</p>}
      <Go to={to} className="k-link td2-card__cta">{cta} <ArrowRight size={14} /></Go>
    </article>
  );
};

export default AttentionCard;
