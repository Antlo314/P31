import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Sun, Video, ArrowRight, Presentation, Clapperboard, ShieldCheck, LayoutDashboard, Megaphone, Mail, CalendarDays, Film, Scissors, Store, MessagesSquare, Compass,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRoles, dashboardsFor, isTeam, hasTool } from '../lib/roles';
import { dashboardsOf, systemsPagesFor } from '../lib/dashboards';
import { useIsPhone } from '../lib/device';
import { DAVINCI_ON } from '../lib/features';
import { mentorCards, systemsCards, teamCards, studioCards, davinciCards } from './cards';
import AttentionCard, { Go } from './AttentionCard';
import TodaysWord from './TodaysWord';
import DashShell, { DashHead } from '../apps/DashShell';
import Tour, { TourButton } from '../components/Tour';
import mark from '../assets/academy/collective-mark.webp';
import './today.css';

const ICON = { mentor: Presentation, studio: Clapperboard, systems: ShieldCheck, curator: Store, davinci: Film, gather: MessagesSquare };
const PROGRAM = { business: 'Business Mentorship', faith: 'Faith-Based Mentorship' };

const TODAY_TOUR = [
  { title: 'Today: your home', body: 'One page that gathers every dashboard you run and shows what needs you. A one-minute tour.' },
  { targets: ['.td2-group'], title: 'What needs you, by dashboard', body: 'Each section is one of your dashboards: the cards count what is waiting (orders, applications, work to grade, emails…) and open straight to it.' },
  { targets: ['.td2-quick'], title: 'Quick actions', body: 'The things you reach for most: go live, write a post, add a market date, email a campaign.' },
  { targets: ['.tw', '.td2-word', '.ds-main article'], title: 'The Daily Word', body: 'This morning’s verse from The Gathering, with its discussion one tap away.' },
  { targets: ['.ds-nav', '.ds-tabs'], title: 'Your dashboards', body: 'Every dashboard you have is in the menu, with Walkthroughs to learn any of them in a minute.' },
];

// Which dashboards report in, in the order they're shown.
const sourcesFor = (roles) => {
  const pages = systemsPagesFor(dashboardsOf(roles));
  return [
    ...(roles.mentor || []).map((slug) => ({ key: `mentor-${slug}`, title: PROGRAM[slug] || slug, to: `/academy/${slug}/teach`, load: () => mentorCards(slug) })),
    ...(roles.operator || roles.admin ? [{ key: 'systems', title: 'Systems', to: '/systems', load: systemsCards, sites: true }]
      : pages.length ? [{ key: 'systems', title: 'Systems', to: '/systems', load: () => teamCards(pages), sites: true }] : []),
    ...(roles.studio ? [{ key: 'studio', title: 'Content Studio', to: '/studio', load: studioCards }] : []),
    ...(DAVINCI_ON && hasTool(roles, 'davinci') ? [{ key: 'davinci', title: 'DaVinci', to: '/systems/pro-edit', load: davinciCards }] : []),
  ];
};

// ── /today — the team's home ──────────────────────────────────
const Today = () => {
  const { signOut } = useAuth();
  const { status, roles, user } = useRoles();
  const phone = useIsPhone();
  const [cards, setCards] = useState({});
  const team = status === 'ready' && isTeam(roles);
  const sources = useMemo(() => (team ? sourcesFor(roles) : []), [team, roles]);

  useEffect(() => {
    let live = true;
    sources.forEach((s) => s.load()
      .catch(() => [])
      .then((list) => { if (live) setCards((c) => ({ ...c, [s.key]: list })); }));
    return () => { live = false; };
  }, [sources]);

  if (status === 'loading') return <div className="ds ds--light" aria-busy="true" style={{ minHeight: '100dvh' }} />;
  if (status === 'signed-out') return <Navigate to="/portal?next=%2Ftoday" replace />;
  if (!team) return <Navigate to="/portal" replace />;

  const loaded = sources.filter((s) => cards[s.key]);
  const pending = sources.length - loaded.length;
  const total = loaded.reduce((n, s) => n + cards[s.key].reduce((m, c) => m + (c.count || 0), 0), 0);
  const name = (user?.user_metadata?.full_name || '').trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const admin = roles.operator || roles.admin;

  const nav = [
    { to: '/today', label: 'Today', Icon: Sun, end: true },
    ...dashboardsFor(roles).filter((d) => d.kind !== 'student').map((d) => ({
      to: d.to, label: d.kind === 'mentor' ? `${(PROGRAM[d.program] || d.title).replace(' Mentorship', '')} console` : d.title, Icon: ICON[d.kind] || LayoutDashboard,
      short: d.kind === 'mentor' ? (d.program === 'faith' ? 'Faith' : 'Business') : d.kind === 'studio' ? 'Studio' : d.kind === 'curator' ? 'My shop' : d.title,
    })),
    { to: '/systems/walkthroughs', label: 'Walkthroughs', Icon: Compass, short: 'Learn' },
  ];
  // Quick actions; the ones that need a computer stay off phones.
  const quick = [
    ...(roles.mentor || []).slice(0, 1).map((slug) => ({ to: `/academy/${slug}/teach/sessions`, Icon: Video, label: 'Go live' })),
    roles.studio && { to: '/studio/compose', Icon: Megaphone, label: 'New post' },
    DAVINCI_ON && hasTool(roles, 'davinci') && { to: '/systems/pro-edit', Icon: Scissors, label: 'Find clips', desktop: true },
    admin && { to: '/systems/campaigns', Icon: Mail, label: 'Email campaign' },
    admin && { to: '/systems/events', Icon: CalendarDays, label: 'Add a market date' },
    admin && { to: '/systems/clips', Icon: Clapperboard, label: 'Make a clip', desktop: true },
  ].filter((q) => q && !(phone && q.desktop));

  return (
    <DashShell
      theme="light"
      brand={{ to: '/today', mark, title: 'P31 Collective', subtitle: 'Today' }}
      nav={nav}
      account={{ name: user?.user_metadata?.full_name || user?.email || '', role: roles.admin ? 'Admin' : admin ? 'Operator' : 'Team' }}
      onSignOut={signOut}
      tools={<TourButton id="today" />}
    >
      <DashHead
        eyebrow={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        title={`${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${name ? ',' : '.'}`}
        accent={name ? `${name}.` : null}
        lead={pending && !loaded.length ? 'Gathering what needs you…'
          : total ? `${total} thing${total === 1 ? '' : 's'} could use your attention across your dashboards.`
            : pending ? 'Still checking a few places…' : 'Everything’s handled. Enjoy the quiet.'}
      />

      <TodaysWord />

      {quick.length > 0 && (
        <div className="td2-quick" role="group" aria-label="Quick actions">
          {quick.map((q) => <Go key={q.label} to={q.to} className="td2-quick__btn"><q.Icon size={16} /> {q.label}</Go>)}
        </div>
      )}

      {sources.map((s) => (
        <section key={s.key} className="td2-group" aria-labelledby={`td2-${s.key}`}>
          <div className="td2-group__head">
            <h2 id={`td2-${s.key}`} className="td2-group__title">{s.title}</h2>
            <Go to={s.to} className="td2-group__open">Open <ArrowRight size={13} /></Go>
          </div>
          <div className="td2-grid">
            {cards[s.key]
              ? [...cards[s.key]].sort((a, b) => (b.count > 0) - (a.count > 0)).map((c) => <AttentionCard key={c.key} card={c} showSite={!!s.sites} />)
              : [0, 1].map((i) => <div key={i} className="td2-card" aria-hidden="true"><div className="td2-skel" /></div>)}
          </div>
        </section>
      ))}
      <Tour id="today" steps={TODAY_TOUR} user={user} autoStart={false} />
    </DashShell>
  );
};

export default Today;
