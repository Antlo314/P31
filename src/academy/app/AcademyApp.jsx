import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  Home, BookOpen, CalendarDays, ClipboardCheck, MessageCircle, Target, Upload, Library, CreditCard, Heart,
  LayoutDashboard, Users, PhoneCall, Megaphone, Send, GraduationCap, Lock, Inbox, ClipboardList, BarChart3, HelpCircle,
  MessagesSquare, Award, TrendingUp, Sparkles,
  FileCheck2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRoles } from '../../lib/roles';
import { CONTACT_EMAIL } from '../../lib/academy';
import { PROGRAMS as PUBLIC_PAGES } from '../content';
import { isProgram, programName, hasFeature } from '../../lib/programs';
import DashShell, { DashEmpty } from '../../apps/DashShell';
import { AcademyContext } from './data';
import {
  StudentHome, StudentLearn, StudentLesson, StudentSessions, StudentPlans, StudentGoals, StudentWork, StudentJournal,
  StudentLibrary, StudentMessages, StudentBilling,
} from './student';
import {
  MentorOverview, MentorStudents, MentorStudent, MentorCalls, MentorInvites, MentorAgreements, MentorCurriculum, MentorAnnouncements, MentorSessions,
} from './mentor';
import { MentorInbox, MentorAssignments, MentorGradebook, MentorQuizzes, MentorCompletion } from './teach';
import { StudentAssignments, StudentAssignment, StudentQuizzes, StudentQuiz, StudentProgress } from './learn';
import { Discussions, DiscussionThread, CertificateView, NotificationBell, InstallApp } from './shared';
import LiveRoom from './LiveRoom';
import { readViewAs, stopViewAs } from './viewAs';
import StudentPreview from './StudentPreview';
import { framePreviewWho, installPreviewGuard } from './previewMode';
import './preview.css';
import mark from '../../assets/academy/collective-mark.webp';
import Tour, { TourButton } from '../../components/Tour';
import { CLASSROOM_TOURS, MENTOR_TOURS } from './classroomTour';
import './classroom.css';

// The menu and the routes both come from the program's features (src/lib/programs.js).
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
  const goals = hasFeature(slug, 'goals');
  const extra = [
    { to: `${base}/plans`, label: goals ? 'Action plans' : 'My tasks', Icon: ClipboardCheck },
    goals && { to: `${base}/goals`, label: 'Goals', Icon: Target },
    hasFeature(slug, 'work') && { to: `${base}/work`, label: 'Submit work', Icon: Upload },
    hasFeature(slug, 'journal') && { to: `${base}/journal`, label: 'Journal', Icon: Heart },
  ].filter(Boolean);
  return [...core, ...extra,
    { to: `${base}/library`, label: 'Library', Icon: Library },
    { to: `${base}/billing`, label: 'Billing', Icon: CreditCard },
    { to: '/gather', label: 'The Gathering', Icon: Sparkles }];
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
    { to: `${t}/agreements`, label: 'Agreements', Icon: FileCheck2 },
    { to: `${t}/invites`, label: 'Invites', Icon: Send },
    { to: `/academy/${slug}`, label: 'Student view', Icon: GraduationCap, end: true },
    { to: '/gather', label: 'The Gathering', Icon: Sparkles },
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
          : PUBLIC_PAGES[slug] && <Link className="k-btn k-btn--gold" to={`/mentorship/${slug}`}>About this mentorship</Link>}
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
  // The program's database row (academy_programs, by slug). A program listed in src/lib/programs.js
  // opens at once and fills in its id when the row arrives; any other slug waits for its row.
  const [found, setFound] = useState({ slug: null, row: null, failed: false });
  const looked = found.slug === slug;
  const listed = isProgram(slug);
  const program = useMemo(() => (!roles.preview && looked && found.row) || { id: null, slug, title: programName(slug, 'Mentorship') }, [roles.preview, looked, found.row, slug]);
  // A listed program whose row isn't in the database yet: the console opens, but nothing can be saved.
  const unset = listed && looked && !found.row && !found.failed && !roles.preview;
  const [counts, setCounts] = useState({ newCalls: 0, unread: 0, toGrade: 0 });
  const teach = /\/teach(\/|$)/.test(pathname);
  const isMentor = !!(roles.admin || roles.mentor?.includes(slug));
  const entry = roles.student?.find((s) => s.program === slug);
  // Inside the mentor console's preview frame: the classroom as a new student, or as one student.
  const [frameWho] = useState(framePreviewWho);
  const previewing = !teach && isMentor && !!frameWho;
  const [frameStudent, setFrameStudent] = useState(null);
  const [blockedAt, setBlockedAt] = useState(0);
  const readOnly = previewing || (!teach && isMentor && !!readViewAs(slug));

  useEffect(() => {
    if (!previewing || frameWho === 'new' || !program.id) return;
    supabase.rpc('academy_roster', { p_program: program.id }).then(({ data }) => {
      const s = (data || []).find((r) => r.user_id === frameWho);
      if (s) setFrameStudent({ id: s.user_id, name: s.full_name || s.email, email: s.email });
    });
  }, [previewing, frameWho, program.id]);

  // Previews and "See their dashboard" never change anything (not as the student, not as the mentor).
  useEffect(() => (readOnly ? installPreviewGuard(() => setBlockedAt(Date.now())) : undefined), [readOnly]);

  useEffect(() => {
    if (roles.preview || !/^[a-z0-9-]+$/.test(slug || '')) return undefined;
    let live = true;
    supabase.from('academy_programs').select('id, slug, title').eq('slug', slug).maybeSingle()
      .then(({ data, error }) => live && setFound({ slug, row: data || null, failed: !!error }));
    return () => { live = false; };
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

  // Unknown slugs go back to the portal: not listed, and no database row (dev previews load none).
  if (!listed && (roles.preview || !/^[a-z0-9-]+$/.test(slug || '') || (looked && !found.row))) return <Navigate to="/portal?choose" replace />;
  if (!listed && !looked) return <div className="ds" aria-busy="true" />;
  if (status === 'loading') return <div className="ds" aria-busy="true" />;
  if (status === 'signed-out') return <Navigate to={`/portal?next=${encodeURIComponent(pathname)}`} replace />;
  if (teach && !isMentor) return <Navigate to={`/academy/${slug}`} replace />;
  if (!teach && !isMentor && !entry?.has_access) return <NoAccess entry={entry} slug={slug} />;

  // "See their dashboard": a mentor viewing the student classroom as one student (read-only).
  const viewAs = previewing ? frameStudent : !teach && isMentor ? readViewAs(slug) : null;
  const nav = teach ? mentorNav(slug, counts) : studentNav(slug);
  // Students (not mentors looking in, and never inside a preview) get the first-visit walkthrough.
  // A ?tour= link (from Systems → Walkthroughs) plays it for mentors looking in too.
  const tourLink = new URLSearchParams(window.location.search).get('tour');
  const studentTour = (!teach && !isMentor && !readOnly && !viewAs && !roles.preview && !!entry?.has_access) || (!teach && isMentor && !previewing && tourLink === `classroom-${slug}`);
  const mentorTour = teach && isMentor && !roles.preview;
  const banner = roles.preview
    ? <div className="ds-banner">Layout preview (development only) — no data is loaded.</div>
    : previewing ? <div className="ds-banner"><GraduationCap size={18} /> <span>Student preview: {frameWho === 'new' ? <>what <strong>a new student</strong> sees</> : <><strong>{frameStudent?.name || 'student'}</strong>’s classroom</>}. Actions are turned off.</span></div>
    : viewAs ? <div className="ds-banner"><GraduationCap size={18} /> You’re seeing <strong>{viewAs.name}</strong>’s dashboard, exactly as they see it (read-only).
        <button className="k-link" style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => stopViewAs(slug, `/academy/${slug}/teach/students/${viewAs.id}`)}>Exit</button></div>
    : unset && isMentor ? <div className="ds-banner"><Lock size={18} /> {program.title} isn’t set up in the database yet, so nothing here can be saved. It opens fully once its database update has run.</div>
    : !teach && isMentor && !entry ? <div className="ds-banner"><GraduationCap size={18} /> You’re viewing the student classroom. <Link to={`/academy/${slug}/teach`} className="k-link">Back to mentor console</Link></div>
    : null;
  const classroomSteps = listed ? CLASSROOM_TOURS[slug] : null;
  const mentorSteps = listed ? MENTOR_TOURS[slug] : null;

  return (
    <AcademyContext.Provider value={{
      program, isMentor: previewing ? false : isMentor, isAdmin: previewing ? false : !!roles.admin, preview: !!roles.preview, viewAs: !!viewAs || previewing,
      user: viewAs ? { id: viewAs.id, email: viewAs.email, user_metadata: { full_name: viewAs.name } } : user,
    }}>
      <DashShell
        theme="light"
        variant={slug}
        tools={<>{teach && isMentor && <StudentPreview />}{studentTour && classroomSteps && <TourButton id={`classroom-${slug}`} />}{mentorTour && mentorSteps && <TourButton id={`mentor-${slug}`} />}<InstallApp />{!roles.preview && !previewing && <NotificationBell userId={user?.id} />}</>}
        brand={{ to: teach ? `/academy/${slug}/teach` : `/academy/${slug}`, mark, title: 'P31 Collective', subtitle: `${program.title}${teach ? ' · Mentor' : ''}` }}
        nav={nav}
        account={{ name: previewing ? (frameStudent?.name || 'New student') : user?.user_metadata?.full_name || user?.email || (roles.preview ? 'Preview' : ''), role: teach ? 'Mentor' : 'Member' }}
        onSignOut={signOut}
        banner={banner}
      >
        {blockedAt > 0 && <div key={blockedAt} className="sp-toast" role="status">Preview only: students can do this in their own classroom.</div>}
        <Routes>
          <Route index element={<StudentHome />} />
          <Route path="learn" element={<StudentLearn />} />
          <Route path="learn/:lessonId" element={<StudentLesson />} />
          <Route path="sessions" element={<StudentSessions />} />
          <Route path="messages" element={<StudentMessages />} />
          <Route path="library" element={<StudentLibrary />} />
          <Route path="billing" element={<StudentBilling />} />
          <Route path="plans" element={<StudentPlans />} />
          {hasFeature(slug, 'goals') && <Route path="goals" element={<StudentGoals />} />}
          {hasFeature(slug, 'work') && <Route path="work" element={<StudentWork />} />}
          {hasFeature(slug, 'journal') && <Route path="journal" element={<StudentJournal />} />}
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
          <Route path="teach/agreements" element={<MentorAgreements />} />
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
        {/* Each program has its own walkthrough; a program without one gets none, never another program's paths. */}
        {studentTour && classroomSteps && <Tour id={`classroom-${slug}`} steps={classroomSteps} user={user} autoStart={!isMentor} />}
        {mentorTour && mentorSteps && <Tour id={`mentor-${slug}`} steps={mentorSteps} user={user} autoStart={false} />}
      </DashShell>
    </AcademyContext.Provider>
  );
};

export default AcademyApp;
