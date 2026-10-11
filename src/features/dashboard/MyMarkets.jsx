import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, MapPin, Clock, ArrowRight, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatEventDate, showDate, showMonth, monthLabel } from '../../lib/events';
import './MyMarkets.css';

// Her place at each market, from the lineup first (what the team set), else her registration.
const LINEUP = {
  invited: ['Invited', 'Register to reserve your space.'],
  confirmed: ['Confirmed', 'Payment and booth details follow by email.'],
  paid: ['Confirmed · paid', 'You are all set.'],
  checked_in: ['Checked in', 'Have a wonderful market.'],
  no_show: ['Missed', 'Reach out to vendor@p31market.com.'],
  cancelled: ['Cancelled', ''],
};
const REG = {
  new: ['Registration received', 'The team will confirm your space by email.'],
  confirmed: ['Confirmed', 'Booth and payment details follow by email.'],
  waitlist: ['On the waitlist', 'We will email you first if a space opens.'],
  declined: ['Not this time', ''],
  cancelled: ['Cancelled', ''],
};
const tone = (s) => (['confirmed', 'paid', 'checked_in'].includes(s) ? 'ok' : ['declined', 'cancelled', 'no_show'].includes(s) ? 'off' : 'wait');

const when = (ev) => (showDate(ev)
  ? `${formatEventDate(ev.event_date, { weekday: 'short', month: 'short', day: 'numeric' })}${ev.start_time ? ` · ${ev.start_time}` : ''}`
  : showMonth(ev) ? `${monthLabel(ev)} · date coming soon` : 'Date coming soon');

/** Curator studio: the markets she is registered for or in the lineup of, with her status, booth and check-in time. */
const MyMarkets = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    supabase.rpc('my_markets').then(({ data: d, error }) => setData(error ? { failed: true } : d || {}));
  }, []);
  if (!data || data.failed) return null; // before v38, or nothing to show yet: the checklist is enough

  const events = data.events || [];
  const byEvent = new Map();
  (data.lineup || []).forEach((l) => byEvent.set(l.event_id, { ...byEvent.get(l.event_id), lineup: l }));
  (data.registrations || []).forEach((r) => {
    const key = r.event_id || `label:${r.event_label}`;
    if (!byEvent.get(key)?.reg) byEvent.set(key, { ...byEvent.get(key), reg: r });
  });
  const today = new Date().toISOString().slice(0, 10);
  const rows = [...byEvent.entries()].map(([key, v]) => ({ key, ...v, ev: events.find((e) => e.id === key) || null }))
    .filter((r) => !r.ev || r.ev.event_date >= today)
    .sort((a, b) => (a.ev?.event_date || '9999') > (b.ev?.event_date || '9999') ? 1 : -1);
  const next = events.find((e) => e.has_vendors !== false && e.event_date >= today && !byEvent.has(e.id));

  return (
    <section className="dashboard-card glass-card mm" data-tour="markets">
      <h3 className="card-title text-gold"><CalendarCheck size={18} /> My markets</h3>
      {rows.length ? (
        <ul className="mm__list">
          {rows.map((r) => {
            const s = r.lineup?.status || r.reg?.status || 'new';
            const [label, sub] = (r.lineup ? LINEUP : REG)[s] || [s, ''];
            return (
              <li key={r.key} className={`mm__row mm__row--${tone(s)}`}>
                <div className="mm__head">
                  <strong>{r.ev?.title || r.reg?.event_label}</strong>
                  <span className="mm__pill">{label}</span>
                </div>
                {r.ev && <small><CalendarCheck size={13} /> {when(r.ev)}</small>}
                {r.ev?.venue && <small><MapPin size={13} /> {r.ev.venue}</small>}
                {r.lineup?.booth && <small><Store size={13} /> Booth {r.lineup.booth}</small>}
                {r.ev?.load_in && !['declined', 'cancelled'].includes(s) && <small><Clock size={13} /> Vendors check in by {r.ev.load_in}</small>}
                {sub && <p>{sub}</p>}
                {s === 'invited' && !r.reg && <Link to="/vendors/register" className="mm__go">Register for this market <ArrowRight size={13} /></Link>}
              </li>
            );
          })}
        </ul>
      ) : <p className="mm__empty">You are not registered for a market yet.</p>}
      {next && (
        <Link to="/vendors/register" className="mm__go mm__go--next">Register for {next.title} <ArrowRight size={13} /></Link>
      )}
    </section>
  );
};

export default MyMarkets;
