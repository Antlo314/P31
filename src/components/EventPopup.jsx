import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';
import { fetchUpcomingEvents, formatEventDate, showDate } from '../lib/events';
import { gsap, reducedMotion } from '../lib/motion';
import { MELANIE } from '../lib/teamPhotos';
import './LeadPopup.css';

// The Marketplace's opening pop-up: an invitation to the next ticketed event
// (Systems → Markets & events). It shows only when the next event has its date
// announced and a ticket link, once per visit, shortly after the page opens.
// The newsletter sign-up (LeadPopup) now opens only from its buttons.
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
        : { y: 26, scale: 0.95, opacity: 0, duration: 0.4, ease: 'power3.in' })
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
      ctx = gsap.context(() => {
        const phone = window.innerWidth < 760;
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.out' })
          .fromTo(panelRef.current, phone
            ? { y: '100%' }
            : { y: 60, rotateX: 14, scale: 0.92, opacity: 0, transformOrigin: '50% 100%' },
          { y: 0, rotateX: 0, scale: 1, opacity: 1, duration: phone ? 0.95 : 1.2 }, 0.05)
          .fromTo('.lp2__foil', { clipPath: 'inset(0% 50% 0% 50%)', opacity: 0 }, { clipPath: 'inset(0% 0% 0% 0%)', opacity: 0.7, duration: 1.4, ease: 'power3.inOut' }, 0.3)
          .fromTo('.lp2__media', { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 24px 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 24px 24px)', duration: 1.3 }, 0.3)
          .fromTo('.lp2__sheen', { xPercent: -160 }, { xPercent: 360, duration: 1.3, ease: 'power2.inOut' }, 1.0)
          .fromTo('.lp2__title', { opacity: 0, y: 26, filter: 'blur(12px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out' }, 0.5)
          .fromTo('.lp2__title em', { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 1.6, ease: 'power2.inOut' }, 0.8)
          .fromTo('.lp2__in:not(.lp2__title)', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.07 }, 0.65);
      }, rootRef);
    }
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      ctx?.revert();
    };
  }, [open, close]);

  if (!open || !event || quiet) return null;

  // "Business and Leadership Luncheon" → "Business and Leadership" + gold "Luncheon".
  const words = event.title.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : '';
  const day = formatEventDate(event.event_date, { weekday: 'long', month: 'long', day: 'numeric' });
  const where = [event.venue, event.address || event.location].filter(Boolean);

  return (
    <div className="lp2 ep" ref={rootRef} onClick={(e) => e.target === e.currentTarget && close()} role="dialog" aria-modal="true" aria-labelledby="ep-title">
      <div className="lp2__panel k-dark" ref={panelRef}>
        <span className="lp2__foil" aria-hidden="true" />
        <div className="lp2__grip" aria-hidden="true" />
        <button className="k-close lp2__close" onClick={close} aria-label="Close"><X size={18} /></button>

        <aside className="lp2__side">
          <div className="lp2__media"><img src={event.image_url || MELANIE.portrait} alt="" /><span className="lp2__sheen" aria-hidden="true" /></div>
          <figure className="lp2__verse lp2__in">
            <blockquote>“She is clothed with strength and dignity.”</blockquote>
            <figcaption>Proverbs 31:25</figcaption>
          </figure>
        </aside>

        <div className="lp2__main">
          <p className="k-eyebrow lp2__in">You’re invited</p>
          <h2 id="ep-title" className="k-h2 lp2__title lp2__in">{words.join(' ')}{last && <> <em>{last}</em></>}</h2>
          <ul className="ep__facts lp2__in">
            <li><CalendarDays size={16} /> <span>{day}{event.start_time ? ` · ${event.start_time}` : ''}</span></li>
            {where.length > 0 && <li><MapPin size={16} /> <span>{where.join(' · ')}</span></li>}
          </ul>
          {event.description && <p className="k-body ep__desc lp2__in">{event.description}</p>}
          <div className="ep__actions lp2__in">
            <a className="k-btn k-btn--gold k-btn--lg k-btn--block" href={event.rsvp_url} target="_blank" rel="noreferrer" onClick={close}>
              Get tickets <ArrowUpRight size={18} />
            </a>
            <button type="button" className="ep__later" onClick={close}>Maybe later</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventPopup;
