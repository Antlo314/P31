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
import founderImg from '../assets/melanie.jpg';
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

      {/* About The Founder Section */}
      <section className="about-cinematic section-padded" id="about-founder">
        <div className="container-fluid flex-center column">
          <div className="about-grid">
            <div className="about-img-container cinematic-reveal">
              <div className="founder-img-wrapper">
                <img src={founderImg} alt="Melanie Jeffers-Cameron" className="img-parallax cinematic-founder-img" />
                <div className="founder-img-overlay"></div>
              </div>
            </div>
            
            <div className="about-text-container cinematic-reveal">
              <h4 className="overline-gold">The Visionary</h4>
              <h2 className="margin-bottom-large" style={{marginBottom: "2rem"}}>Melanie Jeffers-Cameron</h2>
              
              <p className="about-lead">
                A visionary leader, faith-driven mentor, and purpose-driven entrepreneur dedicated to guiding others toward healing, restoration, and divine alignment.
              </p>
              
              <p>
                In 2019, Melanie received a God-given assignment—to heal from her trauma and use her testimonies to become and create everything she once needed. She’s been obedient since. When asked why she kept building, her response is simple: <span className="quote-inline">“Purpose saved my life. God’s not done with me yet.”</span>
              </p>
              
              <p>
                As the founder of <a href="https://www.nebaministry.org/" target="_blank" rel="noreferrer" className="link-gold-inline">NEBA Ministry</a>, she has created a sacred space for deep mentorship, accountability, and breaking generational cycles alongside her team's outreach. She is also the CEO of <a href="https://www.nebaministry.org/ilcollection" target="_blank" rel="noreferrer" className="link-gold-inline">Incandescent Lily Collection</a>, a luxury boutique reflecting her passion for holistic wellness and the belief that self-care is an extension of self-worth.
              </p>
              
              <p>
                Through P31 Marketplace, her perspicacious leadership, and her ongoing ministry, Melanie is dedicated to helping individuals walk in their God-given gifts—healing, realigning, and rising into the fullness of their purpose.
              </p>
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
