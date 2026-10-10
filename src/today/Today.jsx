import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Sun, ClipboardCheck, MessageCircle, PhoneCall, Video, UserPlus, Store, Receipt, Activity, Inbox, CalendarClock,
  ArrowRight, Presentation, Clapperboard, ShieldCheck, LayoutDashboard, Megaphone, Mail, CalendarDays, CheckCircle2, Film, Scissors,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRoles, dashboardsFor, isTeam, hasTool } from '../lib/roles';
import { hrefFor } from '../lib/site';
import { studio } from '../studio/api';
import DashShell, { DashHead } from '../apps/DashShell';
import mark from '../assets/academy/collective-mark.webp';
import './today.css';

const ICON = { mentor: Presentation, studio: Clapperboard, systems: ShieldCheck, curator: Store, davinci: Film };
const PROGRAM = { business: 'Business Mentorship', faith: 'Faith-Based Mentorship' };

const ago = (iso) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
const when = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 864e5);
  const day = d.toDateString() === today.toDateString() ? 'Today'
    : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

// A link inside this site, or a full link when the page lives on the marketplace side.
const Go = ({ to, className, children }) => {
  const href = hrefFor(to);
  return href === to ? <Link to={to} className={className}>{children}</Link> : <a href={href} className={className}>{children}</a>;
};

/** One "needs attention" card: a count, the first few items, and a way in. */
const Card = ({ card }) => {
  const { Icon, title, count, items = [], to, cta, empty, tone } = card;
  return (
    <article className={`td2-card ${count ? 'has-items' : ''} ${tone ? `td2-card--${tone}` : ''}`}>
      <header className="td2-card__head">
        <span className="td2-card__icon"><Icon size={18} /></span>
        <h3>{title}</h3>
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

// ── What needs attention, per dashboard ───────────────────────
// Each loader returns cards; a card whose data this person can't read is left out.
async function mentorCards(slug) {
  const { data: prog } = await supabase.from('academy_programs').select('id').eq('slug', slug).maybeSingle();
  if (!prog) return [];
  const base = `/academy/${slug}/teach`;
  const horizon = new Date(Date.now() + 864e5);
  horizon.setHours(23, 59, 59, 0);
  const [review, subs, roster, inbox, calls, sessions] = await Promise.all([
    supabase.rpc('academy_awaiting_review', { p_program: prog.id }),
    supabase.from('academy_submissions').select('id, title, student_id, created_at').eq('program_id', prog.id).eq('status', 'submitted').order('created_at').limit(4),
    supabase.rpc('academy_roster', { p_program: prog.id }),
    supabase.rpc('academy_inbox', { p_program: prog.id }),
    supabase.from('academy_inquiries').select('id, full_name, preferred_times, created_at').eq('program_id', prog.id).eq('status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('academy_sessions').select('id, title, starts_at, student_id').eq('program_id', prog.id)
      .gte('starts_at', new Date(Date.now() - 3600e3).toISOString()).lte('starts_at', horizon.toISOString()).order('starts_at').limit(4),
  ]);
  const names = Object.fromEntries((roster.data || []).map((r) => [r.user_id, r.full_name || r.email]));
  const unread = (inbox.data || []).filter((t) => t.unread > 0);
  return [
    !review.error && {
      key: 'grade', Icon: ClipboardCheck, title: 'Work to grade', count: review.data || 0, to: `${base}/gradebook`, cta: 'Open the gradebook', empty: 'Nothing waiting for feedback.',
      items: (subs.data || []).map((s) => ({ key: s.id, title: s.title, sub: `${names[s.student_id] || 'A student'} · handed in ${ago(s.created_at)}` })),
    },
    !inbox.error && {
      key: 'messages', Icon: MessageCircle, title: 'Student messages', count: unread.reduce((n, t) => n + t.unread, 0), to: `${base}/inbox`, cta: 'Open messages', empty: 'You’re all caught up.',
      items: unread.map((t) => ({ key: t.student_id, title: t.full_name || t.email, sub: t.last_body || 'New message', to: `${base}/inbox/${t.student_id}` })),
    },
    !calls.error && {
      key: 'calls', Icon: PhoneCall, title: 'New intro calls', count: (calls.data || []).length, to: `${base}/calls`, cta: 'All requests', empty: 'No new requests.',
      items: (calls.data || []).map((c) => ({ key: c.id, title: c.full_name, sub: `${c.preferred_times || 'No times given'} · ${ago(c.created_at)}` })),
    },
    !sessions.error && {
      key: 'live', Icon: Video, title: 'Classes today & tomorrow', count: (sessions.data || []).length, to: `${base}/sessions`, cta: 'Sessions & Go live', empty: 'Nothing scheduled. Go live anytime from Sessions.', tone: 'night',
      items: (sessions.data || []).map((s) => ({ key: s.id, title: s.title, sub: `${when(s.starts_at)} · ${s.student_id ? '1:1' : 'group class'}` })),
    },
  ].filter(Boolean);
}

async function systemsCards() {
  const [apps, curators, orders, errors] = await Promise.all([
    supabase.from('collective_applications').select('id, full_name, city_state, created_at', { count: 'exact' }).eq('status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('curator_data').select('id, business_name, created_at', { count: 'exact' }).eq('status', 'pending').order('created_at', { ascending: false }).limit(4),
    supabase.from('orders').select('id, product_name, buyer_name, created_at', { count: 'exact' }).eq('fulfillment_status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('app_errors').select('*', { count: 'exact' }).is('resolved_at', null).order('last_seen', { ascending: false }).limit(4),
  ]);
  return [
    !apps.error && {
      key: 'applications', Icon: UserPlus, title: 'Collective applications', count: apps.count ?? (apps.data || []).length, to: '/systems/applications', cta: 'Review applications', empty: 'No new applications.',
      items: (apps.data || []).map((a) => ({ key: a.id, title: a.full_name, sub: `${a.city_state} · ${ago(a.created_at)}` })),
    },
    !orders.error && {
      key: 'orders', Icon: Receipt, title: 'New orders', count: orders.count ?? (orders.data || []).length, to: '/systems/orders', cta: 'Open orders', empty: 'No new orders.',
      items: (orders.data || []).map((o) => ({ key: o.id, title: o.product_name || 'Order', sub: `${o.buyer_name || 'A shopper'} · ${ago(o.created_at)}` })),
    },
    !curators.error && {
      key: 'curators', Icon: Store, title: 'Curators to review', count: curators.count ?? (curators.data || []).length, to: '/dashboard', cta: 'Review on p31market.com', empty: 'No curator applications waiting.',
      items: (curators.data || []).map((c) => ({ key: c.id, title: c.business_name || 'New curator', sub: `Applied ${ago(c.created_at)}` })),
    },
    !errors.error && {
      key: 'errors', Icon: Activity, title: 'Site errors', count: errors.count ?? (errors.data || []).length, to: '/systems/health', cta: 'Open Health', empty: 'Both sites are running clean.', tone: 'alert',
      items: (errors.data || []).map((e) => ({ key: e.id, title: e.message, sub: `${e.path || 'unknown page'} · ${e.count}× · ${ago(e.last_seen)}` })),
    },
  ].filter(Boolean);
}

async function studioCards() {
  const [inbox, posts] = await Promise.allSettled([studio('inbox'), studio('posts')]);
  const out = [];
  if (inbox.status === 'fulfilled') {
    const unread = (inbox.value?.conversations || []).filter((c) => c.unread > 0);
    out.push({
      key: 'dms', Icon: Inbox, title: 'Unread DMs', count: unread.reduce((n, c) => n + c.unread, 0), to: '/studio/inbox', cta: 'Open messages', empty: 'No unread DMs.',
      items: unread.map((c) => ({ key: c.id, title: c.name || c.username || 'Someone', sub: `${c.platform} · ${c.last || 'New message'}` })),
    });
  }
  if (posts.status === 'fulfilled') {
    const until = Date.now() + 2 * 864e5;
    const next = (posts.value?.scheduled || []).filter((p) => p.scheduledFor && new Date(p.scheduledFor) <= until)
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    out.push({
      key: 'posts', Icon: CalendarClock, title: 'Posts going out', count: next.length, to: '/studio/calendar', cta: 'Open the calendar', empty: 'Nothing scheduled for the next two days.',
      items: next.map((p) => ({ key: p.id, title: (p.content || p.title || 'Post').replace(/\s+/g, ' ').slice(0, 80), sub: when(p.scheduledFor) })),
    });
  }
  return out;
}

async function davinciCards() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [working, ready] = await Promise.all([
    supabase.from('pro_edit_jobs').select('id, title, status, error, created_at', { count: 'exact' }).in('status', ['queued', 'processing', 'failed']).order('created_at', { ascending: false }).limit(4),
    supabase.from('pro_edit_jobs').select('id, title, updated_at', { count: 'exact' }).eq('status', 'done').gte('updated_at', since).order('updated_at', { ascending: false }).limit(4),
  ]);
  const label = { queued: 'Waiting for Iris', processing: 'Editing in DaVinci', failed: 'Needs attention' };
  return [
    !working.error && {
      key: 'working', Icon: Film, title: 'In the DaVinci queue', count: working.count ?? (working.data || []).length, to: '/systems/pro-edit', cta: 'Open DaVinci', empty: 'Nothing waiting. Find clips in some new footage.',
      tone: (working.data || []).some((j) => j.status === 'failed') ? 'alert' : null,
      items: (working.data || []).map((j) => ({ key: j.id, title: j.title || 'Untitled edit', sub: `${label[j.status]} · ${ago(j.created_at)}` })),
    },
    !ready.error && {
      key: 'ready', Icon: CheckCircle2, title: 'Finished this week', count: ready.count ?? (ready.data || []).length, to: '/systems/pro-edit', cta: 'Download finished clips', empty: 'No finished edits this week yet.',
      items: (ready.data || []).map((j) => ({ key: j.id, title: j.title || 'Edit', sub: `Ready ${ago(j.updated_at)}` })),
    },
  ].filter(Boolean);
}

// Which dashboards report in, in the order they're shown.
const sourcesFor = (roles) => [
  ...(roles.mentor || []).map((slug) => ({ key: `mentor-${slug}`, title: PROGRAM[slug] || slug, to: `/academy/${slug}/teach`, load: () => mentorCards(slug) })),
  ...(roles.operator || roles.admin ? [{ key: 'systems', title: 'Systems', to: '/systems', load: systemsCards }] : []),
  ...(roles.studio ? [{ key: 'studio', title: 'Content Studio', to: '/studio', load: studioCards }] : []),
  ...(hasTool(roles, 'davinci') ? [{ key: 'davinci', title: 'DaVinci', to: '/systems/pro-edit', load: davinciCards }] : []),
];

// ── /today — the team's home ──────────────────────────────────
const Today = () => {
  const { signOut } = useAuth();
  const { status, roles, user } = useRoles();
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
  ];
  const quick = [
    ...(roles.mentor || []).slice(0, 1).map((slug) => ({ to: `/academy/${slug}/teach/sessions`, Icon: Video, label: 'Go live' })),
    roles.studio && { to: '/studio/compose', Icon: Megaphone, label: 'New post' },
    hasTool(roles, 'davinci') && { to: '/systems/pro-edit', Icon: Scissors, label: 'Find clips' },
    admin && { to: '/systems/campaigns', Icon: Mail, label: 'Email campaign' },
    admin && { to: '/systems/events', Icon: CalendarDays, label: 'Add a market date' },
    admin && { to: '/systems/clips', Icon: Clapperboard, label: 'Make a clip' },
  ].filter(Boolean);

  return (
    <DashShell
      theme="light"
      brand={{ to: '/today', mark, title: 'P31 Collective', subtitle: 'Today' }}
      nav={nav}
      account={{ name: user?.user_metadata?.full_name || user?.email || '', role: roles.admin ? 'Admin' : admin ? 'Operator' : 'Team' }}
      onSignOut={signOut}
    >
      <DashHead
        eyebrow={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        title={`${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}${name ? ',' : '.'}`}
        accent={name ? `${name}.` : null}
        lead={pending && !loaded.length ? 'Gathering what needs you…'
          : total ? `${total} thing${total === 1 ? '' : 's'} could use your attention across your dashboards.`
            : pending ? 'Still checking a few places…' : 'Everything’s handled. Enjoy the quiet.'}
      />

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
              ? [...cards[s.key]].sort((a, b) => (b.count > 0) - (a.count > 0)).map((c) => <Card key={c.key} card={c} />)
              : [0, 1].map((i) => <div key={i} className="td2-card" aria-hidden="true"><div className="td2-skel" /></div>)}
          </div>
        </section>
      ))}
    </DashShell>
  );
};

export default Today;
