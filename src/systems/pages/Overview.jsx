import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SYSTEMS_GROUPS } from '../nav';
import { hrefFor } from '../../lib/site';

const BLURBS = {
  '/systems/crm': 'Everyone who has reached P31, from first form to alumni, with their history.',
  '/studio': 'Instagram & Facebook: plan, create, schedule and answer messages.',
  '/dashboard': 'Approve new curators and manage shops on p31market.com.',
  '/systems/applications': 'Review “Join P31 Collective” membership applications.',
  '/systems/social': 'Plan, schedule and share posts across every platform.',
  '/systems/growth': 'Search social media for groups and people who fit P31.',
  '/systems/events': 'Create markets, announce dates, and manage RSVPs.',
  '/systems/campaigns': 'Email subscribers and curators — with AI drafts.',
  '/systems/orders': 'Every order across the marketplace, live.',
  '/systems/academy': 'Mentorship prices, mentors, members and Studio seats.',
  '/systems/clips': 'Turn raw footage into captioned, edited clips on your phone.',
  '/systems/photos': 'Remove backgrounds, stage products and apply looks.',
  '/systems/pro-edit': 'Premium DaVinci Resolve edits, handled by Iris.',
  '/systems/health': 'Errors visitors hit on either site, as they happen.',
  '/systems/settings': 'Your password, the team, and connected services.',
};

const count = async (table, filter) => {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  return error ? null : n;
};

const Overview = ({ operator }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      count('social_prospects', (q) => q.neq('status', 'ignore')),
      count('social_posts', (q) => q.eq('status', 'scheduled')),
      count('pro_edit_jobs', (q) => q.in('status', ['queued', 'processing'])),
      count('curator_data', (q) => q.eq('status', 'pending')),
      count('collective_applications', (q) => q.eq('status', 'new')),
      count('app_errors', (q) => q.is('resolved_at', null)),
    ]).then(([prospects, scheduled, edits, pending, applications, errors]) => setStats({ prospects, scheduled, edits, pending, applications, errors }));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Overview</p>
        <h1>{greeting}, {operator.display_name || operator.username}.</h1>
      </header>

      <div className="sys-stats sys-stats--5">
        {[
          ['New applications', stats?.applications, '/systems/applications'],
          ['Prospects', stats?.prospects, '/systems/growth'],
          ['Posts scheduled', stats?.scheduled, '/systems/social'],
          ['Pro edits in queue', stats?.edits, '/systems/pro-edit'],
          ['Curators awaiting review', stats?.pending, '/dashboard'],
          ['Open site errors', stats?.errors, '/systems/health'],
        ].map(([label, n, to]) => (
          <Link to={to} className="sys-stat" key={label}>
            <span className="sys-stat__n">{n ?? '—'}</span>
            <span className="sys-stat__l">{label}</span>
          </Link>
        ))}
      </div>

      {SYSTEMS_GROUPS.map((g) => (
        <section key={g.id} className="sys-group" aria-labelledby={`sys-og-${g.id}`}>
          <h2 id={`sys-og-${g.id}`} className="sys-group__title">{g.label}</h2>
          <div className="sys-tools">
            {g.items.filter((n) => BLURBS[n.to]).map((n) => {
              const href = hrefFor(n.to);
              const body = <>
                <span className="sys-tool__icon"><n.Icon size={22} /></span>
                <div>
                  <h3>{n.label === 'Clips' ? 'Clip Studio' : n.label === 'Photos' ? 'Photo Studio' : n.label}</h3>
                  <p>{BLURBS[n.to]}</p>
                </div>
                {n.away ? <ArrowUpRight size={18} className="sys-tool__go" /> : <ArrowRight size={18} className="sys-tool__go" />}
              </>;
              return href === n.to
                ? <Link to={n.to} className="sys-tool" key={n.to}>{body}</Link>
                : <a href={href} className="sys-tool" key={n.to}>{body}</a>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

export default Overview;
