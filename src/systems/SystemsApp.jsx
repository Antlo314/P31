import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { LogOut, Menu, X, Sun, ArrowUpRight, ChevronDown, ChevronRight, Monitor, Compass, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOperator } from './useOperator';
import { useRoles, isTeam } from '../lib/roles';
import { DASH, dashboardsOf, systemsPagesFor } from '../lib/dashboards';
import { useIsPhone } from '../lib/device';
import SystemsLogin from './SystemsLogin';
import SystemsShowcase from './SystemsShowcase';
import Overview from './pages/Overview';
import SystemsTour from './SystemsTour';
import { SITES, SYSTEMS_HOME, SYSTEMS_GROUPS, SYSTEMS_NAV, MOBILE_TABS, navFor, itemAllowed } from './nav';
import { hrefFor } from '../lib/site';
import './Systems.css';
import './pages/pages.css';

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
const TeamAccess = lazy(() => import('./pages/TeamAccess'));
const VendorApplications = lazy(() => import('./pages/VendorApplications'));
const Forms = lazy(() => import('./pages/Forms'));
const Shops = lazy(() => import('./pages/Shops'));
const Walkthroughs = lazy(() => import('./pages/Walkthroughs'));

// Every Systems page by its path segment. Team members see only the ones their dashboards unlock.
const PAGES = {
  orders: Orders, vendors: VendorApplications, forms: Forms, events: Events, shops: Shops, campaigns: Campaigns,
  applications: Applications, academy: Academy, crm: Crm, social: Social, growth: Growth, photos: Photos, clips: Clips, 'pro-edit': ProEdit,
  team: TeamAccess, health: Health, settings: SettingsPage, walkthroughs: Walkthroughs,
};
const ADMIN_PAGES = ['team', 'health', 'settings'];

const readFolded = (key) => { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } };

// One menu entry: a Systems page, or (marked ↗) a link out to another dashboard.
const NavItem = ({ n, className, size, onClick, tag = false }) => {
  const body = <>
    <n.Icon size={size} /> <span>{n.label}</span>
    {n.away && <ArrowUpRight size={13} className="sys-away" aria-label="(opens another dashboard)" />}
    {tag && n.desktop && !n.paused && <Monitor size={13} className="sys-away sys-desk" aria-label="(needs a computer)" />}
    {n.paused && <span className="sys-tag sys-tag--dim">Paused</span>}
  </>;
  // Paused tools stay in the menu, greyed out, so nobody wonders where they went.
  if (n.paused) return <span className={`${className} is-paused`} aria-disabled="true" title="Paused for now">{body}</span>;
  if (!n.away) return <NavLink to={n.to} end={n.end} className={className} onClick={onClick}>{body}</NavLink>;
  const href = hrefFor(n.to);
  return href === n.to ? <Link to={n.to} className={className} onClick={onClick}>{body}</Link> : <a href={href} className={className}>{body}</a>;
};

const SitePill = ({ site }) => <span className={`sys-site sys-site--${site}`}>{SITES[site]?.label || site}</span>;

/** The home of a team member: the dashboards she was given, each with where it opens. */
const TeamHome = ({ name, dashboards }) => {
  const hour = new Date().getHours();
  const first = (name || '').trim().split(/\s+/)[0];
  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Your dashboards · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1>{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}{first ? `, ${first}.` : '.'}</h1>
        <p className="sys-muted">{dashboards.length ? `${dashboards.length === 1 ? 'The dashboard this login opens' : 'The dashboards this login opens'}, and where each one leads. An admin can add more from Team & dashboards.` : 'No dashboards are switched on for this login yet. Ask an admin to assign yours in Systems → Team & dashboards.'}</p>
      </header>
      <div className="sys-dash-grid" data-tour="team-home">
        {dashboards.map((id) => {
          const d = DASH[id];
          const links = [...d.systems.map((to) => ({ to, label: SYSTEMS_NAV.find((n) => n.to === to)?.label || to })), ...d.opens];
          return (
            <article key={id} className={`sys-dash ${d.paused ? 'is-paused' : ''}`}>
              <span className="sys-dash__icon"><d.Icon size={22} /></span>
              <h2>{d.label}{d.paused && <span className="sys-tag sys-tag--dim">Paused</span>}</h2>
              <p>{d.blurb}</p>
              <div className="sys-dash__links">
                {links.map((l) => {
                  const href = hrefFor(l.to);
                  return href === l.to
                    ? <Link key={l.to} to={l.to} className="sys-btn sys-btn--ghost sys-btn--sm">{l.label} <ArrowRight size={13} /></Link>
                    : <a key={l.to} href={href} className="sys-btn sys-btn--ghost sys-btn--sm">{l.label} <ArrowUpRight size={13} /></a>;
                })}
              </div>
            </article>
          );
        })}
      </div>
      <section className="sys-card sys-card--row">
        <div><h2><Compass size={18} /> New here?</h2><p className="sys-muted">Every dashboard has an animated walkthrough, and a test run that shows it working.</p></div>
        <Link to="/systems/walkthroughs" className="sys-btn sys-btn--gold">Open the walkthroughs</Link>
      </section>
    </div>
  );
};

const SystemsApp = () => {
  const { status: opStatus, operator: op } = useOperator();
  const { status: roleStatus, roles, user } = useRoles();
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const phone = useIsPhone();
  const [moreOpen, setMoreOpen] = useState(false);
  // Which sidebar groups the person folded away (kept on this device).
  const [folded, setFolded] = useState(() => readFolded('p31_sys_nav'));
  useEffect(() => { try { localStorage.setItem('p31_sys_nav', JSON.stringify(folded)); } catch { /* private mode */ } }, [folded]);

  // Admins (Systems operators and site admins) see everything; team members see their dashboards.
  const rolesReady = roleStatus === 'ready';
  const full = opStatus === 'operator' || (rolesReady && !!roles.admin);
  const mine = rolesReady && !full ? dashboardsOf(roles) : [];
  const pages = full ? [] : systemsPagesFor(mine);
  const teamOnly = !full && rolesReady && (pages.length > 0 || isTeam(roles));
  const status = full ? 'operator'
    : opStatus === 'loading' || (opStatus !== 'signed-out' && !rolesReady) ? 'loading'
      : teamOnly ? 'team' : opStatus;
  const name = user?.user_metadata?.full_name || user?.email || 'Team';
  const operator = full ? (op || { display_name: name, role: 'admin' }) : { display_name: name, role: 'team' };
  const groups = SYSTEMS_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((n) => itemAllowed(n, mine, full)) }))
    .filter((g) => g.items.length);
  const tabs = full ? MOBILE_TABS.map((to) => SYSTEMS_NAV.find((n) => n.to === to)).filter(Boolean) : groups.flatMap((g) => g.items).filter((n) => !n.away).slice(0, 4);
  const here = navFor(pathname);
  const inMore = !tabs.some((n) => n.to === pathname.replace(/\/+$/, ''));
  const allowed = (seg) => full || seg === 'walkthroughs' || (!ADMIN_PAGES.includes(seg) && pages.includes(`/systems/${seg}`));

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const atFront = pathname.replace(/\/+$/, '') === '/systems';
  if (status === 'loading') return <div className="sys-boot" aria-busy="true" />;
  // Visitors (and members without Systems access) at /systems see what Systems is.
  if (atFront && status !== 'operator' && status !== 'team') return <SystemsShowcase />;
  if (status === 'signed-out') return <SystemsLogin />;
  if (status === 'not-operator') {
    return (
      <div className="sys-login">
        <div className="sys-login__card">
          <h1>Systems</h1>
          <p className="sys-alert">This account doesn’t have Systems access. An admin switches dashboards on in Systems → Team & dashboards for the email you sign in with.</p>
          <button className="sys-btn sys-btn--gold sys-btn--block" onClick={signOut}>Sign in as someone else</button>
        </div>
      </div>
    );
  }

  const site = here?.item.site || 'both';

  return (
    <div className="sys">
      <aside className="sys-side">
        <div className="sys-brand">
          <span className="sys-brand__mark">P31</span>
          <span>Systems</span>
        </div>
        <nav className="sys-side__nav" aria-label="Systems">
          <NavItem n={full ? SYSTEMS_HOME : { ...SYSTEMS_HOME, label: 'My dashboards' }} className="sys-side__link" size={18} />
          {groups.map((g) => {
            // A group folds unless the current page is inside it.
            const shut = !!folded[g.id] && !g.items.some((n) => pathname.replace(/\/+$/, '').startsWith(n.to));
            return (
              <div key={g.id} className={`sys-side__group sys-side__group--${g.site} ${shut ? 'is-shut' : ''}`} role="group" aria-labelledby={`sys-g-${g.id}`}>
                <button type="button" id={`sys-g-${g.id}`} className="sys-side__label" onClick={() => setFolded((f) => ({ ...f, [g.id]: !f[g.id] }))} aria-expanded={!shut}>
                  <span>{g.label}<small>{g.sub}</small></span><ChevronDown size={13} />
                </button>
                {!shut && g.items.map((n) => <NavItem key={n.to} n={n} className="sys-side__link" size={18} tag />)}
              </div>
            );
          })}
        </nav>
        <div className="sys-side__me">
          <div>
            <strong>{operator.display_name || operator.username}</strong>
            <span>{operator.role === 'owner' ? 'Owner' : full ? 'Admin' : 'Team'}</span>
          </div>
          <div className="sys-side__actions">
            <Link to="/today" className="sys-icon-btn" aria-label="Today — everything that needs you" title="Today"><Sun size={18} /></Link>
            <button className="sys-icon-btn" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      <main className="sys-main">
        {/* Where you are: which site, which room. */}
        <div className="sys-crumb" aria-label="Where you are">
          <SitePill site={site} />
          {here ? (
            <>
              <ChevronRight size={13} className="sys-crumb__sep" /><span>{here.group.label}</span>
              <ChevronRight size={13} className="sys-crumb__sep" /><strong>{here.item.label}</strong>
              {here.item.paused ? <span className="sys-tag sys-tag--dim">Paused</span> : here.item.desktop && <span className="sys-tag"><Monitor size={11} /> Computer</span>}
            </>
          ) : <strong>{full ? 'Overview' : 'My dashboards'}</strong>}
          {site !== 'both' && <span className="sys-crumb__host">{SITES[site]?.host}</span>}
        </div>

        <Suspense fallback={<div className="sys-loading">Loading…</div>}>
          <Routes>
            <Route index element={full ? <Overview operator={operator} /> : <TeamHome name={name} dashboards={mine} />} />
            {Object.entries(PAGES).map((entry) => {
              const seg = entry[0]; const Page = entry[1];
              return <Route key={seg} path={seg} element={allowed(seg) ? <Page operator={operator} /> : <Navigate to="/systems" replace />} />;
            })}
            <Route path="*" element={<Navigate to="/systems" replace />} />
          </Routes>
        </Suspense>
        <SystemsTour user={user} />
      </main>

      <nav className="sys-tabbar">
        {tabs.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="sys-tabbar__link">
            <n.Icon size={20} />
            <span>{n.short || n.label}</span>
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
                <NavItem n={full ? SYSTEMS_HOME : { ...SYSTEMS_HOME, label: 'My dashboards' }} className="sys-more__link" size={22} onClick={() => setMoreOpen(false)} />
                <Link to="/today" className="sys-more__link"><Sun size={22} /> <span>Today</span></Link>
              </div>
              {groups.map((g) => (
                <section key={g.id} className="sys-more__group" aria-labelledby={`sys-mg-${g.id}`}>
                  <h3 id={`sys-mg-${g.id}`}>{g.site !== 'both' ? <SitePill site={g.site} /> : g.label} <small>{g.sub}</small></h3>
                  <div className="sys-more__grid">
                    {g.items.map((n) => <NavItem key={n.to} n={n} className={`sys-more__link ${n.desktop ? 'is-desktop' : ''}`} size={22} onClick={() => setMoreOpen(false)} tag />)}
                  </div>
                </section>
              ))}
              {phone && groups.some((g) => g.items.some((n) => n.desktop && !n.paused)) && (
                <p className="sys-more__note"><Monitor size={13} /> On your computer: {groups.flatMap((g) => g.items).filter((n) => n.desktop && !n.paused).map((n) => n.label).join(' and ')} {groups.flatMap((g) => g.items).filter((n) => n.desktop && !n.paused).length === 1 ? 'edits' : 'edit'} video on the device itself. Everything else works right here.</p>
              )}
            </nav>
            <div className="sys-more__me">
              <span>{operator.display_name || operator.username} · {operator.role === 'owner' ? 'Owner' : full ? 'Admin' : 'Team'}</span>
              <button className="sys-btn sys-btn--ghost" onClick={signOut}><LogOut size={16} /> Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemsApp;
