import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Home.css';

import heroVid from '../assets/hero.mp4';
import curatorVid from '../assets/curator.mp4';
import productVid from '../assets/product.mp4';
import faithVid from '../assets/faith.mp4';
import flyerImg from '../assets/march29.jpg';

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
              <p style={{color: 'var(--on-surface-variant)', lineHeight: 1.6, fontWeight: 500}}>
                Embassy Suites by Hilton<br/>
                Atlanta NE/Gwinnett Sugarloaf<br/>
                2029 Satellite Blvd<br/>
                Duluth, GA 30097
              </p>
            </div>
            <p style={{fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--outline)', paddingLeft: '2.5rem', marginBottom: '2rem'}}>
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
            <p>
              The Proverbs 31 Marketplace is more than a shopping event—it is a traveling sanctuary for creativity. We celebrate the modern matriarch by providing a premium platform for women to showcase their divine gifts.
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
          <video src={productVid} autoPlay loop muted playsInline className="cta-bg-img" />
        </div>
      </section>
      
    </div>
  );
};

export default Home;
