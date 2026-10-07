import React from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarClock, PenSquare, MessagesSquare, MessageCircle, Clapperboard, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRoles } from '../lib/roles';
import DashShell from '../apps/DashShell';
import { StudioOverview, StudioCalendar, StudioCompose, StudioInbox, StudioComments, StudioCreate } from './pages';
import logo from '../assets/web/logo-160.webp';
import '../pages/Login.css';
import './studio.css';

const NAV = [
  { to: '/studio', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/studio/calendar', label: 'Calendar', Icon: CalendarClock },
  { to: '/studio/compose', label: 'Create post', Icon: PenSquare },
  { to: '/studio/inbox', label: 'Messages', Icon: MessagesSquare },
  { to: '/studio/comments', label: 'Comments', Icon: MessageCircle },
  { to: '/studio/create', label: 'Creative tools', Icon: Clapperboard },
];

// /studio — the 3-seat Content Studio, connected to Zernio.
const StudioApp = () => {
  const { signOut } = useAuth();
  const { status, roles, user } = useRoles();
  const { pathname } = useLocation();

  if (status === 'loading') return <div className="ds ds--dark" aria-busy="true" />;
  if (status === 'signed-out') return <Navigate to={`/portal?next=${encodeURIComponent(pathname)}`} replace />;
  if (!roles.studio && !roles.admin) {
    return (
      <div className="lg k-dark" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="lg__card" style={{ textAlign: 'center', justifyItems: 'center' }}>
          <span className="lg__badge"><Lock size={22} /></span>
          <h1 className="k-h2 lg__title">Studio seats are <em>limited</em></h1>
          <p className="lg__sub">This account doesn’t have one of the three Content Studio seats. An admin can add you from Systems → Academy.</p>
          <Link className="k-btn k-btn--ghost" to="/portal?choose">My dashboards</Link>
        </div>
      </div>
    );
  }

  return (
    <DashShell
      theme="dark"
      brand={{ to: '/studio', mark: logo, title: 'Content Studio', subtitle: 'P31 Marketplace' }}
      nav={NAV}
      account={{ name: user?.user_metadata?.full_name || user?.email || (roles.preview ? 'Preview' : ''), role: roles.admin ? 'Admin' : 'Studio seat' }}
      onSignOut={signOut}
      banner={roles.preview ? <div className="ds-banner">Layout preview (development only) — Zernio calls need a real Studio sign-in.</div> : null}
    >
      <Routes>
        <Route index element={<StudioOverview />} />
        <Route path="calendar" element={<StudioCalendar />} />
        <Route path="compose" element={<StudioCompose />} />
        <Route path="inbox" element={<StudioInbox />} />
        <Route path="comments" element={<StudioComments />} />
        <Route path="create" element={<StudioCreate />} />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Routes>
    </DashShell>
  );
};

export default StudioApp;
