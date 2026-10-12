import React, { useEffect, useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DASH } from '../../lib/dashboards';

// What each table is, in words, and which Systems page it belongs to.
const AREA = {
  curator_data: ['Shops', 'shop'], products: ['Shops', 'product'], team_access: ['Team', 'team login'], site_admins: ['Team', 'site admin'],
  vendor_applications: ['Vendors', 'vendor application'], vendor_agreements: ['Vendors', 'storefront agreement'], vendor_registrations: ['Vendors', 'market registration'],
  collective_applications: ['People', 'join application'], market_events: ['Events', 'market'], event_vendors: ['Events', 'lineup spot'],
  academy_enrollments: ['Mentorship', 'enrollment'], academy_mentors: ['Mentorship', 'mentor'], academy_plans: ['Mentorship', 'plan'],
  academy_modules: ['Mentorship', 'module'], academy_lessons: ['Mentorship', 'lesson'], campaigns: ['Campaigns', 'campaign'], app_settings: ['Settings', 'setting'],
};
const AREAS = ['All', 'Shops', 'Team', 'Vendors', 'Events', 'Mentorship', 'People', 'Campaigns', 'Settings'];
const FIELD = {
  status: 'status', is_featured: 'featured', is_paid: 'paid storefront', is_published: 'published', is_early_bird: 'early bird', verification_badges: 'badges',
  admin_feedback: 'note to the vendor', slug: 'shop link', business_name: 'name', subscription_status: 'billing', trial_ends_at: 'free period end',
  is_active: 'shown', badge: 'badge', tools: 'dashboards', role_title: 'role', site: 'site', full_name: 'name', access_until: 'access until',
  price_cents: 'price', title: 'title', event_date: 'date', date_public: 'date announced', month_public: 'month announced', has_vendors: 'has vendors',
  venue: 'venue', rsvp_url: 'ticket link', booth: 'booth', value: 'value', reason: 'reason',
};
const STATUS_WORD = { approved: 'approved', paused: 'paused', rejected: 'asked for changes on', pending: 'moved to pending', declined: 'declined', waitlist: 'waitlisted', confirmed: 'confirmed', sent: 'sent', canceled: 'canceled', expired: 'ended' };

const show = (v) => {
  if (v === null || v === undefined || v === '') return 'empty';
  if (Array.isArray(v)) return v.length ? v.map((x) => DASH[x]?.short || x).join(', ') : 'none';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (typeof v === 'object') return JSON.stringify(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(v))) return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return String(v).length > 60 ? `${String(v).slice(0, 60)}…` : String(v);
};

/** One line in plain words: "Melanie JC paused Sample Bakery Co." */
const describe = (r) => {
  const who = r.actor_name || r.actor_email || 'Someone';
  const [, noun] = AREA[r.area] || ['', r.area.replace(/_/g, ' ')];
  const target = r.target_label ? `${noun} “${r.target_label}”` : `a ${noun}`;
  if (r.action === 'insert') return `${who} added ${target}`;
  if (r.action === 'delete') return `${who} removed ${target}`;
  const c = r.changes || {};
  if (c.status && Object.keys(c).length <= 3) {
    const word = STATUS_WORD[c.status[1]] || `set the status to ${c.status[1]} on`;
    return `${who} ${word} ${target}`;
  }
  if (c.tools) return `${who} changed the dashboards of ${target}`;
  return `${who} changed ${target}`;
};

const when = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Systems → Team → Activity: who changed what, newest first.
const Activity = () => {
  const [rows, setRows] = useState(null);
  const [area, setArea] = useState('All');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('admin_activity').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data, error: err }) => {
        if (err) { setError(/does not exist|schema cache/i.test(err.message) ? 'Run storefront_v42_operations.sql in Supabase to start the activity log (Systems → Health has a copy button).' : err.message); setRows([]); return; }
        setRows(data || []);
      });
  }, []);

  const shown = useMemo(() => (rows || []).filter((r) => (area === 'All' || (AREA[r.area] || [])[0] === area)
    && (!q || `${r.actor_name} ${r.actor_email} ${r.target_label} ${describe(r)}`.toLowerCase().includes(q.toLowerCase()))), [rows, area, q]);

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Team</p>
        <h1>Activity</h1>
        <p className="sys-muted">Who changed what across both sites: shops and products, dashboards and admins, vendor forms, markets, enrollments, campaigns and settings. People changing their own shop or products are not listed, and neither are automatic changes except the ones Systems makes for billing.</p>
      </header>
      {error && <p className="sys-alert">{error}</p>}
      <div className="sh-head">
        <label className="sys-field sh-search"><span className="sr-only">Search the activity</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by person, shop or change" aria-label="Search the activity" /></label>
      </div>
      <div className="sys-chips" role="tablist" style={{ marginBottom: 12 }} data-tour="activity-areas">
        {AREAS.map((a) => <button key={a} role="tab" aria-selected={area === a} className={`sys-chip ${area === a ? 'is-on' : ''}`} onClick={() => setArea(a)}>{a}</button>)}
      </div>
      {rows === null ? <p className="sys-muted">Loading…</p> : shown.length === 0 ? <p className="sys-empty">{rows.length ? 'Nothing matches.' : 'Nothing has been logged yet. Changes appear here as the team makes them.'}</p> : (
        <ul className="ac-list" data-tour="activity-list">
          {shown.map((r) => (
            <li key={r.id} className="ac-row">
              <span className="ac-row__icon"><History size={15} /></span>
              <div className="ac-row__main">
                <strong>{describe(r)}</strong>
                {r.action === 'update' && Object.keys(r.changes || {}).length > 0 && (
                  <small>{Object.entries(r.changes).map(([k, [from, to]]) => `${FIELD[k] || k.replace(/_/g, ' ')}: ${show(from)} → ${show(to)}`).join(' · ')}</small>
                )}
                <small className="ac-row__meta">{when(r.created_at)} · {(AREA[r.area] || [r.area])[0]}{r.actor_email && r.actor_name ? ` · ${r.actor_email}` : ''}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows?.length >= 500 && <p className="sys-muted"><Search size={13} /> Showing the latest 500 changes.</p>}
    </div>
  );
};

export default Activity;
