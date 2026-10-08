import React, { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  Home, BookOpen, CalendarDays, ClipboardCheck, MessageCircle, Target, Upload, Library, CreditCard, Heart,
  LayoutDashboard, Users, PhoneCall, Megaphone, Send, GraduationCap, Lock, Inbox, ClipboardList, BarChart3, HelpCircle,
  MessagesSquare, Award, TrendingUp,
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
import { MentorInbox, MentorAssignments, MentorGradebook, MentorQuizzes, MentorCompletion } from './teach';
import { StudentAssignments, StudentAssignment, StudentQuizzes, StudentQuiz, StudentProgress } from './learn';
import { Discussions, DiscussionThread, CertificateView, NotificationBell, InstallApp } from './shared';
import LiveRoom from './LiveRoom';
import mark from '../../assets/academy/collective-mark.png';
import './classroom.css';

const NAMES = { business: 'Business Mentorship', faith: 'Faith Mentorship' };

const studentNav = (slug) => {
  const base = `/academy/${slug}`;
  const core = [
    { to: base, label: 'Home', Icon: Home, end: true },
    { to: `${base}/learn`, label: 'Lessons', Icon: BookOpen },
    { to: `${base}/assignments`, label: 'Assignments', Icon: ClipboardList },
    { to: `${base}/messages`, label: slug === 'business' ? 'Member line' : 'Mentor', Icon: MessageCircle },
    { to: `${base}/sessions`, label: 'Sessions', Icon: CalendarDays },
    { to: `${base}/quizzes`, label: 'Quizzes', Icon: HelpCircle },
    { to: `${base}/discussions`, label: 'Discussions', Icon: MessagesSquare },
    { to: `${base}/progress`, label: 'Progress', Icon: TrendingUp },
  ];
  const extra = slug === 'business' ? [
    { to: `${base}/plans`, label: 'Action plans', Icon: ClipboardCheck },
    { to: `${base}/goals`, label: 'Goals', Icon: Target },
    { to: `${base}/work`, label: 'Submit work', Icon: Upload },
  ] : [
    { to: `${base}/journal`, label: 'Journal', Icon: Heart },
  ];
  return [...core, ...extra,
    { to: `${base}/library`, label: 'Library', Icon: Library },
    { to: `${base}/billing`, label: 'Billing', Icon: CreditCard }];
};

const mentorNav = (slug, counts) => {
  const t = `/academy/${slug}/teach`;
  return [
    { to: t, label: 'Overview', Icon: LayoutDashboard, end: true },
    { to: `${t}/inbox`, label: 'Inbox', Icon: Inbox, badge: counts.unread },
    { to: `${t}/students`, label: 'Students', Icon: Users },
    { to: `${t}/gradebook`, label: 'Gradebook', Icon: BarChart3, badge: counts.toGrade },
    { to: `${t}/assignments`, label: 'Assignments', Icon: ClipboardList },
    { to: `${t}/quizzes`, label: 'Quizzes', Icon: HelpCircle },
    { to: `${t}/curriculum`, label: 'Curriculum', Icon: BookOpen },
    { to: `${t}/discussions`, label: 'Discussions', Icon: MessagesSquare },
    { to: `${t}/sessions`, label: 'Sessions', Icon: CalendarDays },
    { to: `${t}/completion`, label: 'Completion', Icon: Award },
    { to: `${t}/announcements`, label: 'Announcements', Icon: Megaphone },
    { to: `${t}/calls`, label: 'Intro calls', Icon: PhoneCall, badge: counts.newCalls },
    { to: `${t}/invites`, label: 'Invites', Icon: Send },
    { to: `/academy/${slug}`, label: 'Student view', Icon: GraduationCap, end: true },
  ];
};

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
  const [counts, setCounts] = useState({ newCalls: 0, unread: 0, toGrade: 0 });
  const teach = /\/teach(\/|$)/.test(pathname);
  const isMentor = !!(roles.admin || roles.mentor?.includes(slug));
  const entry = roles.student?.find((s) => s.program === slug);

  useEffect(() => {
    if (!PROGRAMS[slug] || roles.preview) return;
    supabase.from('academy_programs').select('id, slug, title').eq('slug', slug).maybeSingle()
      .then(({ data }) => data && setProgram(data));
  }, [slug, roles.preview]);

  // Badges for the mentor menu: new intro calls, unread messages, work to grade.
  useEffect(() => {
    if (!isMentor || !program.id) return;
    Promise.all([
      supabase.from('academy_inquiries').select('id', { count: 'exact', head: true }).eq('program_id', program.id).eq('status', 'new'),
      supabase.rpc('academy_awaiting_review', { p_program: program.id }),
      supabase.rpc('academy_inbox', { p_program: program.id }),
    ]).then(([calls, review, inbox]) => setCounts({
      newCalls: calls.count || 0,
      unread: (inbox.data || []).reduce((n, t) => n + (t.unread || 0), 0),
      toGrade: review.data || 0,
    }));
  }, [isMentor, program.id, pathname]);

  if (!PROGRAMS[slug]) return <Navigate to="/portal?choose" replace />;
  if (status === 'loading') return <div className="ds" aria-busy="true" />;
  if (status === 'signed-out') return <Navigate to={`/portal?next=${encodeURIComponent(pathname)}`} replace />;
  if (teach && !isMentor) return <Navigate to={`/academy/${slug}`} replace />;
  if (!teach && !isMentor && !entry?.has_access) return <NoAccess entry={entry} slug={slug} />;

  const nav = teach ? mentorNav(slug, counts) : studentNav(slug);
  const banner = roles.preview
    ? <div className="ds-banner">Layout preview (development only) — no data is loaded.</div>
    : !teach && isMentor && !entry ? <div className="ds-banner"><GraduationCap size={18} /> You’re viewing the student classroom. <Link to={`/academy/${slug}/teach`} className="k-link">Back to mentor console</Link></div>
    : null;

  return (
    <AcademyContext.Provider value={{ program, user, isMentor, isAdmin: !!roles.admin, preview: !!roles.preview }}>
      <DashShell
        theme="light"
        variant={slug}
        tools={<><InstallApp />{!roles.preview && <NotificationBell userId={user?.id} />}</>}
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
          <Route path="assignments" element={<StudentAssignments />} />
          <Route path="assignments/:assignmentId" element={<StudentAssignment />} />
          <Route path="quizzes" element={<StudentQuizzes />} />
          <Route path="quizzes/:quizId" element={<StudentQuiz />} />
          <Route path="discussions" element={<Discussions />} />
          <Route path="discussions/:threadId" element={<DiscussionThread />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="certificate/:certId" element={<CertificateView />} />
          <Route path="live/:sessionId" element={<LiveRoom />} />
          <Route path="teach" element={<MentorOverview />} />
          <Route path="teach/students" element={<MentorStudents />} />
          <Route path="teach/students/:userId" element={<MentorStudent />} />
          <Route path="teach/calls" element={<MentorCalls />} />
          <Route path="teach/invites" element={<MentorInvites />} />
          <Route path="teach/curriculum" element={<MentorCurriculum />} />
          <Route path="teach/announcements" element={<MentorAnnouncements />} />
          <Route path="teach/sessions" element={<MentorSessions />} />
          <Route path="teach/inbox" element={<MentorInbox />} />
          <Route path="teach/inbox/:studentId" element={<MentorInbox />} />
          <Route path="teach/assignments" element={<MentorAssignments />} />
          <Route path="teach/gradebook" element={<MentorGradebook />} />
          <Route path="teach/quizzes" element={<MentorQuizzes />} />
          <Route path="teach/completion" element={<MentorCompletion />} />
          <Route path="teach/discussions" element={<Discussions />} />
          <Route path="teach/discussions/:threadId" element={<DiscussionThread />} />
          <Route path="*" element={<DashEmpty Icon={BookOpen} title="Page not found" action={<Link to={`/academy/${slug}`} className="k-btn k-btn--ghost">Back to your classroom</Link>} />} />
        </Routes>
      </DashShell>
    </AcademyContext.Provider>
  );
};

export default AcademyApp;
