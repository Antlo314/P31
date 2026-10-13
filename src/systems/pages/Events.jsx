import React, { useEffect, useMemo, useState } from 'react';
import { Plus, CalendarClock, Eye, EyeOff, Users, Download, Pencil, X, Check, Ticket, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import EventLineup from './EventLineup';
import TicketSales from '../../today/TicketSales';
import { formatEventDate } from '../../lib/events';
import { DeleteRecord } from '../AdminRecord';

const blank = {
  title: '', event_date: '', start_time: '', venue: '', address: '', description: '',
  capacity: '', rsvp_enabled: true, date_public: false, month_public: false, rsvp_url: '', is_active: true, has_vendors: true, load_in: '',
};

const toCsv = (rows) => {
  const cols = ['full_name', 'email', 'guests', 'status', 'created_at'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const Events = () => {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [editing, setEditing] = useState(null); // event object or blank
  const [viewing, setViewing] = useState(null); // event id for registrations
  const [lineupFor, setLineupFor] = useState(null); // event id whose vendor lineup is open
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [{ data: ev, error: evErr }, { data: rg }] = await Promise.all([
      supabase.from('market_events').select('*').order('event_date', { ascending: true }),
      supabase.from('event_registrations').select('*').order('created_at', { ascending: false }),
    ]);
    if (evErr) setError(evErr.message);
    setEvents(ev || []);
    setRegs(rg || []);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = {};
    regs.forEach((r) => {
      c[r.event_id] ||= { confirmed: 0, waitlist: 0 };
      if (r.status === 'confirmed') c[r.event_id].confirmed += r.guests;
      if (r.status === 'waitlist') c[r.event_id].waitlist += r.guests;
    });
    return c;
  }, [regs]);

  const today = todayISO();
  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today).reverse();

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const row = {
      title: editing.title.trim(),
      event_date: editing.event_date,
      start_time: editing.start_time || null,
      venue: editing.venue || null,
      address: editing.address || null,
      description: editing.description || null,
      capacity: editing.capacity === '' || editing.capacity === null ? null : Number(editing.capacity),
      rsvp_enabled: !!editing.rsvp_enabled,
      date_public: !!editing.date_public,
      month_public: !!editing.month_public,
      has_vendors: editing.has_vendors !== false,
      load_in: editing.has_vendors !== false && editing.load_in ? editing.load_in : null,
      rsvp_url: editing.rsvp_url || null,
      is_active: !!editing.is_active,
    };
    const { error: err, count } = editing.id
      ? await supabase.from('market_events').update(row, { count: 'exact' }).eq('id', editing.id)
      : await supabase.from('market_events').insert(row);
    if (err) return setError(err.message);
    if (editing.id && count === 0) return setError('That did not save. This login may not have the Events dashboard.');
    setEditing(null);
    setMsg('Saved — the site updates right away.');
    load();
  };

  const quick = async (ev, patch) => {
    setEvents((list) => list.map((x) => (x.id === ev.id ? { ...x, ...patch } : x)));
    const { error: err } = await supabase.from('market_events').update(patch).eq('id', ev.id);
    if (err) { setError(err.message); load(); }
  };

  const setRegStatus = async (r, status) => {
    setRegs((list) => list.map((x) => (x.id === r.id ? { ...x, status } : x)));
    await supabase.from('event_registrations').update({ status }).eq('id', r.id);
  };

  const exportCsv = (ev) => {
    const rows = regs.filter((r) => r.event_id === ev.id);
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' })),
      download: `${ev.title.toLowerCase().replace(/\W+/g, '-')}-rsvps.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const renderCard = (ev) => {
    const c = counts[ev.id] || { confirmed: 0, waitlist: 0 };
    return (
      <article className={`sys-event ${ev.is_active ? '' : 'is-off'}`} key={ev.id}>
        <div className="sys-event__head">
          <div>
            <h3>{ev.title}</h3>
            <p className="sys-muted">
              {formatEventDate(ev.event_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {ev.start_time ? ` · ${ev.start_time}` : ''} · {ev.venue || 'Venue TBA'}
            </p>
          </div>
          <button className="sys-icon-btn" onClick={() => setEditing({ ...blank, ...ev, capacity: ev.capacity ?? '' })} aria-label="Edit"><Pencil size={16} /></button>
        </div>
        <div className="sys-event__chips">
          <button className={`sys-chip ${ev.date_public ? 'is-on' : ''}`} onClick={() => quick(ev, { date_public: !ev.date_public })}>
            {ev.date_public ? <Eye size={14} /> : <EyeOff size={14} />} {ev.date_public ? 'Date announced' : ev.month_public ? 'Shows the month only' : 'Shows “Coming soon”'}
          </button>
          {!ev.date_public && (
            <button className={`sys-chip ${ev.month_public ? 'is-on' : ''}`} onClick={() => quick(ev, { month_public: !ev.month_public })} title="Say which month it is in before the date is set">
              <CalendarClock size={14} /> {ev.month_public ? `${formatEventDate(ev.event_date, { month: 'long' })} announced` : 'Announce the month'}
            </button>
          )}
          <button className={`sys-chip ${ev.rsvp_enabled !== false ? 'is-on' : ''}`} onClick={() => quick(ev, { rsvp_enabled: ev.rsvp_enabled === false })}>
            <Ticket size={14} /> RSVPs {ev.rsvp_enabled !== false ? 'open' : 'closed'}
          </button>
          <button className={`sys-chip ${ev.is_active ? 'is-on' : ''}`} onClick={() => quick(ev, { is_active: !ev.is_active })}>
            {ev.is_active ? 'Published' : 'Hidden'}
          </button>
        </div>
        <div className="sys-event__stats">
          <button className="sys-linkbtn" onClick={() => setViewing(viewing === ev.id ? null : ev.id)}>
            <Users size={15} /> {c.confirmed} going{ev.capacity ? ` of ${ev.capacity}` : ''}{c.waitlist ? ` · ${c.waitlist} waitlist` : ''}
          </button>
          {c.confirmed + c.waitlist > 0 && <button className="sys-linkbtn" onClick={() => exportCsv(ev)}><Download size={15} /> CSV</button>}
          <button className="sys-linkbtn" onClick={() => setLineupFor(lineupFor === ev.id ? null : ev.id)}><Store size={15} /> Lineup{ev.lineup_public ? ' · public' : ''}</button>
        </div>
        {lineupFor === ev.id && <EventLineup event={ev} onEventChanged={(patch) => quick(ev, patch)} />}
        {viewing === ev.id && (
          <ul className="sys-list sys-event__regs">
            {regs.filter((r) => r.event_id === ev.id).map((r) => (
              <li key={r.id}>
                <span><strong>{r.full_name}</strong> · {r.email}{r.guests > 1 ? ` · +${r.guests - 1}` : ''}</span>
                <select value={r.status} onChange={(e) => setRegStatus(r, e.target.value)} aria-label="Status">
                  <option value="confirmed">Going</option>
                  <option value="waitlist">Waitlist</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </li>
            ))}
            {!regs.some((r) => r.event_id === ev.id) && <li className="sys-muted">No RSVPs yet.</li>}
          </ul>
        )}
      </article>
    );
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head sys-row sys-row--center">
        <div>
          <p className="sys-eyebrow">Events</p>
          <h1>Markets &amp; RSVPs</h1>
          <p className="sys-muted">Dates stay “Coming soon” on the site until you turn on <em>Date announced</em>.</p>
        </div>
        <button className="sys-btn sys-btn--gold" onClick={() => setEditing({ ...blank })}><Plus size={16} /> New market</button>
      </header>
      <TicketSales />

      {msg && <p className="sys-ok" onAnimationEnd={() => setMsg('')}><Check size={16} /> {msg}</p>}
      {error && <p className="sys-error">{error}</p>}

      {upcoming.length === 0 && <p className="sys-empty">No upcoming markets. Add one to show it on the site.</p>}
      <div className="sys-results">{upcoming.map(renderCard)}</div>

      {past.length > 0 && (
        <details className="sys-past">
          <summary>Past markets ({past.length})</summary>
          <div className="sys-results">{past.map(renderCard)}</div>
        </details>
      )}

      {editing && (
        <div className="sys-modal" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <form className="sys-modal__panel sys-form" onSubmit={save}>
            <div className="sys-row sys-row--center">
              <h2><CalendarClock size={18} /> {editing.id ? 'Edit market' : 'New market'}</h2>
              <button type="button" className="sys-icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <label className="sys-field"><span>Name</span>
              <input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Winter Gala" />
            </label>
            <div className="sys-row">
              <label className="sys-field sys-grow"><span>Date</span>
                <input required type="date" value={editing.event_date} onChange={(e) => setEditing({ ...editing, event_date: e.target.value })} />
              </label>
              <label className="sys-field sys-grow"><span>Start time</span>
                <input value={editing.start_time || ''} onChange={(e) => setEditing({ ...editing, start_time: e.target.value })} placeholder="3:30 PM" />
              </label>
            </div>
            <div className="sys-row">
              <label className="sys-field sys-grow"><span>Vendors check in by</span>
                <input value={editing.load_in || ''} onChange={(e) => setEditing({ ...editing, load_in: e.target.value })} placeholder="3:15 PM" disabled={editing.has_vendors === false} />
              </label>
            </div>
            <label className="sys-field"><span>Venue</span>
              <input value={editing.venue || ''} onChange={(e) => setEditing({ ...editing, venue: e.target.value })} placeholder="Embassy Suites" />
            </label>
            <label className="sys-field"><span>Address</span>
              <input value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} placeholder="2029 Satellite Blvd, Duluth, GA 30097" />
            </label>
            <label className="sys-field"><span>Description</span>
              <textarea rows={3} value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </label>
            <div className="sys-row">
              <label className="sys-field sys-grow"><span>Capacity (blank = unlimited)</span>
                <input type="number" min="1" value={editing.capacity} onChange={(e) => setEditing({ ...editing, capacity: e.target.value })} />
              </label>
              <label className="sys-field sys-grow"><span>External ticket link (optional)</span>
                <input type="url" value={editing.rsvp_url || ''} onChange={(e) => setEditing({ ...editing, rsvp_url: e.target.value })} placeholder="https://eventbrite.com/…" />
              </label>
            </div>
            <div className="sys-toggles">
              <label><input type="checkbox" checked={!!editing.date_public} onChange={(e) => setEditing({ ...editing, date_public: e.target.checked })} /> Date announced (show date &amp; time publicly)</label>
              <label><input type="checkbox" checked={!!editing.month_public} onChange={(e) => setEditing({ ...editing, month_public: e.target.checked })} /> Month announced (the site says “December · date coming soon” until the date is)</label>
              <label><input type="checkbox" checked={editing.rsvp_enabled !== false} onChange={(e) => setEditing({ ...editing, rsvp_enabled: e.target.checked })} /> Accept RSVPs on the site</label>
              <label><input type="checkbox" checked={editing.has_vendors !== false} onChange={(e) => setEditing({ ...editing, has_vendors: e.target.checked })} /> Has vendors (lineup, registrations, survey invitations when the date is announced)</label>
              <label><input type="checkbox" checked={!!editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Published</label>
            </div>
            <div className="adm-actions" style={{ justifyContent: 'space-between' }}>
              <button className="sys-btn sys-btn--gold">Save market</button>
              {editing.id && (
                <DeleteRecord what={`${editing.title}`} note="Its lineup and RSVPs go with it. Registrations, feedback and volunteers stay, without the market." label="Delete market"
                  onDelete={() => supabase.from('market_events').delete({ count: 'exact' }).eq('id', editing.id)}
                  onDone={() => { setEditing(null); setMsg('Deleted.'); load(); }} />
              )}
            </div>
            <p className="sys-muted" style={{ margin: 0 }}>To take it off the site but keep everything, untick Published instead.</p>
          </form>
        </div>
      )}
    </div>
  );
};

export default Events;
