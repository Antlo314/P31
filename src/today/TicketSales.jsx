import React, { useEffect, useState } from 'react';
import { Ticket, ArrowUpRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './ticketSales.css';

const fmt = (d) => new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const daysTo = (d) => Math.round((new Date(`${String(d).slice(0, 10)}T12:00:00`) - new Date()) / 864e5);

/** Ticket sales for upcoming Eventbrite events (eventbrite-stats). Shows nothing until the function answers. */
const TicketSales = ({ compact = false }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    let live = true;
    supabase.functions.invoke('eventbrite-stats', { body: {} })
      .then(({ data: d, error }) => { if (live) setData(error ? { failed: true } : d); })
      .catch(() => live && setData({ failed: true }));
    return () => { live = false; };
  }, []);

  if (!data || data.failed) return null;
  if (!data.configured) {
    return compact ? null : (
      <div className="tk tk--setup" data-tour="tickets">
        <Ticket size={18} />
        <p><strong>Ticket sales from Eventbrite can show here.</strong> Create a private token in Eventbrite (Account settings → Developer links → API keys) and add it in Supabase as the secret EVENTBRITE_TOKEN.</p>
      </div>
    );
  }
  if (!data.events?.length) return null;
  return (
    <div className="tk" data-tour="tickets">
      {data.events.map((e) => {
        const pct = e.total ? Math.min(100, Math.round((e.sold / e.total) * 100)) : null;
        const d = daysTo(e.event_date);
        return (
          <a key={e.id} className="tk__event" href={e.url} target="_blank" rel="noreferrer">
            <span className="tk__icon"><Ticket size={18} /></span>
            <span className="tk__main">
              <strong>{e.title}</strong>
              {e.error ? <small>{e.error}</small> : (
                <>
                  <small>{e.sold} ticket{e.sold === 1 ? '' : 's'} sold{e.total ? ` of ${e.total}` : ''} · {fmt(e.event_date)}{d >= 0 ? ` · ${d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} to go`}` : ''}</small>
                  {pct != null && <span className="tk__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>}
                  {!compact && e.classes?.length > 1 && <small className="tk__classes">{e.classes.map((c) => `${c.name}: ${c.sold}${c.total ? `/${c.total}` : ''}`).join(' · ')}</small>}
                </>
              )}
            </span>
            <ArrowUpRight size={15} className="tk__go" />
          </a>
        );
      })}
    </div>
  );
};

export default TicketSales;
