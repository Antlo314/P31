import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Sun, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOperator } from './useOperator';
import SystemsLogin from './SystemsLogin';
import SystemsShowcase from './SystemsShowcase';
import Overview from './pages/Overview';
import { SYSTEMS_HOME, SYSTEMS_GROUPS, SYSTEMS_NAV } from './nav';
import { hrefFor } from '../lib/site';
import './Systems.css';

// Heavy tools load on first visit to their tab.
const Social = lazy(() => import('./pages/Social'));
const Growth = lazy(() => import('./pages/Growth'));
const Clips = lazy(() => import('./pages/Clips'));
const Photos = lazy(() => import('./pages/Photos'));
const ProEdit = lazy(() => import('./pages/ProEdit'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const Events = lazy(() => import('./pages/Events'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Orders = lazy(() => import('./pages/Orders'));
const Academy = lazy(() => import('./pages/Academy'));
const Crm = lazy(() => import('./pages/Crm'));
const Applications = lazy(() => import('./pages/Applications'));
const Health = lazy(() => import('./pages/Health'));

// Phones get the four most-used tabs in the bottom bar; "More" opens a
// sheet with every section.
const MOBILE_TABS = ['/systems', '/systems/social', '/systems/orders', '/systems/clips'];

// One menu entry: a Systems page, or (marked ↗) a link out to another dashboard.
const NavItem = ({ n, className, size, onClick }) => {
  const body = <><n.Icon size={size} /> <span>{n.label}</span>{n.away && <ArrowUpRight size={13} className="sys-away" aria-label="(opens another dashboard)" />}</>;
  if (!n.away) return <NavLink to={n.to} end={n.end} className={className} onClick={onClick}>{body}</NavLink>;
  const href = hrefFor(n.to);
  return href === n.to ? <Link to={n.to} className={className} onClick={onClick}>{body}</Link> : <a href={href} className={className}>{body}</a>;
};

const SystemsApp = () => {
  const { status, operator } = useOperator();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = !MOBILE_TABS.includes(pathname.replace(/\/+$/, ''));

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const atFront = pathname.replace(/\/+$/, '') === '/systems';
  if (status === 'loading') return <div className="sys-boot" aria-busy="true" />;
  // Visitors (and members without Systems access) at /systems see what Systems is.
  if (atFront && status !== 'operator') return <SystemsShowcase />;
  if (status === 'signed-out') return <SystemsLogin />;
  if (status === 'not-operator') {
    return (
      <div className="sys-login">
        <div className="sys-login__card">
          <h1>Systems</h1>
          <p className="sys-alert">This account doesn’t have Systems access.</p>
          <button className="sys-btn sys-btn--gold sys-btn--block" onClick={signOut}>Sign in as someone else</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sys">
      <aside className="sys-side">
        <div className="sys-brand">
          <span className="sys-brand__mark">P31</span>
          <span>Systems</span>
        </div>
        <nav className="sys-side__nav" aria-label="Systems">
          <NavItem n={SYSTEMS_HOME} className="sys-side__link" size={18} />
          {SYSTEMS_GROUPS.map((g) => (
            <div key={g.id} className="sys-side__group" role="group" aria-labelledby={`sys-g-${g.id}`}>
              <p id={`sys-g-${g.id}`} className="sys-side__label">{g.label}</p>
              {g.items.map((n) => <NavItem key={n.to} n={n} className="sys-side__link" size={18} />)}
            </div>
          ))}
        </nav>
        <div className="sys-side__me">
          <div>
            <strong>{operator.display_name || operator.username}</strong>
            <span>{operator.role === 'owner' ? 'Owner' : 'Team'}</span>
          </div>
          <div className="sys-side__actions">
            <Link to="/today" className="sys-icon-btn" aria-label="Today — everything that needs you" title="Today"><Sun size={18} /></Link>
            <button className="sys-icon-btn" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      <main className="sys-main">
        <Suspense fallback={<div className="sys-loading">Loading…</div>}>
          <Routes>
            <Route index element={<Overview operator={operator} />} />
            <Route path="crm" element={<Crm />} />
            <Route path="applications" element={<Applications />} />
            <Route path="health" element={<Health />} />
            <Route path="social" element={<Social />} />
            <Route path="growth" element={<Growth />} />
            <Route path="events" element={<Events />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="orders" element={<Orders />} />
            <Route path="academy" element={<Academy />} />
            <Route path="clips" element={<Clips />} />
            <Route path="photos" element={<Photos />} />
            <Route path="pro-edit" element={<ProEdit />} />
            <Route path="settings" element={<SettingsPage operator={operator} />} />
            <Route path="*" element={<Navigate to="/systems" replace />} />
          </Routes>
        </Suspense>
      </main>

      <nav className="sys-tabbar">
        {SYSTEMS_NAV.filter((n) => MOBILE_TABS.includes(n.to)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="sys-tabbar__link">
            <n.Icon size={20} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`sys-tabbar__link ${inMore ? 'active' : ''}`} onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <Menu size={20} />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sys-modal sys-more" role="dialog" aria-modal="true" aria-label="All sections" onClick={(e) => e.target === e.currentTarget && setMoreOpen(false)}>
          <div className="sys-modal__panel">
            <div className="sys-more__head">
              <h2>Systems</h2>
              <button className="sys-icon-btn" onClick={() => setMoreOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <nav className="sys-more__nav" aria-label="All Systems sections">
              <div className="sys-more__grid">
                <NavItem n={SYSTEMS_HOME} className="sys-more__link" size={22} onClick={() => setMoreOpen(false)} />
                <Link to="/today" className="sys-more__link"><Sun size={22} /> <span>Today</span></Link>
              </div>
              {SYSTEMS_GROUPS.map((g) => (
                <section key={g.id} className="sys-more__group" aria-labelledby={`sys-mg-${g.id}`}>
                  <h3 id={`sys-mg-${g.id}`}>{g.label}</h3>
                  <div className="sys-more__grid">
                    {g.items.map((n) => <NavItem key={n.to} n={n} className="sys-more__link" size={22} onClick={() => setMoreOpen(false)} />)}
                  </div>
                </section>
              ))}
            </nav>
            <div className="sys-more__me">
              <span>{operator.display_name || operator.username} · {operator.role === 'owner' ? 'Owner' : 'Team'}</span>
              <button className="sys-btn sys-btn--ghost" onClick={signOut}><LogOut size={16} /> Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemsApp;
