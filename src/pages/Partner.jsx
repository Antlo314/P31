import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, Gift, TrendingUp, CheckCircle2, ChevronRight, Mail, Phone, DollarSign } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Partner.css';

import heroImg from '../assets/p31_partner_hero_editorial_1776544063235.png';
import groupImg from '../assets/p31_community_impact_editorial_1776544076592.png';
import investVid from '../assets/visionary.mp4';
import craftImg from '../assets/vendor_ceramics.png';
import adornImg from '../assets/vendor_jewelry.png';

gsap.registerPlugin(ScrollTrigger);

const Partner = () => {
  const containerRef = useRef(null);
  const [formState, setFormState] = useState({
    full_name: '',
    email: '',
    phone: '',
    partnership_type: 'Strategic',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let ctx = gsap.context(() => {
      // Hero fade
      gsap.from('.ptr-hero-content', {
        opacity: 0, y: 40, duration: 1.5, ease: 'expo.out', delay: 0.2
      });

      // Generic single-element reveals
      gsap.utils.toArray('.ptr-reveal').forEach(el => {
        gsap.fromTo(el,
          { opacity: 0, y: 34 },
          {
            opacity: 1, y: 0,
            duration: 1.1,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%' }
          }
        );
      });

      // Bento mosaic: staggered rise
      gsap.from('.ptr-bento .bento-cell', {
        y: 56, opacity: 0, duration: 1, stagger: 0.09, ease: 'power3.out',
        scrollTrigger: { trigger: '.ptr-bento .bento-grid', start: 'top 82%' }
      });

      // Checklist stagger
      gsap.from('.ptr-checklist li', {
        x: -20, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power2.out',
        scrollTrigger: { trigger: '.ptr-checklist', start: 'top 88%' }
      });

      // Magnetic buttons (pointer-follow)
      gsap.utils.toArray('.magnetic').forEach(btn => {
        const strength = 0.32;
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('partnerships').insert([formState]);
      if (error) throw error;
      setIsSuccess(true);
      setFormState({ full_name: '', email: '', phone: '', partnership_type: 'Strategic', message: '' });
    } catch (err) {
      alert('Architectural Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="partner-page" ref={containerRef}>
      {/* SECTION 1: THE VISION (HERO) */}
      <section className="ptr-hero" style={{ backgroundImage: `url(${heroImg})` }}>
        <div className="ptr-hero-overlay" />
        <div className="ptr-hero-content container">
          <span className="section-kicker ptr-hero-kicker">A Holy Movement</span>
          <h1 className="ptr-title font-headline text-gold">
            Partner With <br />Proverbs 31 Marketplace
          </h1>
          <div className="ptr-vision-block glass-card">
            <h3 className="font-headline mb-4">The Vision</h3>
            <p className="ptr-lead">
              Proverbs 31 Marketplace is more than an event—it is a movement.
            </p>
            <p>
              It was established to create a space where women can build, heal, and walk boldly in what God has entrusted to them. This marketplace exists to empower faith-driven entrepreneurs, provide opportunity, and cultivate a community where purpose is activated and supported.
            </p>
            <p className="mt-4">
              We are not simply hosting markets—we are creating access, visibility, and transformation for women who are ready to walk in their calling.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2: WHY PARTNERSHIP MATTERS */}
      <section className="ptr-why section-padded container">
        <div className="ptr-grid">
          <div className="ptr-why-text ptr-reveal">
            <span className="section-kicker">Impact</span>
            <h2 className="font-headline text-primary ptr-section-title">Why Partnership Matters</h2>
            <p className="ptr-why-intro">Every vision requires people who are willing to stand behind it. Your partnership helps us:</p>
            <ul className="ptr-checklist">
              <li><CheckCircle2 size={20} className="text-gold" /> Provide opportunities for small businesses to grow</li>
              <li><CheckCircle2 size={20} className="text-gold" /> Create safe, impactful environments for community engagement</li>
              <li><CheckCircle2 size={20} className="text-gold" /> Support women in breaking cycles and building legacy</li>
              <li><CheckCircle2 size={20} className="text-gold" /> Expand our reach to serve more individuals through marketplace experiences</li>
            </ul>
            <p className="ptr-impact-quote font-headline">
              "What you give becomes a seed into something far greater than a single event."
            </p>
          </div>
          <div className="ptr-why-visual ptr-reveal">
            <div className="ptr-visual-overlay" />
            <img src={groupImg} alt="Women gathering in community at a Proverbs 31 market" />
          </div>
        </div>
      </section>

      {/* SECTION 3: WAYS TO INVEST — BENTO MOSAIC */}
      <section className="ptr-invest ptr-bento section-padded container">
        <div className="ptr-invest-header ptr-reveal">
          <span className="section-kicker">Engagement</span>
          <h2 className="font-headline text-primary ptr-section-title">Ways to Invest</h2>
          <p className="ptr-invest-lead">
            Every form of giving carries weight. Choose the path that aligns with your
            calling—each one becomes a seed into something greater than a single event.
          </p>
        </div>

        <div className="bento-grid">
          {/* Financial — dark feature */}
          <div className="bento-cell is-dark col-5 row-2">
            <div className="bento-content ptr-cell-body">
              <span className="ptr-cell-index">01</span>
              <div className="ptr-cell-icon"><DollarSign /></div>
              <h3 className="font-headline ptr-cell-title">Financial Giving</h3>
              <p className="ptr-cell-text">
                If you feel led to support financially, your contribution helps us execute
                events, expand resources, and sustain the vision.
              </p>
              <a href="https://www.paypal.com/donate/?hosted_button_id=WY2ZX3TXDMF5Y" target="_blank" rel="noreferrer" className="ptr-cell-cta magnetic">
                Give Gracefully <ChevronRight size={16} />
              </a>
            </div>
          </div>

          {/* Media — visionary film */}
          <div className="bento-cell is-media col-4 row-2">
            <video src={investVid} autoPlay loop muted playsInline />
            <div className="bento-overlay" />
            <div className="bento-content">
              <span className="ptr-media-tag">The Movement</span>
              <p className="ptr-media-caption">Access, visibility, and transformation—made real.</p>
            </div>
          </div>

          {/* Gold stat / heart accent */}
          <div className="bento-cell is-gold col-3">
            <div className="bento-content ptr-gold-cell">
              <Heart className="ptr-gold-heart" />
              <span className="ptr-gold-label">Every gift is honored—seen or unseen</span>
            </div>
          </div>

          {/* Adornment media */}
          <div className="bento-cell is-media col-3">
            <img src={adornImg} alt="Handcrafted artisan jewelry" />
            <div className="bento-overlay" />
            <div className="bento-content"><span className="ptr-cat">Curators You Empower</span></div>
          </div>

          {/* In-Kind — forest */}
          <div className="bento-cell is-forest col-4">
            <div className="bento-content ptr-cell-body">
              <span className="ptr-cell-index">02</span>
              <div className="ptr-cell-icon"><Gift /></div>
              <h3 className="font-headline ptr-cell-title">In-Kind Giving</h3>
              <p className="ptr-cell-text">
                Event spaces, equipment (tables, tents), artisan products, or professional
                services (photo/marketing) are just as valuable.
              </p>
              <a href="#partner-form" className="ptr-cell-cta magnetic">Offer Resources <ChevronRight size={16} /></a>
            </div>
          </div>

          {/* Strategic — dark */}
          <div className="bento-cell is-dark col-5">
            <div className="bento-content ptr-cell-body">
              <span className="ptr-cell-index">03</span>
              <div className="ptr-cell-icon"><TrendingUp /></div>
              <h3 className="font-headline ptr-cell-title">Strategic Partnership</h3>
              <p className="ptr-cell-text">
                We welcome businesses and organizations desiring to collaborate in a larger
                capacity to help expand our reach and impact.
              </p>
              <a href="#partner-form" className="ptr-cell-cta magnetic">Collaborate <ChevronRight size={16} /></a>
            </div>
          </div>

          {/* Craft media */}
          <div className="bento-cell is-media col-3">
            <img src={craftImg} alt="Handmade ceramics by a P31 curator" />
            <div className="bento-overlay" />
            <div className="bento-content"><span className="ptr-cat">The Craft</span></div>
          </div>
        </div>
      </section>

      {/* SECTION 4: THE HEART BEHIND YOUR GIVING */}
      <section className="ptr-heart-sec section-padded container">
        <div className="ptr-heart ptr-reveal">
          <Heart size={44} className="text-gold ptr-heart-icon" />
          <span className="section-kicker ptr-heart-kicker">Purpose</span>
          <h2 className="font-headline text-primary ptr-section-title">The Heart Behind Your Giving</h2>
          <p className="ptr-heart-body">
            We honor every form of giving—whether seen or unseen. Your contribution is not just support... It is alignment with a vision that is committed to uplifting women, strengthening communities, and walking in purpose with integrity. What you give carries weight. It helps build something that will outlive a moment.
          </p>
        </div>
      </section>

      {/* SECTION 5: CALL TO ACTION (FORM) */}
      <section className="ptr-form-sec section-padded container" id="partner-form">
        <div className="ptr-grid ptr-reveal">
          <div className="ptr-form-info">
            <span className="section-kicker">Take the Next Step</span>
            <h2 className="font-headline text-primary ptr-section-title">Align With the Movement</h2>
            <p className="ptr-form-intro">If you feel led to partner with Proverbs 31 Marketplace, we invite you to connect.</p>

            <div className="ptr-contact-details">
              <div className="ptr-contact-item">
                <a href="mailto:proverbs31markets@gmail.com" className="ptr-contact-link">
                  <span className="ptr-contact-icon"><Mail size={20} className="text-gold" /></span>
                  <span>proverbs31markets@gmail.com</span>
                </a>
              </div>
              <div className="ptr-contact-item">
                <a href="tel:14705622852" className="ptr-contact-link">
                  <span className="ptr-contact-icon"><Phone size={20} className="text-gold" /></span>
                  <span>1 (470) 562-2852</span>
                </a>
              </div>
            </div>
          </div>

          <div className="ptr-form-wrapper glass-card">
            {isSuccess ? (
              <div className="ptr-success-msg text-center">
                <CheckCircle2 size={64} className="text-gold ptr-success-icon" />
                <h3 className="font-headline text-primary">Alignment Confirmed</h3>
                <p>Your inquiry has been stored in the Master Governance vault. The Architect will review your partnership shortly.</p>
                <button onClick={() => setIsSuccess(false)} className="btn-solid-gold mt-6">Send Another</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="premium-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" value={formState.full_name} onChange={e => setFormState({ ...formState, full_name: e.target.value })} required />
                </div>
                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={formState.email} onChange={e => setFormState({ ...formState, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Partnership Type</label>
                    <select value={formState.partnership_type} onChange={e => setFormState({ ...formState, partnership_type: e.target.value })}>
                      <option value="Financial">Financial Investment</option>
                      <option value="In-Kind">In-Kind (Goods/Services)</option>
                      <option value="Strategic">Strategic Collaboration</option>
                      <option value="Volunteer">Volunteer Support</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Manifesto / Message</label>
                  <textarea rows="4" value={formState.message} onChange={e => setFormState({ ...formState, message: e.target.value })} placeholder="How do you wish to align with the movement?"></textarea>
                </div>
                <button type="submit" className="btn-solid-gold w-full mt-4 magnetic" disabled={isSubmitting}>
                  {isSubmitting ? 'Transmitting Inward...' : 'Align with P31 →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Partner;
