import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Monitor, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SITES, SYSTEMS_GROUPS } from '../nav';
import { hrefFor } from '../../lib/site';
import { useIsPhone } from '../../lib/device';
import { marketCards, collectiveCards, healthCards } from '../../today/cards';
import AttentionCard, { Go } from '../../today/AttentionCard';
import '../../today/today.css';

const money = (cents) => `$${(Math.round(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// The live numbers for each site. Anything this person can't read shows as a dash.
async function loadNumbers() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const r = await Promise.allSettled([
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('fulfillment_status', ['new', 'confirmed']),
    supabase.from('orders').select('amount_total').eq('payment_status', 'paid').gte('created_at', monthStart.toISOString()).limit(2000),
    supabase.from('curator_data').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('market_events').select('id, title, event_date, venue').eq('is_active', true).gte('event_date', today).order('event_date').limit(1),
    supabase.from('collective_applications').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('academy_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('email_threads').select('id', { count: 'exact', head: true }).eq('status', 'needs_reply'),
    supabase.from('social_posts').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
  ]);
  const v = (i) => (r[i].status === 'fulfilled' && !r[i].value.error ? r[i].value : null);
  const next = v(3)?.data?.[0] || null;
  let lineup = null;
  if (next) {
    const { count, error } = await supabase.from('event_vendors').select('id', { count: 'exact', head: true }).eq('event_id', next.id).neq('status', 'declined');
    lineup = error ? null : count;
  }
  return {
    openOrders: v(0)?.count ?? null,
    sales: v(1) ? (v(1).data || []).reduce((s, o) => s + (Number(o.amount_total) || 0), 0) : null,
    shops: v(2)?.count ?? null,
    next, lineup,
    joinNew: v(4)?.count ?? null,
    students: v(5)?.count ?? null,
    emails: v(6)?.count ?? null,
    scheduled: v(7)?.count ?? null,
  };
}

const Stat = ({ n, label, to, sub }) => (
  <Go to={to} className="sys-stat">
    <span className="sys-stat__n">{n ?? '—'}</span>
    <span className="sys-stat__l">{label}</span>
    {sub && <span className="sys-stat__s">{sub}</span>}
  </Go>
);

// A room's tiles (the group's items), with "Computer" on the ones that need one.
const Tools = ({ group, phone }) => (
  <div className="sys-tools">
    {group.items.map((n) => {
      const href = hrefFor(n.to);
      const body = <>
        <span className="sys-tool__icon"><n.Icon size={22} /></span>
        <div>
          <h3>{n.label}{n.paused ? <span className="sys-tag sys-tag--dim">Paused</span> : n.desktop && <span className="sys-tag"><Monitor size={11} /> Computer</span>}</h3>
          <p>{n.blurb}</p>
        </div>
        {n.paused ? null : n.away ? <ArrowUpRight size={18} className="sys-tool__go" /> : <ArrowRight size={18} className="sys-tool__go" />}
      </>;
      const cls = `sys-tool ${n.desktop && phone ? 'is-desktop' : ''}`;
      if (n.paused) return <div className={`${cls} is-paused`} key={n.to} aria-disabled="true">{body}</div>;
      return href === n.to ? <Link to={n.to} className={cls} key={n.to}>{body}</Link> : <a href={href} className={cls} key={n.to}>{body}</a>;
    })}
  </div>
);

const SiteHead = ({ site }) => (
  <div className="sys-sitehead">
    <div>
      <span className={`sys-site sys-site--${site.id}`}>{site.label}</span>
      <h2>{site.title}</h2>
      <p>{site.blurb}</p>
    </div>
    {site.url && <a className="sys-sitehead__open" href={site.url} target="_blank" rel="noreferrer">{site.host} <ArrowUpRight size={14} /></a>}
  </div>
);

const Cards = ({ list, skeleton = 2 }) => (
  <div className="td2-grid sys-attn">
    {list
      ? [...list].sort((a, b) => (b.count > 0) - (a.count > 0)).map((c) => <AttentionCard key={c.key} card={c} />)
      : Array.from({ length: skeleton }, (_, i) => <div key={i} className="td2-card" aria-hidden="true"><div className="td2-skel" /></div>)}
  </div>
);

/** Systems home: the two sites, each with its numbers, what needs attention, and its rooms. */
const Overview = ({ operator }) => {
  const phone = useIsPhone();
  const [n, setN] = useState(null);
  const [cards, setCards] = useState({});

  useEffect(() => {
    let live = true;
    loadNumbers().then((x) => { if (live) setN(x); });
    [['market', marketCards], ['collective', collectiveCards], ['health', healthCards]].forEach(([k, load]) => load()
      .catch(() => [])
      .then((list) => { if (live) setCards((c) => ({ ...c, [k]: list })); }));
    return () => { live = false; };
  }, []);

  const all = [...(cards.market || []), ...(cards.collective || []), ...(cards.health || [])];
  const needs = all.filter((c) => c.count > 0);
  const loading = !cards.market || !cards.collective || !cards.health;
  const total = needs.reduce((s, c) => s + c.count, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const group = (id) => SYSTEMS_GROUPS.find((g) => g.id === id);

  return (
    <div className="sys-page sys-overview">
      <header className="sys-page__head sys-overview__head">
        <div>
          <p className="sys-eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>{greeting}, {operator.display_name || operator.username}.</h1>
          <p className="sys-muted">{loading && !needs.length ? 'Checking both sites…' : total ? `${total} thing${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} you across both sites.` : 'Both sites are quiet. Nothing is waiting on you.'}</p>
        </div>
        <Link to="/today" className="sys-btn sys-btn--ghost sys-btn--sm"><Sun size={15} /> Today</Link>
      </header>

      {needs.length > 0 && (
        <div className="sys-needs" role="group" aria-label="Needs you">
          {needs.map((c) => (
            <Go key={c.key} to={c.to} className={`sys-needs__chip ${c.tone === 'alert' ? 'is-alert' : ''} sys-needs__chip--${c.site}`}>
              <c.Icon size={14} /> <strong>{c.count}</strong> {c.title.toLowerCase()}
            </Go>
          ))}
        </div>
      )}

      {/* ── Market ─────────────────────────────────────── */}
      <section className="sys-sitesec sys-sitesec--market" aria-labelledby="sys-site-market">
        <SiteHead site={SITES.market} />
        <div className="sys-stats">
          <Stat n={n?.openOrders} label="Open orders" to="/systems/orders" />
          <Stat n={n && n.sales != null ? money(n.sales) : null} label="Paid this month" to="/systems/orders" />
          <Stat n={n?.shops} label="Shops live" to="/dashboard/governance" />
          <Stat n={n ? (n.next ? fmtDate(n.next.event_date) : 'None') : null} label={n?.next ? n.next.title : 'Next market'} to="/systems/events" sub={n?.next && n.lineup != null ? `${n.lineup} vendor${n.lineup === 1 ? '' : 's'} in the lineup` : null} />
        </div>
        <Cards list={cards.market} skeleton={3} />
        <Tools group={group('market')} phone={phone} />
      </section>

      {/* ── Collective ─────────────────────────────────── */}
      <section className="sys-sitesec sys-sitesec--collective" aria-labelledby="sys-site-collective">
        <SiteHead site={SITES.collective} />
        <div className="sys-stats">
          <Stat n={n?.joinNew} label="New join applications" to="/systems/applications" />
          <Stat n={n?.students} label="Students active" to="/systems/academy" />
          <Stat n={n?.emails} label="Emails waiting" to="/studio/email" />
          <Stat n={n?.scheduled} label="Posts scheduled" to="/studio/calendar" />
        </div>
        <Cards list={cards.collective} skeleton={3} />
        <Tools group={group('collective')} phone={phone} />
      </section>

      {/* ── Create + Team ──────────────────────────────── */}
      <section className="sys-sitesec sys-sitesec--both" aria-labelledby="sys-site-create">
        <div className="sys-sitehead">
          <div>
            <span className="sys-site sys-site--both">Both sites</span>
            <h2 id="sys-site-create">Create</h2>
            <p>Content tools for both sites.{phone ? ' The two marked Computer edit video on the device, so they wait for a laptop.' : ''}</p>
          </div>
        </div>
        <Tools group={group('create')} phone={phone} />
      </section>

      <section className="sys-sitesec sys-sitesec--both" aria-labelledby="sys-site-team">
        <div className="sys-sitehead">
          <div>
            <span className="sys-site sys-site--both">Both sites</span>
            <h2 id="sys-site-team">Team</h2>
            <p>Access, health and settings.</p>
          </div>
        </div>
        <Cards list={cards.health} skeleton={1} />
        <Tools group={group('team')} phone={phone} />
      </section>
    </div>
  );
};

export default Overview;
