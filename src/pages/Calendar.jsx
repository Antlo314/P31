import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Calendar.css';

import featuredImg from '../assets/p31_partner_hero_editorial_1776544063235.png';
import fallImg from '../assets/p31_community_impact_editorial_1776544076592.png';

gsap.registerPlugin(ScrollTrigger);

const Calendar = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Respect users who prefer reduced motion — leave everything visible
    // and skip the choreography entirely.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.from('.cal-head-v2 > *', {
        y: 32, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.cal-head-v2', start: 'top 88%' },
      });

      gsap.from('.cal-lineup .bento-cell', {
        y: 60, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.cal-lineup', start: 'top 82%' },
      });

      // Magnetic pointer-follow for the RSVP button
      gsap.utils.toArray('.magnetic').forEach(btn => {
        const strength = 0.3;
        const move = (e) => {
          const r = btn.getBoundingClientRect();
          gsap.to(btn, {
            x: (e.clientX - (r.left + r.width / 2)) * strength,
            y: (e.clientY - (r.top + r.height / 2)) * strength,
            duration: 0.5, ease: 'power3.out',
          });
        };
        const reset = () => gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
        btn.addEventListener('mousemove', move);
        btn.addEventListener('mouseleave', reset);
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="calendar-v2 container-fluid" ref={containerRef}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div className="cal-head-v2">
        <span className="section-kicker">The Events Lineup</span>
        <h1 className="cal-title-huge">The Experience</h1>
        <p className="cal-subtitle">Mark your calendars. A curated market unlike any other.</p>
      </div>

      {/* ── EVENTS LINEUP — bento ──────────────────────────── */}
      <div className="cal-lineup bento-grid">

        {/* Featured — Atlanta Summer Pop-Up */}
        <div className="bento-cell is-media col-8 row-3 cal-featured">
          <img src={featuredImg} alt="Atlanta Summer Pop-Up market showcase" />
          <div className="bento-overlay" />
          <div className="bento-content cal-feat-content">
            <span className="cal-feat-flag">Featured Event</span>

            <div className="cal-feat-datechip">
              <span className="cal-feat-day">28</span>
              <span className="cal-feat-month">August '26</span>
            </div>

            <h2 className="cal-feat-title">Atlanta Summer Pop-Up</h2>

            <ul className="cal-feat-meta">
              <li>
                <span className="material-symbols-outlined">location_on</span>
                Atlanta, GA
              </li>
              <li>
                <span className="material-symbols-outlined">schedule</span>
                10:00 AM &mdash; 4:00 PM EST
              </li>
            </ul>

            <p className="cal-feat-desc">
              Join us for our signature summer showcase. An exclusive outdoor sanctuary
              featuring 30+ elite women creatives, live music, and premium artisan goods.
            </p>

            <a
              href="https://www.eventbrite.com/e/proverbs-31-marketplace-tickets-1984190041828"
              target="_blank"
              rel="noreferrer"
              className="btn-solid-gold magnetic cal-rsvp"
            >
              RSVP Entry
            </a>
          </div>
        </div>

        {/* Supporting — Fall Collection Showcase (TBA) */}
        <div className="bento-cell is-media col-4 row-3 cal-tba">
          <img src={fallImg} alt="Fall Collection Showcase preview" />
          <div className="bento-overlay" />
          <div className="bento-content cal-tba-content">
            <span className="cal-tba-flag">Next on the Tour</span>

            <div className="cal-tba-datechip">
              <span className="cal-tba-day">TBA</span>
              <span className="cal-tba-month">Fall '26</span>
            </div>

            <h2 className="cal-tba-title">Fall Collection Showcase</h2>

            <ul className="cal-tba-meta">
              <li>
                <span className="material-symbols-outlined">location_on</span>
                Location TBA
              </li>
            </ul>

            <p className="cal-tba-desc">
              The tour continues. Highlighting seasonal apparel, rich fragrances,
              and luxury homeware for the autumn season.
            </p>

            <span className="cal-tba-badge">Dates announced soon</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Calendar;
