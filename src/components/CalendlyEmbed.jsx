import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { CALENDLY, calendlyUrl, loadCalendly, watchBookings } from '../lib/calendly';
import './CalendlyEmbed.css';

/** An inline Calendly calendar that loads when it scrolls into view. */
const CalendlyEmbed = ({ kind, name, email, source, height = 720 }) => {
  const ref = useRef(null);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const url = calendlyUrl(kind, { name, email, source });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let live = true;
    const start = () => {
      setState('loading');
      watchBookings({ kind, name, email });
      loadCalendly().then((C) => {
        if (!live) return;
        el.innerHTML = '';
        C.initInlineWidget({ url, parentElement: el });
        setState('ready');
      }).catch(() => live && setState('error'));
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => { live = false; io.disconnect(); };
  }, [url, kind, name, email]);

  return (
    <div className="cal-embed" style={{ '--cal-h': `${height}px` }}>
      <div ref={ref} className="cal-embed__frame" />
      {state !== 'ready' && (
        <div className="cal-embed__wait">
          <CalendarDays size={22} />
          {state === 'error'
            ? <p>The calendar didn’t load. <a href={url} target="_blank" rel="noopener noreferrer">Open {CALENDLY[kind].label} in Calendly</a></p>
            : <p>Loading available times…</p>}
        </div>
      )}
    </div>
  );
};

export default CalendlyEmbed;
