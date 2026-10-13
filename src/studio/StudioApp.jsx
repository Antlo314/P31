import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarClock, PenSquare, MessagesSquare, MessageCircle, Clapperboard, Lock, Mail, CalendarRange, Wand2, Palette } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRoles } from '../lib/roles';
import { dashboardsOf } from '../lib/dashboards';
import DashShell from '../apps/DashShell';
import { StudioOverview, StudioCalendar, StudioCompose, StudioInbox, StudioComments, StudioCreate } from './pages';
import StudioEmail from './Email';
import StudioPlanner from './Planner';
import StudioFactory from './Factory';
// The Design studio carries its own fonts and music engine, so it loads only when opened.
const StudioDesign = lazy(() => import('./design/Designer'));
import { supabase } from '../lib/supabase';
import logo from '../assets/web/p31-mark-192.webp';
import Tour, { TourButton } from '../components/Tour';
import { STUDIO_TOUR, STUDIO_EMAIL_TOUR } from './studioTour';
import '../pages/Login.css';
import './studio.css';

const NAV = [
  { to: '/studio', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/studio/email', label: 'Email', Icon: Mail },
  { to: '/studio/planner', label: 'Planner', Icon: CalendarRange },
  { to: '/studio/design', label: 'Design', Icon: Palette },
  { to: '/studio/autocreate', label: 'Auto-create', Icon: Wand2 },
  { to: '/studio/calendar', label: 'Calendar', Icon: CalendarClock },
  { to: '/studio/compose', label: 'Create post', Icon: PenSquare },
  { to: '/studio/inbox', label: 'Messages', Icon: MessagesSquare },
  { to: '/studio/comments', label: 'Comments', Icon: MessageCircle },
  { to: '/studio/create', label: 'Creative tools', Icon: Clapperboard },
];
const PAGES = { '': StudioOverview, email: StudioEmail, planner: StudioPlanner, design: StudioDesign, autocreate: StudioFactory, calendar: StudioCalendar, compose: StudioCompose, inbox: StudioInbox, comments: StudioComments, create: StudioCreate };

// Which Studio pages a person gets: the Content creator dashboard (and admins, Studio seats) open
// everything; Social media manager opens the overview, messages and comments; Emails opens the inbox.
const pagesFor = (roles) => {
  const mine = dashboardsOf(roles);
  const everything = roles.admin || roles.operator || mine.includes('studio') || (roles.studio && !mine.includes('social') && !mine.includes('emails'));
  if (everything) return NAV.map((n) => n.to);
  return [...(mine.includes('social') ? ['/studio', '/studio/inbox', '/studio/comments'] : []), ...(mine.includes('emails') ? ['/studio/email'] : [])];
};

// /studio — the Content Studio, connected to Zernio.
const StudioApp = () => {
  const { signOut } = useAuth();
  const { status, roles, user } = useRoles();
  const { pathname } = useLocation();
  const [toAnswer, setToAnswer] = useState(0);
  const pages = status === 'ready' ? pagesFor(roles) : [];
  const canUse = pages.length > 0;
  const full = pages.length === NAV.length;

  // How many emails are waiting for a reply (the Email badge).
  useEffect(() => {
    if (!canUse || !pages.includes('/studio/email')) return;
    supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('status', 'needs_reply')
      .then(({ count, error }) => setToAnswer(error ? 0 : count || 0));
  }, [canUse, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <div className="ds ds--dark" aria-busy="true" />;
  if (status === 'signed-out') return <Navigate to={`/portal?next=${encodeURIComponent(pathname)}`} replace />;
  if (!canUse) {
    return (
      <div className="lg k-dark" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="lg__card" style={{ textAlign: 'center', justifyItems: 'center' }}>
          <span className="lg__badge"><Lock size={22} /></span>
          <h1 className="k-h2 lg__title">Studio seats are <em>limited</em></h1>
          <p className="lg__sub">Content Studio is for the marketing team and admins. If you should have access, ask an admin to switch on the Content creator, Social media manager or Emails dashboard in Systems → Team & dashboards for the email you sign in with.</p>
          <Link className="k-btn k-btn--ghost" to="/portal?choose">My dashboards</Link>
        </div>
      </div>
    );
  }
  const home = pages.includes('/studio') ? '/studio' : pages[0];
  const nav = NAV.filter((n) => pages.includes(n.to)).map((n) => (n.to === '/studio/email' ? { ...n, badge: toAnswer } : n));

  return (
    <DashShell
      theme="dark"
      brand={{ to: home, mark: logo, title: 'Content Studio', subtitle: 'P31 Marketplace' }}
      nav={nav}
      account={{ name: user?.user_metadata?.full_name || user?.email || (roles.preview ? 'Preview' : ''), role: roles.admin ? 'Admin' : full ? 'Studio seat' : 'Team' }}
      onSignOut={signOut}
      tools={<TourButton id={full ? 'studio' : 'studio-email'} />}
      banner={roles.preview ? <div className="ds-banner">Layout preview (development only) — Zernio calls need a real Studio sign-in.</div> : null}
    >
      <Suspense fallback={<p className="ds-muted">Loading…</p>}>
      <Routes>
        {Object.entries(PAGES).map((entry) => {
          const seg = entry[0]; const Page = entry[1];
          const el = pages.includes(`/studio${seg ? `/${seg}` : ''}`) ? <Page /> : <Navigate to={home} replace />;
          return seg ? <Route key={seg} path={seg} element={el} /> : <Route key="index" index element={el} />;
        })}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
      </Suspense>
      {full ? <Tour id="studio" steps={STUDIO_TOUR} user={user} autoStart={!roles.preview} /> : <Tour id="studio-email" steps={STUDIO_EMAIL_TOUR} user={user} autoStart={false} />}
      {full && <Tour id="studio-email" steps={STUDIO_EMAIL_TOUR} user={user} autoStart={false} />}
    </DashShell>
  );
};

export default StudioApp;
