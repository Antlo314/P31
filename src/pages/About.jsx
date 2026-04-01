import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './About.css';

gsap.registerPlugin(ScrollTrigger);

const About = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
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
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="about-cinematic-wrapper" ref={containerRef}>
      <div className="container-fluid">
        
        {/* Hero Section */}
        <section className="about-hero-section flex-center">
          <div className="about-hero-content text-center cinematic-reveal">
            <span className="font-label text-gold mb-4" style={{display: 'block'}}>Our Origin</span>
            <h1 className="font-headline text-primary" style={{ fontSize: 'clamp(3.5rem, 8vw, 6rem)', lineHeight: 1, marginBottom: '2rem' }}>
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
              <h2 className="font-headline text-primary" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '1.5rem' }}>
                Rooted in Purpose.
              </h2>
              <div className="divider-gold mb-6"></div>
              
              <blockquote className="scripture-quote text-primary" style={{ fontSize: '1.2rem', fontStyle: 'italic', marginBottom: '2.5rem', paddingLeft: '1.5rem', borderLeft: '3px solid var(--metallic-gold)' }}>
                "Give her of the fruit of her hands; And let her own works praise her in the gates"
                <br/>
                <span className="font-label text-gold" style={{ display: 'block', marginTop: '1rem', fontStyle: 'normal' }}>— Proverbs 31:31 KJV</span>
              </blockquote>
              
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '1.15rem', lineHeight: '1.8', marginBottom: '2.5rem' }}>
                We curate spaces where faith and luxury converge. Our mission is to empower women to rise,
                build, and elevate their brand presence. Every curator is hand-selected, representing the 
                pinnacle of craftsmanship, beauty, and entrepreneurial excellence.
              </p>
              
              <Link to="/apply" className="btn-solid-gold">
                Apply as a Curator
              </Link>
            </div>
            
            {/* Contact Details */}
            <div className="story-contact-card cinematic-reveal glass-card text-center" style={{ alignSelf: 'start', padding: '4rem 2rem' }}>
              <span className="material-symbols-outlined text-gold mb-4" style={{ fontSize: '2.5rem' }}>mail</span>
              <h3 className="font-headline text-primary" style={{ fontSize: '1.8rem', marginBottom: '2rem' }}>Direct Inquiries</h3>
              <ul className="contact-list" style={{ listStyle: 'none', padding: 0 }}>
                <li style={{ marginBottom: '1.5rem' }}>
                  <span className="font-label text-gold" style={{ display: 'block', marginBottom: '0.2rem' }}>Telephone</span>
                  <a href="tel:14705622852" className="text-primary" style={{ fontSize: '1.1rem', fontWeight: 600, transition: 'color 0.3s ease' }}>1 (470) 562-2852</a>
                </li>
                <li style={{ marginBottom: '1.5rem' }}>
                  <span className="font-label text-gold" style={{ display: 'block', marginBottom: '0.2rem' }}>Email</span>
                  <a href="mailto:proverbs31markets@gmail.com" className="text-primary" style={{ fontSize: '1.1rem', fontWeight: 600, wordBreak: 'break-all', transition: 'color 0.3s ease' }}>proverbs31markets@gmail.com</a>
                </li>
                <li>
                  <span className="font-label text-gold" style={{ display: 'block', marginBottom: '0.2rem' }}>Location</span>
                  <span className="text-primary" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Atlanta, GA (Touring)</span>
                </li>
              </ul>
            </div>

          </div>
        </section>
        
      </div>
    </div>
  );
};

export default About;
