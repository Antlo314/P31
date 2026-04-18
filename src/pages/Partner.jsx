import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, Globe, Users, Gift, TrendingUp, Send, CheckCircle2, ChevronRight, Mail, Phone, DollarSign } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Partner.css';

import heroImg from '../assets/p31_partner_hero_editorial_1776544063235.png';
import groupImg from '../assets/p31_community_impact_editorial_1776544076592.png';

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
    let ctx = gsap.context(() => {
      // Reveal Sections
      gsap.utils.toArray('.ptr-reveal').forEach(el => {
        gsap.fromTo(el,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0,
            duration: 1.2,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
            }
          }
        );
      });

      // Hero Fade
      gsap.from('.ptr-hero-content', {
        opacity: 0, y: 40, duration: 1.5, ease: 'expo.out', delay: 0.2
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
          <span className="ptr-eyebrow animate-in">A Holy Movement</span>
          <h1 className="ptr-title font-headline text-gold">
            Partner With <br />Proverbs 31 Marketplace
          </h1>
          <div className="ptr-vision-block glass-card ptr-reveal">
            <h3 className="font-headline text-primary mb-4">The Vision</h3>
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
      <section className="ptr-why py-24 bg-surface container">
        <div className="ptr-grid ptr-reveal">
          <div className="ptr-why-text">
            <span className="ptr-eyebrow text-gold">Impact</span>
            <h2 className="font-headline text-primary mb-8">Why Partnership Matters</h2>
            <p className="mb-6">Every vision requires people who are willing to stand behind it. Your partnership helps us:</p>
            <ul className="ptr-checklist">
              <li><CheckCircle2 size={20} className="text-gold" /> Provide opportunities for small businesses to grow</li>
              <li><CheckCircle2 size={20} className="text-gold" /> Create safe, impactful environments for community engagement</li>
              <li><CheckCircle2 size={20} className="text-gold" /> Support women in breaking cycles and building legacy</li>
              <li><CheckCircle2 size={20} className="text-gold" /> Expand our reach to serve more individuals through marketplace experiences</li>
            </ul>
            <p className="ptr-impact-quote mt-12 font-headline italic">
              "What you give becomes a seed into something far greater than a single event."
            </p>
          </div>
          <div className="ptr-why-visual glass-border">
            <div className="ptr-visual-overlay" />
            <img src={groupImg} alt="Excellence" />
          </div>
        </div>
      </section>

      {/* SECTION 3 & 4: WAYS TO INVEST & THE HEART */}
      <section className="ptr-invest py-24 container">
        <div className="ptr-reveal text-center mb-16">
          <span className="ptr-eyebrow text-gold">Engagement</span>
          <h2 className="font-headline text-primary">Ways to Invest</h2>
        </div>

        <div className="ptr-cards ptr-reveal">
          {/* 1. Financial */}
          <div className="ptr-card glass-card">
            <div className="ptr-card-icon"><DollarSign /></div>
            <h3 className="font-headline">Financial Giving</h3>
            <p>If you feel led to support financially, your contribution helps us execute events, expand resources, and sustain the vision.</p>
            <a href="https://www.paypal.com/donate/?hosted_button_id=WY2ZX3TXDMF5Y" target="_blank" rel="noreferrer" className="ptr-card-btn">Give Gracefully <ChevronRight size={16} /></a>
          </div>

          {/* 2. In-Kind */}
          <div className="ptr-card glass-card">
            <div className="ptr-card-icon"><Gift /></div>
            <h3 className="font-headline">In-Kind Giving</h3>
            <p>Event spaces, equipment (tables, tents), artisan products, or professional services (photo/marketing) are just as valuable.</p>
            <a href="#partner-form" className="ptr-card-btn">Offer Artifacts <ChevronRight size={16} /></a>
          </div>

          {/* 3. Strategic */}
          <div className="ptr-card glass-card">
            <div className="ptr-card-icon"><TrendingUp /></div>
            <h3 className="font-headline">Strategic Partnership</h3>
            <p>We welcome businesses and organizations desiring to collaborate in a larger capacity to help expand our reach and impact.</p>
            <a href="#partner-form" className="ptr-card-btn">Collaborate <ChevronRight size={16} /></a>
          </div>
        </div>

        {/* Heart Section */}
        <div className="ptr-heart mt-24 text-center ptr-reveal">
          <Heart size={48} className="text-gold mb-6 mx-auto animate-pulse" />
          <h2 className="font-headline text-primary mb-6">The Heart Behind Your Giving</h2>
          <p className="max-w-3xl mx-auto opacity-80 leading-relaxed text-lg">
            We honor every form of giving—whether seen or unseen. Your contribution is not just support... It is alignment with a vision that is committed to uplifting women, strengthening communities, and walking in purpose with integrity. What you give carries weight. It helps build something that will outlive a moment.
          </p>
        </div>
      </section>

      {/* SECTION 5: CALL TO ACTION (FORM) */}
      <section className="ptr-form-sec py-24 bg-surface container px-4 mb-24" id="partner-form">
        <div className="ptr-grid ptr-reveal">
          <div className="ptr-form-info">
            <h2 className="font-headline text-primary mb-6">Take the Next Step</h2>
            <p className="mb-8">If you feel led to partner with Proverbs 31 Marketplace, we invite you to connect.</p>

            <div className="ptr-contact-details">
              <div className="ptr-contact-item">
                <Mail className="text-gold" />
                <span>proverbs31markets@gmail.com</span>
              </div>
              <div className="ptr-contact-item">
                <Phone className="text-gold" />
                <span>Inquiry Inquiry Console Ready</span>
              </div>
            </div>
          </div>

          <div className="ptr-form-wrapper glass-card">
            {isSuccess ? (
              <div className="ptr-success-msg text-center">
                <CheckCircle2 size={64} className="text-gold mb-4 mx-auto" />
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
                <button type="submit" className="btn-solid-gold w-full mt-4" disabled={isSubmitting}>
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
