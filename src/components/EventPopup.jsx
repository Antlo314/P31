import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ArrowUpRight, Clock, MapPin } from 'lucide-react';
import { fetchUpcomingEvents, formatEventDate, parseEventDate, showDate } from '../lib/events';
import { gsap, reducedMotion } from '../lib/motion';
import './EventPopup.css';

// The Marketplace's opening pop-up: an invitation to the next ticketed event
// (Systems → Markets & events). It shows only when the next event has its date
// announced and a ticket link, once per visit, shortly after the page opens.
// The event's image (market_events.image_url) is its flyer; the card is styled
// like it — blush paper, a pinned note, a pink ring round the date.
// The newsletter sign-up (LeadPopup) opens only from its buttons.
const QUIET = ['/login', '/register', '/dashboard', '/systems', '/onboarding-exclusive', '/unsubscribe', '/portal', '/enroll', '/academy', '/studio', '/checkout'];
const DELAY_MS = 1500;
const seenKey = (ev) => `p31_event_popup_${ev.id}`;

const EventPopup = () => {
  const { pathname } = useLocation();
  const [event, setEvent] = useState(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const closing = useRef(null);
  const quiet = QUIET.some((r) => pathname.startsWith(r));

  useEffect(() => {
    let alive = true;
    fetchUpcomingEvents().then((rows) => {
      const next = rows.find((ev) => showDate(ev) && ev.rsvp_url);
      if (alive) setEvent(next || null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!event || quiet) return undefined;
    let seen = false;
    try { seen = !!sessionStorage.getItem(seenKey(event)); } catch { /* storage blocked */ }
    if (seen) return undefined;
    const timer = setTimeout(() => {
      setOpen(true);
      try { sessionStorage.setItem(seenKey(event), '1'); } catch { /* storage blocked */ }
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, [event, quiet]);

  const close = useCallback(() => {
    if (closing.current) return;
    const finish = () => { closing.current = null; setOpen(false); };
    if (reducedMotion() || !rootRef.current) return finish();
    const phone = window.innerWidth < 760;
    closing.current = gsap.timeline({ onComplete: finish })
      .to(panelRef.current, phone
        ? { y: '100%', duration: 0.42, ease: 'power3.in' }
        : { y: 30, scale: 0.96, opacity: 0, duration: 0.4, ease: 'power3.in' })
      .to(rootRef.current, { opacity: 0, duration: 0.28, ease: 'power1.out' }, '-=0.18');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    let ctx;
    if (!reducedMotion()) {
      // The flyer is pinned up with a little swing, the note slides in beside
      // it, and the pink ring is drawn round the date.
      ctx = gsap.context(() => {
        const phone = window.innerWidth < 760;
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' })
          .fromTo(panelRef.current, phone ? { y: '100%' } : { y: 50, scale: 0.94, opacity: 0 },
            { y: 0, scale: 1, opacity: 1, duration: phone ? 0.9 : 1.1 }, 0.05)
          .fromTo('.ep2__flyer', { rotate: phone ? 0 : -9, y: -24, opacity: 0 }, { rotate: phone ? 0 : -2.5, y: 0, opacity: 1, duration: 1.3, ease: 'elastic.out(1, 0.6)' }, 0.25)
          .fromTo('.ep2__tape', { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power3.out' }, 0.8)
          .fromTo('.ep2__in', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.07 }, 0.45)
          .fromTo('.ep2__ring ellipse', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0.9);
      }, rootRef);
    }
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      ctx?.revert();
    };
  }, [open, close]);

  if (!open || !event || quiet) return null;

  const d = parseEventDate(event.event_date);
  const shortDate = `${d.getMonth() + 1} / ${d.getDate()} / ${String(d.getFullYear()).slice(2)}`;
  const day = formatEventDate(event.event_date, { weekday: 'long', month: 'long', day: 'numeric' });
  // "Business and Leadership Luncheon" → "Business and Leadership" + a spaced-out "LUNCHEON".
  const words = event.title.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : '';

  return (
    <div className="ep2" ref={rootRef} onClick={(e) => e.target === e.currentTarget && close()} role="dialog" aria-modal="true" aria-labelledby="ep2-title">
      <div className={`ep2__panel${event.image_url ? '' : ' ep2__panel--plain'}`} ref={panelRef}>
        <div className="ep2__grip" aria-hidden="true" />
        <button type="button" className="ep2__close" onClick={close} aria-label="Close"><X size={18} /></button>

        {event.image_url && (
          <a className="ep2__flyer" href={event.rsvp_url} target="_blank" rel="noreferrer" onClick={close} aria-label={`${event.title} flyer: get tickets`}>
            <span className="ep2__tape" aria-hidden="true" />
            <img src={event.image_url} alt={`${event.title} flyer`} />
          </a>
        )}

        <div className="ep2__note">
          <span className="ep2__pin" aria-hidden="true" />
          <p className="ep2__eyebrow ep2__in"><span>Save the date</span><i aria-hidden="true" /><b aria-hidden="true">✦</b></p>
          <h2 id="ep2-title" className="ep2__title ep2__in">
            <span className="ep2__title-main">{words.join(' ')}</span>
            {last && <span className="ep2__title-last">{last}</span>}
          </h2>

          <div className="ep2__when ep2__in">
            <span className="ep2__date">
              {shortDate}
              <svg className="ep2__ring" viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true">
                <ellipse cx="100" cy="35" rx="96" ry="31" pathLength="1" strokeDasharray="1" />
              </svg>
            </span>
            <span className="ep2__day">{day}</span>
          </div>

          <ul className="ep2__facts ep2__in">
            {event.start_time && <li><span className="ep2__dot"><Clock size={15} /></span>{event.start_time}</li>}
            {(event.venue || event.address) && (
              <li><span className="ep2__dot"><MapPin size={15} /></span>
                <span><strong>{event.venue}</strong>{event.address && <small>{event.address}</small>}</span>
              </li>
            )}
          </ul>

          <div className="ep2__actions ep2__in">
            <a className="ep2__cta" href={event.rsvp_url} target="_blank" rel="noreferrer" onClick={close}>
              Get tickets <ArrowUpRight size={18} />
            </a>
            <button type="button" className="ep2__later" onClick={close}>Maybe later</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventPopup;
