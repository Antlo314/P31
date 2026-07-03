import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Services.css';

import curatorVid   from '../assets/curator.mp4';
import visionaryVid from '../assets/visionary.mp4';
import productVid   from '../assets/product.mp4';

gsap.registerPlugin(ScrollTrigger);

const Services = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Respect reduced-motion: leave everything in its natural, visible state.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ctx = gsap.context(() => {
      // ── Hero reveal ──
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      heroTl
        .from('.services-hero__kicker', { y: 20, opacity: 0, duration: 0.9 }, 0.1)
        .from('.services-headline', { y: 34, opacity: 0, duration: 1.1 }, 0.25)
        .from('.services-sub', { y: 24, opacity: 0, duration: 1 }, 0.6)
        .from('.services-hero__scroll', { opacity: 0, duration: 1 }, 0.9);

      // ── Section header reveal ──
      gsap.from('.services-bento__header > *', {
        y: 32, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.services-bento__header', start: 'top 85%' },
      });

      // ── Bento mosaic: staggered rise ──
      gsap.from('.services-bento .bento-cell', {
        y: 60, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: '.services-bento .bento-grid', start: 'top 82%' },
      });

      // ── CTA band reveal ──
      gsap.from('.services-cta__inner > *', {
        y: 30, opacity: 0, duration: 1, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.services-cta', start: 'top 85%' },
      });

      // ── Magnetic buttons (pointer-follow) ──
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
    <div className="services-page" ref={containerRef}>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="services-hero">
        <div className="services-hero__overlay" />
        <div className="services-hero__content">
          <span className="section-kicker services-hero__kicker">Elite Offerings</span>
          <h1 className="services-headline">Services &amp; <br /><em>Strategic Curation.</em></h1>
          <p className="services-sub">
            Tailored experiences and strategic support for the modern woman of influence.
            Currently refining our full suite of artisan services.
          </p>
          <span className="services-hero__scroll">
            <span className="material-symbols-outlined">south</span>
          </span>
        </div>
      </section>

      {/* ── SERVICES BENTO ───────────────────────────────────── */}
      <section className="services-bento">
        <div className="services-bento__header">
          <span className="section-kicker">The Bespoke Suite</span>
          <h2 className="services-bento__title">Three Ways We Elevate Her Gifts</h2>
          <p className="services-bento__lead">
            From end-to-end brand refinement to intimate one-on-one mentorship — each
            offering is composed to help the modern artisan make room in the highest circles.
          </p>
        </div>

        <div className="bento-grid">
          {/* Featured / primary service — Bespoke Brand Curation */}
          <div className="bento-cell is-media col-6 row-2">
            <video src={curatorVid} autoPlay loop muted playsInline />
            <div className="bento-overlay" />
            <div className="bento-content">
              <span className="bento-tag">Featured Service</span>
              <span className="material-symbols-outlined service-icon">diversity_3</span>
              <h3 className="service-title">Bespoke Brand Curation</h3>
              <p className="service-desc">
                For the established artisan looking to elevate their digital Presence. We provide
                end-to-end strategic refinement to ensure your gifts make room in the highest circles.
              </p>
            </div>
          </div>

          {/* Value-statement accent — dark plum */}
          <div className="bento-cell is-dark col-6">
            <div className="bento-content">
              <span className="material-symbols-outlined service-quote-mark">format_quote</span>
              <p className="service-value">
                Where entrepreneurial excellence and purposeful elegance converge.
              </p>
            </div>
          </div>

          {/* Bespoke Design */}
          <div className="bento-cell is-media col-3">
            <video src={productVid} autoPlay loop muted playsInline />
            <div className="bento-overlay" />
            <div className="bento-content">
              <span className="material-symbols-outlined service-icon">architecture</span>
              <h3 className="service-title">Bespoke Design</h3>
              <p className="service-desc">
                Architectural consultation for physical market spaces and digital storefronts.
                We create atmospheres where luxury and purpose converge.
              </p>
            </div>
          </div>

          {/* Curator Coaching */}
          <div className="bento-cell is-media col-3">
            <video src={visionaryVid} autoPlay loop muted playsInline />
            <div className="bento-overlay" />
            <div className="bento-content">
              <span className="material-symbols-outlined service-icon">auto_awesome</span>
              <h3 className="service-title">Curator Coaching</h3>
              <p className="service-desc">
                One-on-one mentorship for the Proverbs 31 woman of influence. Mastering the balance
                of entrepreneurial excellence and purposeful elegance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONCIERGE CTA ────────────────────────────────────── */}
      <section className="services-cta">
        <div className="services-cta__inner">
          <span className="section-kicker services-cta__kicker">Bespoke Concierge</span>
          <h2 className="cta-headline font-headline">Interested in Bespoke Support?</h2>
          <p className="cta-body">
            Our full services catalog is launching soon. Connect with our concierge to be among the
            first to experience the new P31 strategic suite.
          </p>
          <a href="mailto:proverbs31markets@gmail.com" className="btn-solid-gold magnetic">Inquire with Concierge</a>
        </div>
      </section>
    </div>
  );
};

export default Services;
