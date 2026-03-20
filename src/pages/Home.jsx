import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Home.css';

import mainLogo from '../assets/23BC16A7-6829-41F2-9EC4-E6BA907BC9D0.png';
import heroImg from '../assets/vendor_portrait_1_1773958576935.png';
import featImg1 from '../assets/vendor_portrait_2_1773958606609.png';
import featImg2 from '../assets/vendor_products_1_1773958590103.png';

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      // Cinematic Logo Fade In
      gsap.fromTo('.cinematic-logo', 
        { scale: 0.8, opacity: 0, filter: 'drop-shadow(0 0 0px rgba(212, 175, 55, 0))' },
        { 
          scale: 1, 
          opacity: 1, 
          filter: 'drop-shadow(0 0 40px rgba(212, 175, 55, 0.6)) drop-shadow(0 0 80px rgba(212, 175, 55, 0.3))',
          duration: 3, 
          ease: 'power3.out', 
          delay: 0.2 
        }
      );

      // Hero Background Pan
      gsap.fromTo('.hero-bg-img',
        { scale: 1.15, opacity: 0 },
        { scale: 1.05, opacity: 0.5, duration: 4, ease: 'power2.out' }
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
          <img src={heroImg} alt="Atmospheric Background" className="hero-bg-img" />
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
      <section className="quote-cinematic section-padded">
        <div className="container-fluid text-center cinematic-reveal">
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
           <img src={featImg2} alt="Premium Crafts" className="img-parallax" />
           <div className="immerse-img-overlay"></div>
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
              <img src={featImg1} alt="Creator Portrait" className="img-parallax" />
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
