import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Home.css';

import mainLogo from '../assets/23BC16A7-6829-41F2-9EC4-E6BA907BC9D0.png';
import heroVid from '../assets/hero.mp4';
import curatorVid from '../assets/curator.mp4';
import productVid from '../assets/product.mp4';
import faithVid from '../assets/faith.mp4';
import launchImg from '../assets/march29.jpg';
gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      // Cinematic Logo Fade In
      gsap.fromTo('.cinematic-logo', 
        { scale: 0.8, opacity: 0, filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(0.9) drop-shadow(0 0 0px rgba(212, 175, 55, 0))' },
        { 
          scale: 1, 
          opacity: 1, 
          filter: 'sepia(1) saturate(3) hue-rotate(10deg) brightness(0.9) drop-shadow(0 0 40px rgba(212, 175, 55, 0.8)) drop-shadow(0 0 80px rgba(212, 175, 55, 0.4))',
          duration: 3, 
          ease: 'power3.out', 
          delay: 0.2 
        }
      );

      // Hero Background Pan
      gsap.fromTo('.hero-bg-img',
        { scale: 1.15, opacity: 0 },
        { scale: 1.05, opacity: 1, duration: 4, ease: 'power2.out' }
      );

      // Scroll Parallax for Hero Text
      gsap.to('.hero-text-content', {
        yPercent: 40,
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
            y: 0, opacity: 1, filter: 'blur(0px)', duration: 2, ease: 'power2.out',
            scrollTrigger: {
              trigger: elem,
              start: 'top 80%',
            }
          }
        );
      });
      
      // Image Parallax Blocks
      const parallaxImgs = gsap.utils.toArray('.img-parallax');
      parallaxImgs.forEach(img => {
        gsap.to(img, {
          yPercent: 20,
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
    <div className="home-cinematic-wrapper" ref={containerRef}>
      
      {/* Cinematic Hero Section */}
      <section className="hero-cinematic flex-center">
        <div className="hero-bg-wrapper">
          <video src={heroVid} autoPlay loop muted playsInline className="hero-bg-img" />
          <div className="hero-gradient-overlay"></div>
        </div>
        
        <div className="hero-text-content flex-center column">
          <img src={mainLogo} alt="P31 Original" className="cinematic-logo" />
          <h2 className="hero-tagline">Proverbs 31 Marketplace</h2>
          <div className="hero-enter-container">
            <Link to="/directory" className="btn-cinematic-gold">Enter The Sanctuary</Link>
          </div>
        </div>
      </section>

      {/* Cinematic Quote Section */}
      <section className="quote-cinematic section-padded" style={{ position: 'relative', overflow: 'hidden' }}>
        <video src={faithVid} autoPlay loop muted playsInline className="quote-bg-vid" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4, zIndex: 1 }} />
        <div className="container-fluid text-center cinematic-reveal" style={{ position: 'relative', zIndex: 2 }}>
          <h3 className="quote-text">
            “Give her of the fruit of her hands;<br/>
            And let her own works praise her in the gates.”
          </h3>
          <p className="quote-ref">— Proverbs 31:31 —</p>
        </div>
      </section>

      {/* Full-bleed Immerse Section */}
      <section className="immerse-section">
        <div className="immerse-text cinematic-reveal">
          <h4 className="overline-gold">The Experience</h4>
          <h2>Unparalleled Craftsmanship</h2>
          <p>Discover independent visionaries redefining premium artistry. A traveling sanctuary of creativity, curating the finest in handmade, artisanal, and fashion luxury.</p>
          <Link to="/about" className="link-gold">Explore The Vision</Link>
        </div>
        <div className="immerse-img-wrapper">
           <video src={productVid} autoPlay loop muted playsInline className="img-parallax" style={{ width: '100%', height: '120%', objectFit: 'cover' }} />
           <div className="immerse-img-overlay"></div>
        </div>
      </section>

      {/* Grand Launch Section */}
      <section className="launch-cinematic section-padded" id="launch-event">
        <div className="container-fluid flex-center column">
          <div className="about-grid">
            
            <div className="about-text-container cinematic-reveal" style={{ order: 1 }}>
              <h4 className="overline-gold">Grand Launch Event</h4>
              <h2 className="margin-bottom-large" style={{marginBottom: "1rem"}}>Proverbs 31 Marketplace</h2>
              <h3 style={{color: 'var(--metallic-gold)', letterSpacing: '2px', fontWeight: '300', marginBottom: '2rem'}}>
                &quot;Where Her Gifts Make Room.&quot;
              </h3>
              
              <div className="launch-details">
                <p><strong>Date:</strong> Sunday, March 29th, 2026</p>
                <p><strong>Time:</strong> Doors open at 3:30 PM</p>
                <p><strong>Venue:</strong> Embassy Suites by Hilton Atlanta NE</p>
                <p><strong>Address:</strong> 2029 Satellite Blvd, Duluth, GA 30097</p>
                <p style={{opacity: 0.6, fontSize: '0.9rem', marginTop: '0.5rem'}}><em>(Located across from Gas South Arena)</em></p>
              </div>

              <div className="launch-description" style={{marginTop: '2rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.8'}}>
                <p>A traveling marketplace honoring women creatives. We are bringing together Art, Beauty, Clothing, Food, Literature, Wellness, and Community. Join us and support a movement where women create, connect, and build legacy.</p>
              </div>
              
              <div style={{marginTop: '3rem'}}>
                <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" className="btn-cinematic-gold">
                  Apply &amp; RSVP
                </a>
              </div>
            </div>

            <div className="about-img-container cinematic-reveal" style={{ order: 2 }}>
              <div className="founder-img-wrapper" style={{boxShadow: '0 0 50px rgba(134, 59, 255, 0.3)', aspectRatio: 'auto', minHeight: '600px'}}>
                <img src={launchImg} alt="Launch Event Flyer" className="img-parallax cinematic-launch-img" style={{ width: '100%', height: '120%', objectFit: 'cover', filter: 'contrast(105%) brightness(0.9)', transform: 'scale(1.05)' }} />
                <div className="founder-img-overlay" style={{background: 'linear-gradient(to right, rgba(8,3,16,0.9) 0%, rgba(8,3,16,0) 30%, transparent 100%)'}}></div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* The Curators Section */}
      <section className="curators-cinematic section-padded">
        <div className="container-fluid cinematic-reveal text-center">
          <h4 className="overline-gold">The Curators</h4>
          <h2 className="margin-bottom-large">Meet The Makers</h2>
        </div>
        
        <div className="curator-showcase-container">
          <Link to="/directory" className="curator-card cinematic-reveal">
            <div className="card-img-wrapper">
              <video src={curatorVid} autoPlay loop muted playsInline className="img-parallax" style={{ width: '100%', height: '120%', objectFit: 'cover', transition: 'transform 1s cubic-bezier(0.16, 1, 0.3, 1)' }} />
            </div>
            <div className="card-info">
              <h3>Independent Visionaries</h3>
              <p>Join the movement of excellence.</p>
            </div>
          </Link>
          
          <div className="curator-actions flex-center column cinematic-reveal mt-4">
            <Link to="/calendar" className="btn-cinematic-outline">RSVP To The Next Show</Link>
            <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" className="link-underlined mt-4">Apply as a Vendor</a>
          </div>
        </div>
      </section>
      
    </div>
  );
};

export default Home;
