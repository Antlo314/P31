import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Home.css';
import EventPopup from '../components/EventPopup';

import heroVid from '../assets/hero.mp4';
import curatorVid from '../assets/curator.mp4';
import faithVid from '../assets/faith.mp4';
import flyerImg from '../assets/flyer.png';
import melanieVid from '../assets/melanie.mp4';

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      
      // Hero Background Pan
      gsap.fromTo('.hero-bg-img',
        { scale: 1.15, opacity: 0 },
        { scale: 1.05, opacity: 0.3, duration: 4, ease: 'power2.out' }
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

  return (
    <div className="home-cinematic-wrapper font-body" ref={containerRef}>
      
      {/* Hero Section */}
      <section className="hero-cinematic" id="events">
        <div className="hero-bg-wrapper">
          <video src={heroVid} autoPlay loop muted playsInline className="hero-bg-img img-parallax" />
          <div className="hero-gradient-overlay"></div>
        </div>
        
        <div className="hero-content-grid">
          <div className="hero-text-content cinematic-reveal">
            <div className="launch-badge">
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>stars</span>
              <span>Grand Launch Market</span>
            </div>
            
            <h1 className="hero-title font-headline">
              Where Her Gifts <br/> <span className="text-gold" style={{fontStyle: 'italic', fontWeight: 400}}>Make Room</span>
            </h1>
            
            <div className="hero-details">
              <div className="hero-detail-row">
                <span className="material-symbols-outlined">calendar_month</span>
                <div>
                  <div className="font-headline" style={{fontStyle: 'italic', fontSize: '1.25rem'}}>Sunday, March 29th, 2026</div>
                  <div style={{opacity: 0.7, fontSize: '0.9rem', marginTop: '4px'}}>Doors open at 3:30 PM</div>
                </div>
              </div>
              <div className="hero-detail-row">
                <span className="material-symbols-outlined">location_on</span>
                <div style={{lineHeight: 1.5}}>
                  Embassy Suites by Hilton<br/>
                  Atlanta NE/Gwinnett Sugarloaf
                </div>
              </div>
              <p style={{color: 'rgba(255,255,255,0.7)', lineHeight: 1.6}}>
                Join us for a curated celebration of women creatives, artisans, and visionaries. A traveling sanctuary for the modern matriarch.
              </p>
            </div>
            
            <div className="hero-buttons">
              <a href="https://www.eventbrite.com/e/proverbs-31-marketplace-tickets-1984190041828" target="_blank" rel="noreferrer" className="btn-solid-gold">
                Get Your Tickets
              </a>
              <Link to="/apply" className="btn-outline-white">
                Become a Vendor
              </Link>
            </div>
          </div>
          
          <div className="hero-flyer-container cinematic-reveal" style={{position: 'relative'}}>
            <div className="hero-flyer-glow"></div>
            <div className="hero-flyer-wrapper">
              <img src={flyerImg} alt="Flyer" style={{width: '100%', height: 'auto', display: 'block'}} />
            </div>
          </div>
        </div>
      </section>

      {/* Scripture Section */}
      <section className="scripture-section section-padded" style={{position: 'relative', background: 'var(--primary)', overflow: 'hidden'}}>
        <video src={faithVid} autoPlay loop muted playsInline className="img-parallax" style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '120%', objectFit: 'cover', opacity: 0.25}} />
        <div className="cinematic-reveal" style={{position: 'relative', zIndex: 2}}>
          <span className="material-symbols-outlined text-gold mb-8" style={{fontSize: '2.5rem'}}>auto_awesome</span>
          <h2 className="scripture-text text-white" style={{color: 'white'}}>
            "Give her of the fruit of her hands; And let her own works praise her in the gates."
          </h2>
          <p className="font-label text-gold" style={{marginTop: '2rem', opacity: 0.8}}>Proverbs 31:31 KJV</p>
        </div>
      </section>

      {/* Map Section */}
      <section className="map-section section-padded">
        <div className="map-grid cinematic-reveal">
          <div className="map-info">
            <span className="font-label text-gold">Visit Us</span>
            <h3 className="font-headline">Event Location</h3>
            <div style={{display: 'flex', gap: '1rem', marginBottom: '2rem'}}>
              <span className="material-symbols-outlined text-primary">pin_drop</span>
              <p style={{color: 'var(--on-surface)', lineHeight: 1.6, fontWeight: 500}}>
                Embassy Suites by Hilton<br/>
                Atlanta NE/Gwinnett Sugarloaf<br/>
                2029 Satellite Blvd<br/>
                Duluth, GA 30097
              </p>
            </div>
            <p style={{fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--on-surface)', paddingLeft: '2.5rem', marginBottom: '2rem'}}>
              (across from Gas South Arena)
            </p>
            <a href="https://www.google.com/maps/dir/?api=1&destination=2029+Satellite+Blvd+Duluth+GA+30097" target="_blank" rel="noreferrer" className="btn-solid-gold" style={{background: 'var(--primary)', color: 'white'}}>
              <span className="material-symbols-outlined" style={{verticalAlign: 'middle', marginRight: '8px', fontSize: '1.2rem', color: 'white'}}>directions</span>
              Get Directions
            </a>
          </div>
          <div className="map-container">
            <iframe 
              src="https://maps.google.com/maps?q=2029%20Satellite%20Blvd%2C%20Duluth%2C%20GA%2030097&t=&z=15&ie=UTF8&iwloc=&output=embed"
              width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight="0" marginWidth="0" title="Map">
            </iframe>
          </div>
        </div>
      </section>

      {/* What to Expect (Value Addition) */}
      <section className="value-section section-padded" style={{background: 'var(--surface-container-low)'}}>
        <div className="value-grid" style={{maxWidth: '1400px', margin: '0 auto'}}>
          <div className="text-center mb-8 cinematic-reveal">
            <span className="font-label text-gold">The Experience</span>
            <h2 className="font-headline" style={{color: 'var(--primary)', fontSize: '2.5rem', marginTop: '1rem', marginBottom: '3rem'}}>
              Beyond a Marketplace
            </h2>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem'}}>
            <div className="value-card cinematic-reveal" style={{padding: '3rem', background: 'var(--pure-white)', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)'}}>
              <span className="material-symbols-outlined text-gold" style={{fontSize: '3rem', marginBottom: '1.5rem'}}>diamond</span>
              <h3 className="font-headline" style={{color: 'var(--primary)', marginBottom: '1rem'}}>Artisan Crafted</h3>
              <p style={{color: 'var(--on-surface)', lineHeight: 1.6}}>Discover elite, hand-selected curators representing the pinnacle of craftsmanship and beauty.</p>
            </div>
            <div className="value-card cinematic-reveal" style={{padding: '3rem', background: 'var(--pure-white)', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)'}}>
              <span className="material-symbols-outlined text-gold" style={{fontSize: '3rem', marginBottom: '1.5rem'}}>diversity_3</span>
              <h3 className="font-headline" style={{color: 'var(--primary)', marginBottom: '1rem'}}>Divine Networking</h3>
              <p style={{color: 'var(--on-surface)', lineHeight: 1.6}}>Immerse yourself in a community of visionary women, cultivating powerful, faith-driven connections.</p>
            </div>
            <div className="value-card cinematic-reveal" style={{padding: '3rem', background: 'var(--pure-white)', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)'}}>
              <span className="material-symbols-outlined text-gold" style={{fontSize: '3rem', marginBottom: '1.5rem'}}>nightlife</span>
              <h3 className="font-headline" style={{color: 'var(--primary)', marginBottom: '1rem'}}>Exclusive Ambiance</h3>
              <p style={{color: 'var(--on-surface)', lineHeight: 1.6}}>Enjoy a majestic, high-end shopping atmosphere elevated by curated aesthetics and live music.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="vision-section section-padded" id="about">
        <div className="vision-grid">
          <div className="vision-img-container cinematic-reveal" style={{position: 'relative'}}>
            <div className="vision-img-wrapper">
              <video src={curatorVid} autoPlay loop muted playsInline className="img-parallax" style={{width: '100%', height: '120%', objectFit: 'cover'}} />
            </div>
            <div className="vision-badge">
              <span>7+</span>
              <span className="font-label">Categories<br/>of Excellence</span>
            </div>
          </div>
          <div className="vision-text cinematic-reveal">
            <span className="font-label text-gold">Our Mission</span>
            <h3 className="font-headline">Empowering Women to Rise and Build</h3>
            <p style={{lineHeight: 1.8, marginBottom: '2rem'}}>
              Proverbs 31 Marketplace is more than a shopping event, it is a traveling sanctuary for creativity. We honor the modern woman of influence by providing a premium platform to showcase her divine gifts. Every curator is hand-selected, representing the pinnacle of craftsmanship, beauty, and entrepreneurial excellence. Rooted in purpose, we create spaces where faith and luxury converge.
            </p>
            
            <div className="categories-grid">
              <div className="category-item"><span className="material-symbols-outlined">palette</span> Art</div>
              <div className="category-item"><span className="material-symbols-outlined">spa</span> Wellness</div>
              <div className="category-item"><span className="material-symbols-outlined">styler</span> Clothing</div>
              <div className="category-item"><span className="material-symbols-outlined">restaurant</span> Food</div>
              <div className="category-item"><span className="material-symbols-outlined">menu_book</span> Literature</div>
              <div className="category-item"><span className="material-symbols-outlined">diversity_1</span> Community</div>
            </div>

            <Link to="/apply" style={{color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px'}}>
              Become a Vendor <span className="material-symbols-outlined text-primary">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Tour Dates */}
      <section className="tour-section section-padded" style={{background: 'var(--primary)', color: 'white'}}>
        <div className="tour-container cinematic-reveal" style={{maxWidth: '1000px', margin: '0 auto'}}>
          <div className="text-center mb-8">
            <span className="font-label text-gold">Upcoming Dates</span>
            <h2 className="font-headline" style={{fontSize: '3rem', marginTop: '1rem', color: 'white', marginBottom: '3rem'}}>The Tour Continues</h2>
          </div>
          <div style={{borderTop: '1px solid rgba(255,255,255,0.1)'}}>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '2rem', padding: '3rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)', alignItems: 'center'}}>
              <div style={{flex: '1', minWidth: '150px'}}>
                <span className="font-headline text-gold" style={{fontSize: '2rem', display: 'block'}}>28</span>
                <span style={{textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem'}}>August '26</span>
              </div>
              <div style={{flex: '3', minWidth: '250px'}}>
                <h3 className="font-headline" style={{fontSize: '1.5rem', marginBottom: '0.5rem', color: 'white'}}>Atlanta Summer Pop-Up</h3>
                <p style={{color: 'rgba(255,255,255,0.7)', lineHeight: 1.6}}>An exclusive outdoor sanctuary featuring 30+ elite women creatives.</p>
              </div>
              <div style={{flex: '1', textAlign: 'right', minWidth: '150px'}}>
                 <a href="https://www.eventbrite.com/e/proverbs-31-marketplace-tickets-1984190041828" target="_blank" rel="noreferrer" className="btn-outline-white" style={{padding: '12px 24px', fontSize: '0.9rem'}}>RSVP</a>
              </div>
            </div>
            
            <div style={{display: 'flex', flexWrap: 'wrap', gap: '2rem', padding: '3rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)', alignItems: 'center'}}>
              <div style={{flex: '1', minWidth: '150px'}}>
                <span className="font-headline text-gold" style={{fontSize: '2rem', display: 'block'}}>TBA</span>
                <span style={{textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem'}}>Fall '26</span>
              </div>
              <div style={{flex: '3', minWidth: '250px'}}>
                <h3 className="font-headline" style={{fontSize: '1.5rem', marginBottom: '0.5rem', color: 'white'}}>Fall Collection Showcase</h3>
                <p style={{color: 'rgba(255,255,255,0.7)', lineHeight: 1.6}}>Highlighting seasonal apparel, rich fragrances, and luxury homeware for autumn.</p>
              </div>
              <div style={{flex: '1', textAlign: 'right', minWidth: '150px'}}>
                 <span style={{color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem'}}>Incoming</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visionary Section */}
      <section id="visionary" className="about-cinematic section-padded" style={{display: 'block', backgroundColor: '#050505', color: 'white'}}>
        <style>{`
          .visionary-video-float {
            float: left;
            width: 350px;
            aspect-ratio: 9/16;
            margin-right: 3rem;
            margin-bottom: 2rem;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            overflow: hidden;
            background: #111;
          }
          @media (max-width: 900px) {
            .visionary-video-float {
              float: none;
              width: 100%;
              max-width: 400px;
              margin: 0 auto 3rem auto;
            }
          }
        `}</style>
        <div className="container-fluid" style={{maxWidth: '1200px', margin: '0 auto'}}>
          <div className="visionary-content-wrapper">
            <div className="visionary-video-float cinematic-reveal">
              <video src={melanieVid} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            
            <div className="visionary-text-content cinematic-reveal" style={{paddingTop: '1rem'}}>
              <h4 className="overline-gold" style={{color: 'var(--metallic-gold)', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem'}}>The Visionary</h4>
              <h2 className="margin-bottom-large font-headline" style={{marginBottom: "2rem", fontSize: '2.5rem', color: 'white'}}>Melanie Jeffers-Cameron</h2>
              
              <p className="about-lead" style={{fontSize: '1.25rem', color: 'rgba(255,255,255,0.9)', marginBottom: '1.5rem', lineHeight: 1.6}}>
                A visionary leader, faith-driven mentor, and purpose-driven entrepreneur dedicated to guiding others toward healing, restoration, and divine alignment.
              </p>
              
              <p style={{marginBottom: '1.5rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.7)'}}>
                In 2019, Melanie received a God-given assignment—to heal from her trauma and use her testimonies to become and create everything she once needed. She’s been obedient since. When asked why she kept building, her response is simple: <span className="quote-inline" style={{fontStyle: 'italic', color: 'var(--metallic-gold)'}}>“Purpose saved my life. God’s not done with me yet.”</span>
              </p>
              
              <p style={{marginBottom: '1.5rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.7)'}}>
                As the founder of <a href="https://www.nebaministry.org/" target="_blank" rel="noreferrer" className="link-gold-inline" style={{color: 'var(--metallic-gold)', textDecoration: 'underline'}}>NEBA Ministry</a>, she has created a sacred space for deep mentorship, accountability, and breaking generational cycles alongside her team's outreach. She is also the CEO of <a href="https://www.nebaministry.org/ilcollection" target="_blank" rel="noreferrer" className="link-gold-inline" style={{color: 'var(--metallic-gold)', textDecoration: 'underline'}}>Incandescent Lily Collection</a>, a luxury boutique reflecting her passion for holistic wellness and the belief that self-care is an extension of self-worth.
              </p>
              
              <p style={{marginBottom: '1.5rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.7)'}}>
                Through P31 Marketplace, her perspicacious leadership, and her ongoing ministry, Melanie is dedicated to helping individuals walk in their God-given gifts—healing, realigning, and rising into the fullness of their purpose.
              </p>
            </div>
            
            <div style={{clear: 'both'}}></div>
          </div>
        </div>
      </section>

      {/* Vendor CTA */}
      <section className="cta-section section-padded">
        <div className="cta-card cinematic-reveal shadow-lg">
          <div className="cta-text">
            <h2 className="font-headline">Ready to showcase your talent?</h2>
            <p>
              Applications are now open for our March 29th Grand Launch and future markets. Join a community of over 50+ women-led brands.
            </p>
            <Link to="/apply" className="btn-solid-gold" style={{display: 'inline-block'}}>
              Become a Vendor
            </Link>
          </div>
          <video src={melanieVid} autoPlay loop muted playsInline className="cta-bg-img" />
        </div>
      </section>
      
      <EventPopup />
    </div>
  );
};

export default Home;
