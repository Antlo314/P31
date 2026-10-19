import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Lock, Play } from 'lucide-react';
import { fetchUpcomingEvents, parseEventDate, showDate, showMonth, monthLabel, ticketLabel } from '../lib/events';
import { openCalendly } from '../lib/calendly';
import { PROGRAMS } from '../academy/content';
import { MELANIE, HEADSHOTS } from '../lib/teamPhotos';
import JoinCollective from '../components/JoinCollective';
import PodcastFeature from '../components/PodcastFeature';
import mark from '../assets/academy/collective-mark.webp';
import community from '../assets/web/p31_community_impact_editorial_1776544076592.webp';
import partner from '../assets/web/p31_partner_hero_editorial.webp';
import './collective-preview.css';

// PREVIEW ONLY (dev server, /preview/home on the Collective): a new thep31collective.org home.
// After MotionSites "Church Community": warm light over a dark ground, cream accents, light large type,
// a portrait-and-quote panel, and an Upcoming list with date tiles. Every word and date is the site's own.
const Typed = ({ text, delay = 0, speed = 28 }) => {
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(still ? text.length : 0);
  useEffect(() => {
    if (still) return undefined;
    let i = 0; let timer;
    const start = setTimeout(() => { timer = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(timer); }, speed); }, delay);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [text, delay, speed, still]);
  return <span aria-label={text}><span aria-hidden="true">{text.slice(0, n)}</span><span aria-hidden="true" className="cp-ghost">{text.slice(n)}</span></span>;
};

const CollectiveHomePreview = () => {
  const [events, setEvents] = useState([]);
  useEffect(() => { fetchUpcomingEvents().then(setEvents); }, []);
  const faces = [HEADSHOTS.melanie, HEADSHOTS.a, HEADSHOTS.c].filter(Boolean);

  return (
    <div className="cp">
      {/* ── Hero ── */}
      <section className="cp-hero">
        <div className="cp-hero__photo"><img src={community} alt="Women gathered at a P31 Collective event" /></div>
        <div className="cp-hero__copy">
          <img src={mark} alt="" className="cp-mark" />
          <div className="cp-faces" aria-label="The P31 team">
            {faces.map((f) => <img key={f} src={f} alt="" />)}
            <JoinCollective className="cp-plus" label="" size={18} />
          </div>
          <h1><Typed text="Take a step toward your calling" delay={300} /></h1>
          <p>Mentorship, healing and fellowship for faith-driven women. A place to grow in purpose and know that you belong.</p>
          <div className="cp-acts">
            <JoinCollective className="cp-btn" label="Join the Collective" />
            <button type="button" className="cp-btn cp-btn--line" onClick={() => openCalendly('intro', { source: 'preview-hero' })}>Book an intro call <ArrowUpRight size={18} /></button>
          </div>
        </div>
      </section>

      {/* ── Founder panel: rotated name, portrait, quote, white card ── */}
      <section className="cp-voice">
        <div className="cp-voice__dark">
          <p className="cp-voice__side"><b>Melanie JC</b> Founder &amp; CEO</p>
          <div className="cp-voice__portrait"><img src={MELANIE.portrait} alt="Melanie JC" loading="lazy" /></div>
          <div className="cp-voice__quote">
            <span className="cp-quote-mark" aria-hidden="true">“</span>
            <blockquote>Heal. Rise. Build. Prosper God’s Way.</blockquote>
            <p>In 2019 she founded Not Easily Broken Apart (NEBA) Women’s Ministry for healing, restoration and purposeful living. The Collective is where that calling continues: a movement of women who build, lead and prosper God’s way.</p>
          </div>
        </div>
        <Link to="/join" className="cp-card">
          <small>Membership · $27/month</small>
          <h2>Monthly gatherings, a sisterhood, and room to grow.</h2>
          <span className="cp-more">Learn more <ArrowUpRight size={18} /></span>
          <span className="cp-star" aria-hidden="true">✳</span>
        </Link>
      </section>

      {/* ── Upcoming (live dates) ── */}
      {events.length > 0 && (
        <section className="cp-up">
          <div className="cp-up__media">
            <img src={partner} alt="" loading="lazy" />
            <a className="cp-play" href="https://www.instagram.com/the.p31collective" target="_blank" rel="noreferrer" aria-label="Watch on Instagram"><Play size={24} fill="currentColor" /></a>
          </div>
          <div className="cp-up__body">
            <div className="cp-up__band"><h2>Upcoming</h2></div>
            <ul>
              {events.slice(0, 4).map((e, i) => {
                const d = parseEventDate(e.event_date);
                return (
                  <li key={e.id || e.title} className={i === 3 ? 'is-faded' : ''}>
                    <span className={`cp-date ${i === 0 ? 'is-white' : ''}`}>
                      {showDate(e) ? <><b>{d.getDate()}</b><small>{d.toLocaleDateString('en-US', { month: 'short' })}</small></> : <><b>{d.toLocaleDateString('en-US', { month: 'short' })}</b><small>{showMonth(e) ? 'soon' : 'tba'}</small></>}
                    </span>
                    <div>
                      <strong>{e.title}</strong>
                      <small>{showDate(e) ? [e.start_time, e.venue || e.location].filter(Boolean).join(' · ') || 'Details coming soon' : showMonth(e) ? `${monthLabel(e, { month: 'long', year: 'numeric' })} · date coming soon` : 'Date coming soon'}</small>
                    </div>
                    {e.ticket_url && <a href={e.ticket_url} target="_blank" rel="noreferrer" className="cp-link">{ticketLabel(e.ticket_url)} <ArrowUpRight size={14} /></a>}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ── Two paths ── */}
      <section className="cp-paths">
        <p className="cp-eyebrow">Private mentorship</p>
        <h2>Two paths, one calling</h2>
        <div className="cp-paths__grid">
          {Object.values(PROGRAMS).map((p, i) => (
            <Link key={p.slug} to={`/mentorship/${p.slug}`} className={`cp-path ${i === 0 ? 'is-dark' : ''}`}>
              <span className="cp-path__n">0{i + 1}</span>
              <small>{p.pillars.join(' · ')}</small>
              <h3>{p.title} {p.accent}</h3>
              <p>{p.short}</p>
              <span className="cp-more">Explore <ArrowRight size={16} /></span>
            </Link>
          ))}
        </div>
        <button type="button" className="cp-btn" onClick={() => openCalendly('intro', { source: 'preview-paths' })}>Begin with an intro call <ArrowUpRight size={18} /></button>
      </section>

      <PodcastFeature />

      {/* ── Close ── */}
      <section className="cp-close">
        <p className="cp-eyebrow">Our vision scripture</p>
        <blockquote>“Many daughters have done virtuously, but thou excellest them all.”</blockquote>
        <p className="cp-cite">Proverbs 31:29 KJV</p>
        <JoinCollective className="cp-btn" label="Join the Collective" />
        <p className="cp-team"><Link to="/portal"><Lock size={13} /> Member portal</Link></p>
      </section>
    </div>
  );
};

export default CollectiveHomePreview;
