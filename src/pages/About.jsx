import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './About.css';

import editorialImg from '../assets/p31_partner_hero_editorial_1776544063235.png';
import curatorPortrait from '../assets/melanie23_rm.png';
import bentoJewelry from '../assets/vendor_jewelry.png';
import bentoCeramics from '../assets/vendor_ceramics.png';
import bentoCandles from '../assets/vendor_candles.png';

gsap.registerPlugin(ScrollTrigger);

const About = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Respect users who prefer reduced motion — leave everything visible.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let ctx = gsap.context(() => {
      if (reduce) return;

      // Cinematic Reveals
      const reveals = gsap.utils.toArray('.cinematic-reveal');
      reveals.forEach(elem => {
        gsap.fromTo(elem,
          { y: 40, opacity: 0, filter: 'blur(5px)' },
          {
            y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power2.out',
            scrollTrigger: {
              trigger: elem,
              start: 'top 80%',
            }
          }
        );
      });

      // Bento mosaic — staggered rise for the new "What We Stand For" cells
      gsap.from('.about-bento .bento-cell', {
        y: 60, opacity: 0, duration: 1, stagger: 0.09, ease: 'power3.out',
        scrollTrigger: { trigger: '.about-bento .bento-grid', start: 'top 82%' },
      });

      // Magnetic buttons (pointer-follow)
      gsap.utils.toArray('.magnetic').forEach(btn => {
        const strength = 0.35;
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
    <div className="about-cinematic-wrapper" ref={containerRef}>
      <div className="container-fluid">

        {/* Hero Section */}
        <section className="about-hero-section flex-center">
          <div className="about-hero-content text-center cinematic-reveal">
            <span className="section-kicker about-hero-kicker">Our Origin</span>
            <h1 className="font-headline text-primary about-hero-title">
              The Vision
            </h1>
            <p className="hero-subtitle">
              The Proverbs 31 Marketplace is an elite, traveling collective of women creatives.
              We are defying the standard pop-up formula to bring a majestic, high-end shopping
              experience to Atlanta and beyond.
            </p>
          </div>
        </section>

        {/* Story & Contact Section */}
        <section className="about-story-section">
          <div className="about-grid">

            {/* Main Story */}
            <div className="story-text-card cinematic-reveal glass-card shadow-lg">
              <span className="section-kicker">Our Foundation</span>
              <h2 className="font-headline text-primary story-heading">
                Rooted in Purpose.
              </h2>
              <div className="divider-gold mb-6"></div>

              <blockquote className="scripture-quote text-primary">
                "Give her of the fruit of her hands; And let her own works praise her in the gates"
                <br/>
                <span className="font-label text-gold scripture-cite">— Proverbs 31:31 KJV</span>
              </blockquote>

              <p className="story-body">
                We curate spaces where faith and luxury converge. Our mission is to empower women to rise,
                build, and elevate their brand presence. Every curator is hand-selected, representing the
                pinnacle of craftsmanship, beauty, and entrepreneurial excellence.
              </p>

              <Link to="/apply" className="btn-solid-gold magnetic">
                Apply as a Curator
              </Link>
            </div>

            {/* Contact Details */}
            <div className="story-contact-card cinematic-reveal glass-card text-center">
              <span className="material-symbols-outlined text-gold contact-icon">mail</span>
              <h3 className="font-headline text-primary contact-heading">Direct Inquiries</h3>
              <ul className="contact-list">
                <li>
                  <span className="font-label text-gold contact-label">Telephone</span>
                  <a href="tel:14705622852" className="text-primary contact-value">1 (470) 562-2852</a>
                </li>
                <li>
                  <span className="font-label text-gold contact-label">Email</span>
                  <a href="mailto:proverbs31markets@gmail.com" className="text-primary contact-value contact-value--email">proverbs31markets@gmail.com</a>
                </li>
                <li>
                  <span className="font-label text-gold contact-label">Location</span>
                  <span className="text-primary contact-value">Atlanta, GA (Touring)</span>
                </li>
              </ul>
            </div>

          </div>
        </section>

        {/* What We Stand For — signature bento mosaic */}
        <section className="about-bento">
          <div className="about-bento-header cinematic-reveal">
            <span className="section-kicker">What We Stand For</span>
            <h2 className="font-headline text-primary about-bento-title">
              A Standard, Composed
            </h2>
            <p className="about-bento-lead">
              Every curator, every category, every gathering is measured against a single
              conviction — that gifted hands deserve a majestic stage.
            </p>
          </div>

          <div className="bento-grid">
            {/* Tall editorial media */}
            <div className="bento-cell is-media col-5 row-2">
              <img src={editorialImg} alt="Proverbs 31 editorial gathering" />
              <div className="bento-overlay" />
              <div className="bento-content">
                <span className="bento-tag">The Collective</span>
                <h3 className="bento-cell-title">Faith Meets Luxury</h3>
                <p className="bento-cell-text">A traveling marketplace built for the woman of influence.</p>
              </div>
            </div>

            {/* Brand promise — dark */}
            <div className="bento-cell is-dark col-4">
              <div className="bento-content">
                <span className="material-symbols-outlined bento-quote-mark">format_quote</span>
                <p className="bento-promise">
                  We promise a stage worthy of her craft — where beauty, purpose,
                  and community are never an afterthought.
                </p>
              </div>
            </div>

            {/* Stat — gold */}
            <div className="bento-cell is-gold col-3">
              <div className="bento-content about-stat">
                <span className="about-stat-num">100%</span>
                <span className="about-stat-label">Hand-Selected Curators</span>
              </div>
            </div>

            {/* Category image — adornment */}
            <div className="bento-cell is-media col-4">
              <img src={bentoJewelry} alt="Artisan jewelry" />
              <div className="bento-overlay" />
              <div className="bento-content"><span className="bento-cat">Adornment</span></div>
            </div>

            {/* Category image — wellness */}
            <div className="bento-cell is-media col-3">
              <img src={bentoCandles} alt="Botanical candles" />
              <div className="bento-overlay" />
              <div className="bento-content"><span className="bento-cat">Wellness</span></div>
            </div>

            {/* Curator portrait media — wide */}
            <div className="bento-cell is-media col-7">
              <img src={curatorPortrait} alt="A Proverbs 31 curator" />
              <div className="bento-overlay" />
              <div className="bento-content">
                <h3 className="bento-cell-title">Women Who Build</h3>
                <p className="bento-cell-text">Visionaries elevating their gifts, and one another.</p>
              </div>
            </div>

            {/* Category image — home & craft */}
            <div className="bento-cell is-media col-5">
              <img src={bentoCeramics} alt="Handmade ceramics" />
              <div className="bento-overlay" />
              <div className="bento-content"><span className="bento-cat">Home & Craft</span></div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default About;
