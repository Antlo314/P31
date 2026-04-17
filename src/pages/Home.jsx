import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles } from 'lucide-react';
import './Home.css';

import heroVid from '../assets/hero.mp4';
import faithVid from '../assets/faith.mp4';
import visionaryVid from '../assets/visionary.mp4';

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const containerRef = useRef(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let ctx = gsap.context(() => {
      
      // Hero Background Pan
      gsap.fromTo('.hero-bg-img',
        { scale: 1.15, opacity: 0 },
        { scale: 1.05, opacity: 0.15, duration: 4, ease: 'power2.out' }
      );

      // Scroll Parallax for Hero Text
      gsap.to('.hero-text-content', {
        yPercent: 30,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-cinematic',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        }
      });

      // Section Reveals Cinematic
      const reveals = gsap.utils.toArray('.cinematic-reveal');
      reveals.forEach(elem => {
        gsap.fromTo(elem, 
          { y: 50, opacity: 0, filter: 'blur(10px)' },
          { 
            y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.5, ease: 'power2.out',
            scrollTrigger: {
              trigger: elem,
              start: 'top 85%',
            }
          }
        );
      });
      
      // Image Parallax Blocks
      const parallaxImgs = gsap.utils.toArray('.img-parallax');
      parallaxImgs.forEach(img => {
        gsap.to(img, {
          yPercent: 15,
          ease: 'none',
          scrollTrigger: {
            trigger: img.parentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          }
        });
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
    <div className="home-cinematic-wrapper font-body" ref={containerRef}>
      
      {/* Premium Glass Hero Section */}
      <section className="hero-cinematic" id="events">
        <div className="hero-bg-wrapper">
          <video src={heroVid} autoPlay loop muted playsInline className="hero-bg-img img-parallax" />
          <div className="hero-gradient-overlay"></div>
        </div>
        
        <div className="hero-content-grid text-center">
          <div className="hero-text-content cinematic-reveal glass-card shadow-lg" style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
            <span className="material-symbols-outlined text-gold" style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>auto_awesome</span>
            <h1 className="hero-title font-headline text-primary">
              Where Her Gifts <br/> <span className="text-gold" style={{fontStyle: 'italic', fontWeight: 400}}>Make Room</span>
            </h1>
            
            <p className="hero-subtitle">
              A curated celebration of women creatives, artisans, and visionaries. Explore the pinnacle of craftsmanship in our traveling sanctuary for the modern matriarch.
            </p>
            
            <div className="hero-buttons" style={{ justifyContent: 'center' }}>
              <a href="#newsletter" className="btn-solid-gold">
                Join our Inner Circle
              </a>
              <Link to="/apply" className="btn-outline-primary">
                Become a Curator
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Scripture Section */}
      <section className="scripture-section section-padded" style={{position: 'relative', overflow: 'hidden'}}>
        <video src={faithVid} autoPlay loop muted playsInline className="img-parallax" style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '120%', objectFit: 'cover', opacity: 0.4}} />
        <div className="cinematic-reveal" style={{position: 'relative', zIndex: 2, padding: '4rem 2rem'}}>
          <div className="glass-card shadow-lg" style={{ maxWidth: '1000px', margin: '0 auto', padding: '4rem 2rem' }}>
            <h2 className="scripture-text text-primary">
              "Give her of the fruit of her hands; And let her own works praise her in the gates."
            </h2>
            <p className="font-label text-gold" style={{marginTop: '2rem', letterSpacing: '2px'}}>Proverbs 31:31 KJV</p>
          </div>
        </div>
      </section>

      {/* What to Expect (Value Addition) */}
      <section className="value-section section-padded" style={{background: 'var(--surface-container-low)'}}>
        <div className="value-grid" style={{maxWidth: '1400px', margin: '0 auto'}}>
          <div className="text-center mb-8 cinematic-reveal">
            <span className="font-label text-gold">The Experience</span>
            <h2 className="font-headline" style={{color: 'var(--primary)', fontSize: 'clamp(2rem, 4vw, 3rem)', marginTop: '1rem', marginBottom: '4rem'}}>
              Beyond a Marketplace
            </h2>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem'}}>
            <div className="value-card cinematic-reveal glass-card text-center">
              <span className="material-symbols-outlined text-gold" style={{fontSize: '3rem', marginBottom: '1.5rem'}}>diamond</span>
              <h3 className="font-headline text-primary" style={{marginBottom: '1rem'}}>Artisan Crafted</h3>
              <p style={{color: 'var(--on-surface-variant)', lineHeight: 1.6}}>Discover elite, hand-selected curators representing the pinnacle of craftsmanship and true beauty.</p>
            </div>
            <div className="value-card cinematic-reveal glass-card text-center">
              <span className="material-symbols-outlined text-gold" style={{fontSize: '3rem', marginBottom: '1.5rem'}}>diversity_3</span>
              <h3 className="font-headline text-primary" style={{marginBottom: '1rem'}}>Divine Networking</h3>
              <p style={{color: 'var(--on-surface-variant)', lineHeight: 1.6}}>Immerse yourself in a community of visionary women, cultivating powerful, faith-driven connections.</p>
            </div>
            <div className="value-card cinematic-reveal glass-card text-center">
              <span className="material-symbols-outlined text-gold" style={{fontSize: '3rem', marginBottom: '1.5rem'}}>nightlife</span>
              <h3 className="font-headline text-primary" style={{marginBottom: '1rem'}}>Exclusive Ambiance</h3>
              <p style={{color: 'var(--on-surface-variant)', lineHeight: 1.6}}>Enjoy a majestic, high-end shopping atmosphere elevated by curated aesthetics and live music.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="vision-section section-padded" id="about">
        <div style={{ textAlign: 'center', marginBottom: '5rem' }} className="cinematic-reveal">
          <h2 className="font-headline text-primary" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0 }}>Melanie JC</h2>
          <p className="font-label text-gold" style={{ marginTop: '0.5rem', letterSpacing: '3px' }}>The Matriarch of P31 Marketplace</p>
        </div>
        <div className="vision-grid">
          <div className="vision-img-container cinematic-reveal" style={{position: 'relative'}}>
            <div className="vision-img-wrapper glass-border">
              <video src={visionaryVid} autoPlay loop muted playsInline className="img-parallax" style={{width: '100%', height: '120%', objectFit: 'cover'}} />
            </div>
          </div>
          <div className="vision-text cinematic-reveal">
            <span className="font-label text-gold">Our Mission</span>
            <h3 className="font-headline text-primary">Empowering Women to Rise and Build</h3>
            <p style={{lineHeight: 1.8, marginBottom: '2rem', color: 'var(--on-surface-variant)'}}>
              Proverbs 31 Marketplace is a traveling sanctuary for creativity. We honor the modern woman of influence by providing a premium platform to showcase her divine gifts. Every curator is hand-selected, representing entrepreneurial excellence. Rooted in purpose, we create spaces where faith and luxury converge.
            </p>
            
            <div className="categories-grid mb-8">
              <div className="category-item"><span className="material-symbols-outlined">palette</span> Art</div>
              <div className="category-item"><span className="material-symbols-outlined">spa</span> Wellness</div>
              <div className="category-item"><span className="material-symbols-outlined">styler</span> Clothing</div>
              <div className="category-item"><span className="material-symbols-outlined">restaurant</span> Food</div>
              <div className="category-item"><span className="material-symbols-outlined">menu_book</span> Literature</div>
              <div className="category-item"><span className="material-symbols-outlined">diversity_1</span> Community</div>
            </div>

            <Link to="/apply" className="text-gold" style={{fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem'}}>
              Become a Curator <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Tour Dates */}
      <section className="tour-section section-padded" style={{background: 'var(--surface-container)'}}>
        <div className="tour-container cinematic-reveal" style={{maxWidth: '1000px', margin: '0 auto'}}>
          <div className="text-center mb-8">
            <span className="font-label text-gold">Upcoming Dates</span>
            <h2 className="font-headline text-primary" style={{fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', marginTop: '1rem', marginBottom: '3rem'}}>Upcoming Market Dates</h2>
          </div>
          <div style={{borderTop: '1px solid var(--outline-variant)'}}>
            <div className="tour-row">
              <div className="tour-date">
                <span className="font-headline text-gold" style={{fontSize: '2.5rem', display: 'block'}}>28</span>
                <span className="font-label text-primary" style={{fontSize: '0.85rem'}}>Jun '26</span>
              </div>
              <div className="tour-info">
                <h3 className="font-headline text-primary" style={{fontSize: '1.8rem', marginBottom: '0.5rem'}}>Summer Showcase</h3>
                <p style={{color: 'var(--on-surface-variant)', lineHeight: 1.6}}>3:30 PM • Experience our curated mid-year collection.</p>
              </div>
              <div className="tour-action">
                 <a href="#newsletter" className="btn-outline-primary" style={{padding: '12px 24px', fontSize: '0.9rem'}}>Notify Me</a>
              </div>
            </div>
            
            <div className="tour-row">
              <div className="tour-date">
                <span className="font-headline text-gold" style={{fontSize: '2.5rem', display: 'block'}}>27</span>
                <span className="font-label text-primary" style={{fontSize: '0.85rem'}}>Sep '26</span>
              </div>
              <div className="tour-info">
                <h3 className="font-headline text-primary" style={{fontSize: '1.8rem', marginBottom: '0.5rem'}}>Autumn Gathering</h3>
                <p style={{color: 'var(--on-surface-variant)', lineHeight: 1.6}}>3:30 PM • Transitioning into the rich colors of fall.</p>
              </div>
              <div className="tour-action">
                 <span style={{color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem', fontWeight: 700}}>Notify Me</span>
              </div>
            </div>

            <div className="tour-row">
              <div className="tour-date">
                <span className="font-headline text-gold" style={{fontSize: '2.5rem', display: 'block'}}>27</span>
                <span className="font-label text-primary" style={{fontSize: '0.85rem'}}>Dec '26</span>
              </div>
              <div className="tour-info">
                <h3 className="font-headline text-primary" style={{fontSize: '1.8rem', marginBottom: '0.5rem'}}>Winter Gala</h3>
                <p style={{color: 'var(--on-surface-variant)', lineHeight: 1.6}}>3:30 PM • An exclusive end-of-year artisan celebration.</p>
              </div>
              <div className="tour-action">
                 <span style={{color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem', fontWeight: 700}}>Incoming</span>
              </div>
            </div>

            <div className="tour-row">
              <div className="tour-date">
                <span className="font-headline text-gold" style={{fontSize: '2.5rem', display: 'block'}}>28</span>
                <span className="font-label text-primary" style={{fontSize: '0.85rem'}}>Mar '27</span>
              </div>
              <div className="tour-info">
                <h3 className="font-headline text-primary" style={{fontSize: '1.8rem', marginBottom: '0.5rem'}}>Spring Renewal</h3>
                <p style={{color: 'var(--on-surface-variant)', lineHeight: 1.6}}>3:30 PM • Welcoming the fresh bloom of new creators.</p>
              </div>
              <div className="tour-action">
                 <span style={{color: 'var(--outline)', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem', fontWeight: 700}}>Incoming</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="newsletter-section section-padded" id="newsletter">
        <div className="newsletter-card cinematic-reveal glass-card shadow-lg text-center" style={{ padding: '6rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
          <Sparkles className="text-gold" size={48} style={{ margin: '0 auto 1.5rem auto' }} />
          <h2 className="font-headline text-primary" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '1rem' }}>Join the Collective</h2>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '1.1rem', marginBottom: '3rem', maxWidth: '500px', margin: '0 auto 3rem auto', lineHeight: '1.6' }}>
            Subscribe to our newsletter to receive exclusive invitations, tour updates, and highlights from our community of visionary women.
          </p>
          
          <form onSubmit={handleNewsletter} className="newsletter-form flex-center" style={{ gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input 
              type="email" 
              placeholder="Enter your email address..." 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ padding: '16px 24px', flex: '1', minWidth: '280px', maxWidth: '400px', borderRadius: '40px', border: '1px solid var(--outline-variant)', background: 'var(--pure-white)', color: 'var(--on-surface)', fontSize: '1rem', outline: 'none' }}
            />
            <button type="submit" className="btn-solid-gold" style={{ padding: '16px 36px', whiteSpace: 'nowrap' }}>
              Subscribe
            </button>
          </form>
        </div>
      </section>
      
    </div>
  );
};

export default Home;
