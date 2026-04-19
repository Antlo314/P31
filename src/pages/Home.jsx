import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Home.css';

import heroVid     from '../assets/hero.mp4';
import faithVid    from '../assets/faith.mp4';
import missionVid  from '../assets/p31market.mp4';
import visionaryVid from '../assets/visionary.mp4';
import FeaturedCurator from '../components/FeaturedCurator';

gsap.registerPlugin(ScrollTrigger);

const marketDates = [
  { day: '28', month: "Jun '26", name: 'Summer Showcase',   time: '3:30 PM', status: 'notify' },
  { day: '27', month: "Sep '26", name: 'Autumn Gathering',  time: '3:30 PM', status: 'notify' },
  { day: '27', month: "Dec '26", name: 'Winter Gala',       time: '3:30 PM', status: 'coming' },
  { day: '28', month: "Mar '27", name: 'Spring Renewal',    time: '3:30 PM', status: 'coming' },
];

const Home = () => {
  const containerRef = useRef(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let ctx = gsap.context(() => {
      // Hero text slides up
      gsap.fromTo('.hero-editorial-text',
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.6, ease: 'power3.out', delay: 0.4 }
      );

      // Video parallax
      gsap.utils.toArray('.img-parallax').forEach(img => {
        gsap.to(img, {
          yPercent: 18,
          ease: 'none',
          scrollTrigger: {
            trigger: img.closest('section') || img.parentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          }
        });
      });

      // Section reveals
      gsap.utils.toArray('.reveal').forEach(el => {
        gsap.fromTo(el,
          { y: 48, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%' } }
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const handleNewsletter = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent('Newsletter Subscription');
    const body = encodeURIComponent(`Please add me to the Proverbs 31 Marketplace newsletter!\n\nEmail: ${email}`);
    window.location.href = `mailto:proverbs31markets@gmail.com?subject=${subject}&body=${body}`;
    setEmail('');
  };

  return (
    <div className="home-wrapper" ref={containerRef}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="home-hero">
        {/* Hero Video Element — Optimized for "Shins Up" crop in CSS */}
        <video 
          key={heroVid}
          autoPlay 
          muted 
          loop 
          playsInline 
          className="home-hero__video"
        >
          <source src={heroVid} type="video/mp4" />
        </video>
        <div className="home-hero__overlay" />

        {/* Bottom-left editorial text — like a luxury magazine cover */}
        <div className="home-hero__content hero-editorial-text">
          <span className="hero-eyebrow">Proverbs 31 Marketplace</span>
          <h1 className="hero-headline">
            Where<br />
            Her Gifts<br />
            <em>Make Room.</em>
          </h1>
          <p className="hero-body">
            A traveling sanctuary for women creatives, artisans, and visionaries.
          </p>
          <div className="hero-ctas">
            <a href="#newsletter" className="btn-gold-pill">Join the Inner Circle</a>
            <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noopener noreferrer" className="btn-ghost-pill">Become a Curator</a>
          </div>
        </div>

        {/* Scrolling ticker at bottom */}
        <div className="hero-ticker">
          <div className="hero-ticker__track">
            {['Art', 'Wellness', 'Clothing', 'Food', 'Literature', 'Community',
              'Art', 'Wellness', 'Clothing', 'Food', 'Literature', 'Community'].map((w, i) => (
              <span key={i}>{w} <span className="ticker-dot">◆</span></span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SCRIPTURE — Dark Plum ───────────────────────────── */}
      <section className="home-scripture">
        <video
          src={faithVid}
          autoPlay loop muted playsInline
          className="home-scripture__video img-parallax"
        />
        <div className="home-scripture__overlay" />
        <div className="home-scripture__body reveal">
          {/* Olive vertical rule on left */}
          <div className="scripture-rule" />
          <div>
            <blockquote className="scripture-quote">
              "Give her of the fruit of her hands;<br />
              And let her own works praise her in the gates."
            </blockquote>
            <cite className="scripture-cite">— Proverbs 31:31 KJV</cite>
          </div>
        </div>
      </section>

      {/* ── EXPERIENCE PILLARS — Parchment + Amethyst ─────── */}
      <section className="home-pillars">
        <div className="pillars-header reveal">
          <span className="eyebrow-label">The Experience</span>
          <h2 className="pillars-title">Beyond a Marketplace</h2>
        </div>

        <div className="pillars-grid">
          {[
            { num: '01', icon: 'diamond',    title: 'Artisan Crafted',   body: 'Elite, hand-selected curators representing the pinnacle of craftsmanship and true beauty.' },
            { num: '02', icon: 'diversity_3', title: 'Divine Networking', body: 'A community of visionary women cultivating powerful, faith-driven connections.' },
            { num: '03', icon: 'nightlife',  title: 'Exclusive Ambiance', body: 'A majestic, high-end atmosphere elevated by curated aesthetics and live music.' },
          ].map(p => (
            <div className="pillar-item reveal" key={p.num}>
              <span className="pillar-num">{p.num}</span>
              <span className="material-symbols-outlined pillar-icon">{p.icon}</span>
              <h3 className="pillar-title">{p.title}</h3>
              <p className="pillar-body">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MISSION — Cal Poly Green (THE green section) ───── */}
      <section className="home-mission" id="about">
        <div className="mission-img-col reveal">
          <div className="mission-img-frame">
            <video
              src={missionVid}
              autoPlay loop muted playsInline
              className="mission-img-video img-parallax"
            />
          </div>
        </div>

        <div className="mission-text-col reveal">
          <span className="eyebrow-label eyebrow-gold">Our Mission</span>
          <h2 className="mission-headline">Melanie Jeffers-Cameron</h2>
          <p className="mission-sub">The Matriarch of P31 Marketplace</p>
          <p className="mission-body">
            Proverbs 31 Marketplace is a traveling sanctuary for creativity.
            We honor the modern woman of influence by providing a premium
            platform to showcase her divine gifts. Every curator is hand-selected,
            representing entrepreneurial excellence. Rooted in purpose, we create
            spaces where faith and luxury converge.
          </p>

          <div className="mission-tags">
            {['palette|Art', 'spa|Wellness', 'styler|Clothing', 'restaurant|Food', 'menu_book|Literature', 'diversity_1|Community', 'design_services|Services'].map(t => {
              const [icon, label] = t.split('|');
              return (
                <span className="mission-tag" key={label}>
                  <span className="material-symbols-outlined">{icon}</span> {label}
                </span>
              );
            })}
          </div>

          <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noopener noreferrer" className="btn-gold-pill mt-cta">
            Become a Curator →
          </a>
        </div>
      </section>

      {/* ── FEATURED CURATOR — IL Collection — Melanie ─────── */}
      <FeaturedCurator />

      {/* ── PARTNER TEASER — Plum / Gold ─────────────────── */}
      <section className="home-partner py-24">
        <div className="partner-content container reveal">
          <div className="partner-text-wrapper text-center">
             <span className="eyebrow-label eyebrow-gold">Collaboration</span>
             <h2 className="partner-headline font-headline text-white">Partner with the Movement</h2>
             <p className="partner-body max-w-2xl mx-auto opacity-80 mt-6 mb-10">
               Proverbs 31 Marketplace is more than an event—it is a movement. Join us in cultivating spaces where faith, purpose, and community converge.
             </p>
             <Link to="/partner" className="btn-solid-gold">Explore Partnerships</Link>
          </div>
        </div>
      </section>

      {/* ── MARKET DATES — Olive / Deep Earth ──────────────── */}
      <section className="home-dates" id="dates">
        <div className="dates-header reveal">
          <span className="eyebrow-label eyebrow-thistle">Upcoming Dates</span>
          <h2 className="dates-title">Market Dates</h2>
        </div>

        <div className="dates-list">
          {marketDates.map((d, i) => (
            <div className="date-row reveal" key={i}>
              <div className="date-num">
                <span className="date-day">{d.day}</span>
                <span className="date-month">{d.month}</span>
              </div>
              <div className="date-info">
                <h3 className="date-name">{d.name}</h3>
                <p className="date-time">{d.time}</p>
              </div>
              <div className="date-action">
                {d.status === 'notify' ? (
                  <a href="#newsletter" className="btn-outline-pill-light">Notify Me</a>
                ) : (
                  <span className="date-badge">Incoming</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── NEWSLETTER — Thistle / Light Purple ─────────────── */}
      <section className="home-newsletter" id="newsletter">
        <div className="newsletter-inner reveal">
          <span className="eyebrow-label eyebrow-plum">Stay Connected</span>
          <h2 className="newsletter-headline">Join the Collective</h2>
          <p className="newsletter-body">
            Receive exclusive invitations, market updates, and highlights
            from our community of visionary women.
          </p>
          <form onSubmit={handleNewsletter} className="newsletter-form">
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="newsletter-input"
            />
            <button type="submit" className="btn-gold-pill">Subscribe</button>
          </form>
        </div>
      </section>

    </div>
  );
};

export default Home;
