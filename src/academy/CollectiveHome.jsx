import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Lock, Play, CalendarDays, Handshake, Video, Instagram, UserPlus } from 'lucide-react';
import { fetchUpcomingEvents, parseEventDate, showDate, showMonth, monthLabel, ticketLabel } from '../lib/events';
import { CALENDLY, openCalendly } from '../lib/calendly';
import { marketHome } from '../lib/site';
import { JOIN_PATH } from '../lib/academy';
import { formatMonthly, useSiteInfo } from '../lib/siteInfo';
import { PROGRAMS } from './content';
import { MELANIE, AVATARS } from '../lib/teamPhotos';
import JoinCollective from '../components/JoinCollective';
import PodcastFeature from '../components/PodcastFeature';
import TeamDirectory from '../components/TeamDirectory';
import mark from '../assets/academy/collective-mark.webp';
import community from '../assets/web/p31_community_impact_editorial_1776544076592.webp';
import partner from '../assets/web/p31_partner_hero_editorial.webp';
import './collective-landing.css';

// thep31collective.org home (2026-10-19), after the MotionSites "Church Community" design: warm light over a
// dark ground, cream accents, light large type, a portrait-and-quote panel, and an Upcoming list with date
// tiles. Every word, date and face is the site's own; events come live from market_events.

/** The headline types itself in; the untyped part keeps its space so nothing moves. */
const Typed = ({ text, delay = 0, speed = 28 }) => {
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(still ? text.length : 0);
  useEffect(() => {
    if (still) return undefined;
    let i = 0; let timer;
    const start = setTimeout(() => { timer = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(timer); }, speed); }, delay);
    return () => { clearTimeout(start); clearInterval(timer); };
  }, [text, delay, speed, still]);
  return <span><span className="cp-sr">{text}</span><span aria-hidden="true">{text.slice(0, n)}</span><span aria-hidden="true" className="cp-ghost">{text.slice(n)}</span></span>;
};

const CollectiveHome = () => {
  // null while market_events loads: the Upcoming section is drawn from the first paint and only fills in, so nothing below jumps.
  const [events, setEvents] = useState(null);
  const info = useSiteInfo(); // Instagram link and membership price: Systems > Site info
  useEffect(() => {
    let live = true;
    fetchUpcomingEvents().then((rows) => { if (live) setEvents(rows); }, () => { if (live) setEvents([]); });
    return () => { live = false; };
  }, []);
  const faces = [AVATARS.melanie, AVATARS.a, AVATARS.c].filter(Boolean);

  return (
    <div className="cp">
      {/* ── Hero ── */}
      <section className="cp-hero">
        <div className="cp-hero__photo"><img src={community} alt="Women gathered at a P31 Collective event" fetchPriority="high" /></div>
        <div className="cp-hero__copy">
          <img src={mark} alt="" className="cp-mark" />
          <div className="cp-faces" role="group" aria-label="The P31 team">
            {faces.map((f) => <img key={f} src={f} alt="" width="52" height="52" decoding="async" />)}
            <Link to={JOIN_PATH} className="cp-plus" aria-label="Join the Collective"><UserPlus size={18} aria-hidden="true" /></Link>
          </div>
          <p className="cp-eyebrow">The Proverbs 31 Collective by NEBA</p>
          <h1><Typed text="Take a step toward your calling" delay={300} /></h1>
          <p className="cp-lede">Mentorship, healing and fellowship for faith-driven women. A place to grow in purpose, build what God has placed in your hands, and know that you belong.</p>
          <div className="cp-acts">
            <JoinCollective className="cp-btn" label="Join the Collective" />
            <button type="button" className="cp-btn cp-btn--line" onClick={() => openCalendly('intro', { source: 'home-hero' })}>Book an intro call <ArrowUpRight size={18} /></button>
          </div>
        </div>
      </section>

      {/* ── Founder panel: rotated name, portrait, quote, membership card ── */}
      <section className="cp-voice" id="melanie" aria-labelledby="melanie-title">
        <div className="cp-voice__dark">
          <h2 className="cp-voice__side" id="melanie-title"><b>Melanie JC</b> Founder &amp; CEO</h2>
          <div className="cp-voice__portrait"><img src={MELANIE.portrait} alt="Melanie JC, founder of The P31 Collective" loading="lazy" decoding="async" /></div>
          <div className="cp-voice__quote">
            <span className="cp-quote-mark" aria-hidden="true">“</span>
            <blockquote>Heal. Rise. Build. Prosper God’s Way.</blockquote>
            <p>In 2019 she founded Not Easily Broken Apart (NEBA) Women’s Ministry for healing, restoration and purposeful living. The Collective is where that calling continues: a movement of women who build, lead and prosper God’s way.</p>
            <details className="cp-story">
              <summary>Read her full story</summary>
              <p>A passionate servant of God, visionary, mentor, and entrepreneur, Melanie JC is a woman driven by purpose, anchored in faith, and led by obedience. In 2019, she founded Not Easily Broken Apart (NEBA) Women’s Ministry, a faith-based ministry dedicated to healing, restoration, and purposeful living through biblical teaching and intentional mentorship. As a spiritual matriarch with a heart for cultivating spiritual and emotional wholeness, she has devoted herself to helping individuals break cycles, discover their God-given identity, and walk boldly in their calling.</p>
              <p>As the visionary behind Proverbs 31 Marketplace and The P31 Collective by NEBA, Melanie has expanded that mission to bridge faith, fellowship, purpose, and business. What began as a calling to help women heal has evolved into a movement empowering women to build, lead, and prosper God’s way. Through marketplace experiences, meaningful connections, business mentorship, and community, she is cultivating an environment where faith-driven women are equipped to turn their gifts into purpose-filled endeavors.</p>
              <p>Melanie is also the CEO of Incandescent Lily Collection, a plant-based body care brand established in 2023. With a foundation in theological education through her seminary studies, complemented by academic achievements in Emotional Intelligence, the Arts and Science of Relationships, and Leadership, she brings both biblical wisdom and practical insight to her work. As a visionary and matriarch, she believes that true leadership is cultivated through spiritual maturity, intentional stewardship, and, above all, obedience to God.</p>
              <p>Her mission extends beyond building businesses; it is about building people. As a matriarch, mentor and Kingdom builder, she is committed to empowering women to heal spiritually, grow emotionally, prosper financially, and establish legacies that will impact generations to come.</p>
              <p>For Melanie, success is not merely measured by what she acquires, but by what she stewards, whom she serves, and what she leaves behind.</p>
            </details>
            <div className="cp-voice__links">
              <button type="button" className="cp-textlink" onClick={() => openCalendly('connect', { source: 'meet-melanie' })}><Handshake size={16} /> Connect with Melanie JC</button>
              <a className="cp-textlink" href={info.collectiveInstagram} target="_blank" rel="noreferrer"><Instagram size={16} /> Follow along</a>
            </div>
          </div>
        </div>
        <Link to="/join" className="cp-card">
          <small>Membership · {formatMonthly(info.membershipMonthly)}/month</small>
          <h2>Monthly gatherings, a sisterhood, and room to grow.</h2>
          <span className="cp-more">Learn more <ArrowUpRight size={18} /></span>
          <span className="cp-star" aria-hidden="true">✳</span>
        </Link>
      </section>

      {/* ── Upcoming (live dates) ── */}
      <section className="cp-up" id="upcoming" aria-busy={events === null}>
        <div className="cp-up__media">
          <img src={partner} alt="" loading="lazy" decoding="async" />
          <a className="cp-play" href={info.collectiveInstagram} target="_blank" rel="noreferrer" aria-label="Watch the Collective on Instagram"><Play size={24} fill="currentColor" /></a>
        </div>
        <div className="cp-up__body">
          <div className="cp-up__band"><h2>Upcoming</h2></div>
          <ul>
            {events?.length === 0 && (
              <li>
                <span className="cp-date is-white" aria-hidden="true"><b>✳</b></span>
                <div><strong>New dates coming soon</strong><small>Follow @the.p31collective for the next gathering</small></div>
              </li>
            )}
            {(events || []).slice(0, 4).map((e, i) => {
              const d = parseEventDate(e.event_date);
              return (
                <li key={e.id || e.title} className={i === 3 ? 'is-faded' : ''}>
                  <span className={`cp-date ${i === 0 ? 'is-white' : ''}`}>
                    {showDate(e)
                      ? <><b>{d.getDate()}</b><small>{d.toLocaleDateString('en-US', { month: 'short' })}</small></>
                      : showMonth(e)
                        ? <><b>{d.toLocaleDateString('en-US', { month: 'short' })}</b><small>soon</small></>
                        : <><b aria-hidden="true">✳</b><small>soon</small></>}
                  </span>
                  <div>
                    <strong>{e.title}</strong>
                    <small>{showDate(e) ? [e.start_time, e.venue || e.location].filter(Boolean).join(' · ') || 'Details coming soon' : showMonth(e) ? `${monthLabel(e, { month: 'long', year: 'numeric' })} · date coming soon` : 'Date coming soon'}</small>
                  </div>
                  {e.rsvp_url && <a href={e.rsvp_url} target="_blank" rel="noreferrer" className="cp-link">{ticketLabel(e.rsvp_url)} <ArrowUpRight size={14} /></a>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Two paths ── */}
      <section className="cp-paths">
        <p className="cp-eyebrow">Private mentorship</p>
        <h2>Two paths, one calling</h2>
        <p className="cp-paths__lede">Private mentorship that begins with a conversation. Book an intro call and we’ll find the right fit for your season.</p>
        <div className="cp-paths__grid">
          {Object.values(PROGRAMS).map((p, i) => (
            <Link key={p.slug} to={`/mentorship/${p.slug}`} className={`cp-path ${i === 0 ? 'is-dark' : ''}`}>
              <span className="cp-path__n">0{i + 1}</span>
              <small>{p.pillars.map((x) => x.replace(/ /g, '\u00A0')).join('\u00A0· ')}</small>
              <h3>{p.title} {p.accent}</h3>
              <p>{p.short}</p>
              <span className="cp-more">Explore the mentorship <ArrowRight size={16} /></span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Ways to connect ── */}
      <section className="cp-book" id="book">
        <p className="cp-eyebrow">Ways to connect</p>
        <h2>Book a call</h2>
        <p className="cp-paths__lede">Pick a time that works for you — you’ll get a calendar invite right away.</p>
        <div className="cp-book__grid">
          <article className="cp-call is-cream">
            <CalendarDays size={22} />
            <small>{CALENDLY.intro.length} · open to everyone</small>
            <h3>Private Mentorship Intro Call</h3>
            <p>Talk through your goals and your season, and see whether the business or faith mentorship is the right fit.</p>
            <button type="button" className="cp-btn" onClick={() => openCalendly('intro', { source: 'book-section' })}>Book an intro call</button>
          </article>
          <article className="cp-call">
            <Handshake size={22} />
            <small>{CALENDLY.connect.length} · open to everyone</small>
            <h3>Connect or Collab with Melanie JC</h3>
            <p>Partnerships, collaborations, speaking and community — a conversation with Melanie directly.</p>
            <button type="button" className="cp-btn cp-btn--line" onClick={() => openCalendly('connect', { source: 'book-section' })}>Connect with Melanie JC</button>
          </article>
          <article className="cp-call">
            <Video size={22} />
            <small>{CALENDLY.session.length} or {CALENDLY.session90.length} · active mentees</small>
            <h3>Private Mentorship Session</h3>
            <p>Already enrolled? Schedule your one-on-one session from your classroom, where your details are filled in for you.</p>
            <Link to="/portal" className="cp-btn cp-btn--line"><Lock size={16} /> Sign in to schedule</Link>
          </article>
        </div>
      </section>

      <PodcastFeature />

      <section className="cp-team-section" id="team">
        <TeamDirectory eyebrow="The P31 team" lede="Reach the right person directly. We’re here Monday to Friday." portraits />
      </section>

      {/* ── Close ── */}
      <section className="cp-close">
        <p className="cp-eyebrow">Our vision scripture</p>
        <blockquote>“Many daughters have done virtuously, but thou excellest them all.”</blockquote>
        <p className="cp-cite">Proverbs 31:29 KJV</p>
        <JoinCollective className="cp-btn" label="Join the Collective" />
        <p className="cp-market">Looking for the market? <a href={marketHome()}>Visit Proverbs 31 Marketplace <ArrowUpRight size={14} /></a></p>
        <p className="cp-team"><Link to="/portal"><Lock size={13} /> Member portal</Link></p>
      </section>
    </div>
  );
};

export default CollectiveHome;
