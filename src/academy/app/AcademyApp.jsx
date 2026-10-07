import React, { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  Home, BookOpen, CalendarDays, ClipboardCheck, MessageCircle, Target, Upload, Library, CreditCard, Heart,
  LayoutDashboard, Users, PhoneCall, Megaphone, Send, GraduationCap, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRoles } from '../../lib/roles';
import { CONTACT_EMAIL } from '../../lib/academy';
import { PROGRAMS } from '../content';
import DashShell, { DashEmpty } from '../../apps/DashShell';
import { AcademyContext } from './data';
import {
  StudentHome, StudentLearn, StudentLesson, StudentSessions, StudentPlans, StudentGoals, StudentWork, StudentJournal,
  StudentLibrary, StudentMessages, StudentBilling,
} from './student';
import {
  MentorOverview, MentorStudents, MentorStudent, MentorCalls, MentorInvites, MentorCurriculum, MentorAnnouncements, MentorSessions,
} from './mentor';
import mark from '../../assets/academy/collective-mark.png';

const NAMES = { business: 'Business Mentorship', faith: 'Faith Mentorship' };

const studentNav = (slug) => (slug === 'business' ? [
  { to: `/academy/${slug}`, label: 'Home', Icon: Home, end: true },
  { to: `/academy/${slug}/learn`, label: 'Lessons', Icon: BookOpen },
  { to: `/academy/${slug}/plans`, label: 'Action plans', Icon: ClipboardCheck },
  { to: `/academy/${slug}/messages`, label: 'Member line', Icon: MessageCircle },
  { to: `/academy/${slug}/sessions`, label: 'Sessions', Icon: CalendarDays },
  { to: `/academy/${slug}/goals`, label: 'Goals', Icon: Target },
  { to: `/academy/${slug}/work`, label: 'Submit work', Icon: Upload },
  { to: `/academy/${slug}/library`, label: 'Library', Icon: Library },
  { to: `/academy/${slug}/billing`, label: 'Billing', Icon: CreditCard },
] : [
  { to: `/academy/${slug}`, label: 'Home', Icon: Home, end: true },
  { to: `/academy/${slug}/learn`, label: 'Lessons', Icon: BookOpen },
  { to: `/academy/${slug}/journal`, label: 'Journal', Icon: Heart },
  { to: `/academy/${slug}/messages`, label: 'Mentor', Icon: MessageCircle },
  { to: `/academy/${slug}/sessions`, label: 'Sessions', Icon: CalendarDays },
  { to: `/academy/${slug}/library`, label: 'Library', Icon: Library },
  { to: `/academy/${slug}/billing`, label: 'Billing', Icon: CreditCard },
]);

const mentorNav = (slug, newCalls) => [
  { to: `/academy/${slug}/teach`, label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: `/academy/${slug}/teach/students`, label: 'Students', Icon: Users },
  { to: `/academy/${slug}/teach/calls`, label: 'Intro calls', Icon: PhoneCall, badge: newCalls },
  { to: `/academy/${slug}/teach/curriculum`, label: 'Curriculum', Icon: BookOpen },
  { to: `/academy/${slug}/teach/sessions`, label: 'Sessions', Icon: CalendarDays },
  { to: `/academy/${slug}/teach/announcements`, label: 'Announcements', Icon: Megaphone },
  { to: `/academy/${slug}/teach/invites`, label: 'Invites', Icon: Send },
  { to: `/academy/${slug}`, label: 'Student view', Icon: GraduationCap, end: true },
];

const NoAccess = ({ entry, slug }) => (
  <div className="lg k-dark" style={{ display: 'grid', placeItems: 'center' }}>
    <div className="lg__card" style={{ textAlign: 'center', justifyItems: 'center' }}>
      <span className="lg__badge"><Lock size={22} /></span>
      <h1 className="k-h2 lg__title">{entry ? <>Your access has <em>paused</em></> : <>This classroom is <em>private</em></>}</h1>
      <p className="lg__sub">{entry
        ? 'Your membership isn’t active right now. Update your billing or reach out and we’ll help you continue.'
        : 'Classrooms open after an intro call and enrollment. If you’ve already enrolled, sign in with the email you used.'}</p>
      <div className="k-actions" style={{ justifyContent: 'center' }}>
        {entry ? <a className="k-btn k-btn--gold" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('My mentorship access')}`}>Email {CONTACT_EMAIL}</a>
          : <Link className="k-btn k-btn--gold" to={`/mentorship/${slug}`}>About this mentorship</Link>}
        <Link className="k-btn k-btn--ghost" to="/portal?choose">My dashboards</Link>
      </div>
    </div>
  </div>
);

const AcademyApp = () => {
  const { program: slug } = useParams();
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { status, roles, user } = useRoles();
  const [program, setProgram] = useState({ id: null, slug, title: NAMES[slug] || 'Mentorship' });
  const [newCalls, setNewCalls] = useState(0);
  const teach = /\/teach(\/|$)/.test(pathname);
  const isMentor = !!(roles.admin || roles.mentor?.includes(slug));
  const entry = roles.student?.find((s) => s.program === slug);

  useEffect(() => {
    if (!PROGRAMS[slug] || roles.preview) return;
    supabase.from('academy_programs').select('id, slug, title').eq('slug', slug).maybeSingle()
      .then(({ data }) => data && setProgram(data));
  }, [slug, roles.preview]);

  useEffect(() => {
    if (!isMentor || !program.id) return;
    supabase.from('academy_inquiries').select('id', { count: 'exact', head: true }).eq('program_id', program.id).eq('status', 'new')
      .then(({ count }) => setNewCalls(count || 0));
  }, [isMentor, program.id, pathname]);

  if (!PROGRAMS[slug]) return <Navigate to="/portal?choose" replace />;
  if (status === 'loading') return <div className="ds" aria-busy="true" />;
  if (status === 'signed-out') return <Navigate to={`/portal?next=${encodeURIComponent(pathname)}`} replace />;
  if (teach && !isMentor) return <Navigate to={`/academy/${slug}`} replace />;
  if (!teach && !isMentor && !entry?.has_access) return <NoAccess entry={entry} slug={slug} />;

  const nav = teach ? mentorNav(slug, newCalls) : studentNav(slug);
  const banner = roles.preview
    ? <div className="ds-banner">Layout preview (development only) — no data is loaded.</div>
    : !teach && isMentor && !entry ? <div className="ds-banner"><GraduationCap size={18} /> You’re viewing the student classroom. <Link to={`/academy/${slug}/teach`} className="k-link">Back to mentor console</Link></div>
    : null;

  return (
    <AcademyContext.Provider value={{ program, user, isMentor, isAdmin: !!roles.admin, preview: !!roles.preview }}>
      <DashShell
        theme="light"
        brand={{ to: teach ? `/academy/${slug}/teach` : `/academy/${slug}`, mark, title: 'P31 Collective', subtitle: `${NAMES[slug]}${teach ? ' · Mentor' : ''}` }}
        nav={nav}
        account={{ name: user?.user_metadata?.full_name || user?.email || (roles.preview ? 'Preview' : ''), role: teach ? 'Mentor' : 'Member' }}
        onSignOut={signOut}
        banner={banner}
      >
        <Routes>
          <Route index element={<StudentHome />} />
          <Route path="learn" element={<StudentLearn />} />
          <Route path="learn/:lessonId" element={<StudentLesson />} />
          <Route path="sessions" element={<StudentSessions />} />
          <Route path="messages" element={<StudentMessages />} />
          <Route path="library" element={<StudentLibrary />} />
          <Route path="billing" element={<StudentBilling />} />
          {slug === 'business' && <Route path="plans" element={<StudentPlans />} />}
          {slug === 'business' && <Route path="goals" element={<StudentGoals />} />}
          {slug === 'business' && <Route path="work" element={<StudentWork />} />}
          {slug === 'faith' && <Route path="journal" element={<StudentJournal />} />}
          <Route path="teach" element={<MentorOverview />} />
          <Route path="teach/students" element={<MentorStudents />} />
          <Route path="teach/students/:userId" element={<MentorStudent />} />
          <Route path="teach/calls" element={<MentorCalls />} />
          <Route path="teach/invites" element={<MentorInvites />} />
          <Route path="teach/curriculum" element={<MentorCurriculum />} />
          <Route path="teach/announcements" element={<MentorAnnouncements />} />
          <Route path="teach/sessions" element={<MentorSessions />} />
          <Route path="*" element={<DashEmpty Icon={BookOpen} title="Page not found" action={<Link to={`/academy/${slug}`} className="k-btn k-btn--ghost">Back to your classroom</Link>} />} />
        </Routes>
      </DashShell>
    </AcademyContext.Provider>
  );
};

export default AcademyApp;
