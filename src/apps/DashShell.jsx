import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, LayoutGrid } from 'lucide-react';
import { applyMeta } from '../lib/seo';
import './dash.css';

/**
 * Shared frame for member dashboards (classrooms, mentor consoles, Content Studio).
 *   nav:   [{ to, label, Icon, end?, badge? }]   — first 4 become the phone tab bar
 *   theme: 'light' (ivory work area) | 'dark' (night, for the studio)
 */
const DashShell = ({ theme = 'light', variant, brand, nav, account, onSignOut, banner, tools, children }) => {
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { Promise.resolve().then(() => setMore(false)); }, [pathname]);
  // Private dashboards: a clear tab title, and never indexed.
  useEffect(() => { applyMeta({ title: `${brand.title} · ${brand.subtitle}`, noindex: true }); }, [brand.title, brand.subtitle]);
  useEffect(() => {
    if (!more) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMore(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [more]);

  const tabs = nav.slice(0, 4);
  const inMore = !tabs.some((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  const links = (cls) => nav.map((n) => (
    <NavLink key={n.to} to={n.to} end={n.end} className={cls}>
      <n.Icon size={19} /> <span>{n.label}</span>
      {n.badge ? <em className="ds-badge">{n.badge > 99 ? '99+' : n.badge}</em> : null}
    </NavLink>
  ));

  return (
    <div className={`ds ds--${theme} ${variant ? `ds--${variant}` : ''}`}>
      <aside className="ds-side">
        <Link to={brand.to} className="ds-brand">
          {brand.mark && <img src={brand.mark} alt="" />}
          <span><strong>{brand.title}</strong><small>{brand.subtitle}</small></span>
        </Link>
        <nav className="ds-nav" aria-label="Dashboard">{links('ds-link')}</nav>
        <div className="ds-me">
          <div><strong>{account?.name || 'Signed in'}</strong><span>{account?.role}</span></div>
          <div className="ds-me__actions">
            {tools}
            <Link to="/portal?choose" className="ds-icon-btn" aria-label="All my dashboards"><LayoutGrid size={17} /></Link>
            {onSignOut && <button className="ds-icon-btn" onClick={onSignOut} aria-label="Sign out"><LogOut size={17} /></button>}
          </div>
        </div>
      </aside>

      <div className="ds-top">
        <Link to={brand.to} className="ds-brand ds-brand--top">
          {brand.mark && <img src={brand.mark} alt="" />}
          <span><strong>{brand.title}</strong><small>{brand.subtitle}</small></span>
        </Link>
        {tools && <div className="ds-top__tools">{tools}</div>}
      </div>

      <main className="ds-main">
        {banner}
        {children}
      </main>

      <nav className="ds-tabs" aria-label="Quick navigation">
        {tabs.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="ds-tab">
            <n.Icon size={20} /><span>{n.label}</span>{n.badge ? <em className="ds-badge">{n.badge}</em> : null}
          </NavLink>
        ))}
        <button type="button" className={`ds-tab ${inMore ? 'active' : ''}`} onClick={() => setMore(true)} aria-haspopup="dialog">
          <Menu size={20} /><span>More</span>
        </button>
      </nav>

      {more && (
        <div className="ds-sheet" role="dialog" aria-modal="true" aria-label="All sections" onClick={(e) => e.target === e.currentTarget && setMore(false)}>
          <div className="ds-sheet__panel">
            <div className="ds-sheet__head">
              <strong>{brand.title}</strong>
              <button className="ds-icon-btn" onClick={() => setMore(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <nav className="ds-sheet__grid">{links('ds-sheet__link')}</nav>
            <div className="ds-sheet__foot">
              <Link to="/portal?choose" className="k-btn k-btn--ghost k-btn--sm"><LayoutGrid size={16} /> My dashboards</Link>
              {onSignOut && <button className="k-btn k-btn--ghost k-btn--sm" onClick={onSignOut}><LogOut size={16} /> Sign out</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashShell;

/** Page header used inside dashboards. */
export const DashHead = ({ eyebrow, title, accent, lead, actions }) => (
  <header className="ds-head">
    <div>
      {eyebrow && <p className="k-eyebrow">{eyebrow}</p>}
      <h1 className="ds-title">{title}{accent && <> <em>{accent}</em></>}</h1>
      {lead && <p className="ds-lead">{lead}</p>}
    </div>
    {actions && <div className="k-actions">{actions}</div>}
  </header>
);

/** Friendly empty state. */
export const DashEmpty = ({ Icon, title, children, action }) => (
  <div className="ds-empty">
    {Icon && <span className="ds-empty__icon"><Icon size={24} /></span>}
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>
);
