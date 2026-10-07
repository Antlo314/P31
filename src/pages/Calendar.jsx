import React, { useEffect, useState } from 'react';
import { CalendarPlus, CalendarClock, MapPin, Clock, ArrowUpRight, Bell, Ticket, X, Check, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchUpcomingEvents, parseEventDate, formatEventDate, showDate } from '../lib/events';
import PageHeader from '../components/PageHeader';
import { openJoin } from '../lib/join';
import './Calendar.css';

import featuredImg from '../assets/web/p31_community_impact_editorial_1776544076592.webp';

// "3:30 PM" → [15, 30]; falls back to noon.
const parseTime = (t) => {
  const m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(t || '');
  if (!m) return [12, 0];
  let h = Number(m[1]) % 12;
  if ((m[3] || '').toLowerCase() === 'pm') h += 12;
  return [h, Number(m[2] || 0)];
};

// A tiny .ics file — opens straight in Apple / Google / Outlook calendars.
const addToCalendar = (ev) => {
  const d = parseEventDate(ev.event_date);
  const [h, min] = parseTime(ev.start_time);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const fmt = (x) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const where = [ev.venue, ev.address || ev.location].filter(Boolean).join(', ');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//P31 Marketplace//EN', 'BEGIN:VEVENT',
    `UID:p31-${ev.id}@p31market.com`, `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
    `SUMMARY:Proverbs 31 Marketplace — ${ev.title}`,
    where ? `LOCATION:${where}` : '',
    'URL:https://p31market.com/calendar',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })),
    download: `p31-${ev.title.toLowerCase().replace(/\W+/g, '-')}.ics`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const DateBadge = ({ ev, big }) => {
  const d = parseEventDate(ev.event_date);
  return showDate(ev) ? (
    <>
      <span>{d.getDate()}</span>
      <small>{d.toLocaleDateString('en-US', { month: 'short' })}{big ? '' : ` ’${String(d.getFullYear()).slice(2)}`}</small>
    </>
  ) : (
    <>
      <CalendarClock size={big ? 26 : 22} />
      <small>Soon</small>
    </>
  );
};

// RSVP sheet — free registration with capacity + waitlist (v19).
const RsvpSheet = ({ ev, onClose }) => {
  const [form, setForm] = useState({ name: '', email: '', guests: 1, trap: '' });
  const [state, setState] = useState({ step: 'form' });

  const submit = async (e) => {
    e.preventDefault();
    setState({ step: 'sending' });
    const { data, error } = await supabase.rpc('register_for_event', {
      p_event_id: ev.id, p_name: form.name, p_email: form.email, p_guests: Number(form.guests), p_trap: form.trap,
    });
    if (error) return setState({ step: 'form', error: error.message });
    setState({ step: 'done', result: data });
  };

  const messages = {
    confirmed: ['You’re on the list!', `We’ve saved ${form.guests > 1 ? `${form.guests} spots` : 'your spot'} for ${ev.title}. Watch your inbox for details.`],
    waitlist: ['You’re on the waitlist', 'This market is full right now — we’ll email you if a spot opens.'],
    already: ['You’re already registered', 'That email is already on the list for this market.'],
    closed: ['RSVPs are closed', 'Registration isn’t open for this market right now.'],
  };

  return (
    <div className="k-sheet" role="dialog" aria-modal="true" aria-label={`RSVP for ${ev.title}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="k-sheet__panel">
        <div className="k-sheet__grip" aria-hidden="true" />
        <button className="k-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {state.step === 'done' ? (
          <div className="cal-sheet__done">
            <span className={state.result === 'confirmed' ? 'is-ok' : ''}><Check size={26} /></span>
            <h2>{messages[state.result]?.[0] || 'Thank you'}</h2>
            <p>{messages[state.result]?.[1]}</p>
            {state.result === 'confirmed' && showDate(ev) && (
              <button className="k-btn k-btn--plum" onClick={() => addToCalendar(ev)}><CalendarPlus size={16} /> Add to calendar</button>
            )}
            <button className="k-btn k-btn--ghost" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="cal-form">
            <p className="k-eyebrow" style={{ margin: 0 }}>Free RSVP</p>
            <h2 className="k-h2" style={{ fontSize: '2.2rem' }}>Save my <em>spot</em></h2>
            <p className="cal-form__sub">{ev.title}{showDate(ev) ? ` · ${formatEventDate(ev.event_date, { month: 'long', day: 'numeric' })}` : ' · date coming soon'}</p>
            <label><span>Full name</span>
              <input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label><span>Email</span>
              <input required type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label><span>Party size</span>
              <select value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>)}
              </select>
            </label>
            {/* Bot trap — humans never see or fill this. */}
            <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.trap} onChange={(e) => setForm({ ...form, trap: e.target.value })} />
            {state.error && <p className="k-error" role="alert">{state.error}</p>}
            <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state.step === 'sending'}>{state.step === 'sending' ? 'Saving…' : <><Ticket size={18} /> Reserve my spot</>}</button>
          </form>
        )}
      </div>
    </div>
  );
};

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [spots, setSpots] = useState({});
  const [rsvpFor, setRsvpFor] = useState(null);
  const [next, ...later] = events;

  useEffect(() => {
    fetchUpcomingEvents().then(async (rows) => {
      setEvents(rows);
      setLoaded(true);
      // Seats left for capped events.
      const capped = rows.filter((r) => r.capacity);
      const entries = await Promise.all(capped.map(async (r) => {
        const { data } = await supabase.rpc('event_spots_left', { p_event_id: r.id });
        return [r.id, data];
      }));
      setSpots(Object.fromEntries(entries));
    });
  }, []);

  const where = (ev) => ev.venue || ev.location || 'Venue to be announced';
  const canRsvp = (ev) => ev.rsvp_enabled !== false && !ev.rsvp_url;
  const spotsText = (ev) => (ev.capacity && spots[ev.id] != null
    ? (spots[ev.id] > 0 ? `${spots[ev.id]} spots left` : 'Full — join the waitlist')
    : null);

  return (
    <div className="cal">
      <PageHeader
        eyebrow="The Experience"
        title="Market"
        accent="dates"
        lead="A curated market unlike any other — live music, gifted makers and a community of visionary women."
      />

      <section className="cal__body">
        {next && (
          <article className="cal-feature" data-reveal>
            <div className="cal-feature__media">
              <img src={next.image_url || featuredImg} alt="" data-parallax="6" />
              <div className="cal-feature__date"><DateBadge ev={next} big /></div>
              <span className="cal-feature__flag">Next market</span>
            </div>
            <div className="cal-feature__body">
              <h2>{next.title}</h2>
              <ul className="cal-meta">
                {showDate(next) ? (
                  <>
                    <li><CalendarPlus size={16} /> {formatEventDate(next.event_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</li>
                    {next.start_time && <li><Clock size={16} /> {next.start_time}</li>}
                  </>
                ) : (
                  <li><CalendarClock size={16} /> Date coming soon</li>
                )}
                <li><MapPin size={16} /> {where(next)}{next.address ? ` · ${next.address}` : ''}</li>
                {spotsText(next) && <li><Users size={16} /> {spotsText(next)}</li>}
              </ul>
              {next.description && <p>{next.description}</p>}
              <div className="cal-actions">
                {next.rsvp_url && (
                  <a className="k-btn k-btn--gold" href={next.rsvp_url} target="_blank" rel="noreferrer">RSVP <ArrowUpRight size={16} /></a>
                )}
                {canRsvp(next) && (
                  <button className="k-btn k-btn--gold" onClick={() => setRsvpFor(next)}><Ticket size={16} /> Save my spot</button>
                )}
                {showDate(next) ? (
                  <button className="k-btn k-btn--plum" onClick={() => addToCalendar(next)}><CalendarPlus size={16} /> Add to calendar</button>
                ) : !canRsvp(next) && (
                  <button type="button" className="k-btn k-btn--plum" onClick={openJoin}><Bell size={16} /> Notify me</button>
                )}
                {next.address && (
                  <a className="k-btn k-btn--ghost" href={`https://maps.google.com/?q=${encodeURIComponent(`${next.venue || ''} ${next.address}`)}`} target="_blank" rel="noreferrer">
                    <MapPin size={16} /> Directions
                  </a>
                )}
              </div>
            </div>
          </article>
        )}

        {later.length > 0 && (
          <>
            <p className="k-eyebrow cal__sub" data-reveal="fade">Also coming up</p>
            <div className="cal-list" data-reveal-group>
              {later.map((ev) => (
                <article className="cal-row" key={ev.id}>
                  <div className="cal-row__date"><DateBadge ev={ev} /></div>
                  <div className="cal-row__info">
                    <h4>{ev.title}</h4>
                    <p>{showDate(ev) ? [ev.start_time, where(ev)].filter(Boolean).join(' · ') : 'Date coming soon'}</p>
                  </div>
                  {canRsvp(ev) ? (
                    <button className="cal-icon-btn" onClick={() => setRsvpFor(ev)} aria-label={`RSVP for ${ev.title}`}><Ticket size={18} /></button>
                  ) : showDate(ev) && (
                    <button className="cal-icon-btn" onClick={() => addToCalendar(ev)} aria-label={`Add ${ev.title} to calendar`}><CalendarPlus size={18} /></button>
                  )}
                </article>
              ))}
            </div>
          </>
        )}

        {loaded && !next && (
          <div className="k-empty" data-reveal>
            <span className="k-icon"><Bell size={24} /></span>
            <h2>New dates coming soon</h2>
            <p>Join the collective to hear about the next market first.</p>
            <button type="button" className="k-btn k-btn--gold" onClick={openJoin}>Join the collective</button>
          </div>
        )}
      </section>

      {rsvpFor && <RsvpSheet ev={rsvpFor} onClose={() => setRsvpFor(null)} />}
    </div>
  );
};

export default Calendar;
