import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Home.css';

import premiumMarketLogo from '../assets/premium_logo_2_1773960279606.png';
// Actually I will import the mock vendor images directly
import heroImg from '../assets/vendor_portrait_1_1773958576935.png';
import featImg1 from '../assets/vendor_portrait_2_1773958606609.png';
import featImg2 from '../assets/vendor_products_1_1773958590103.png';

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      // Fluid Hero Animation
      gsap.fromTo('.hero-large-text .word', 
        { yPercent: 120, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.2, stagger: 0.1, ease: 'power4.out', delay: 0.5 }
      );

      gsap.fromTo('.hero-img-wrapper',
        { scale: 1.2, opacity: 0 },
        { scale: 1, opacity: 1, duration: 2, ease: 'expo.out' }
      );

      // Parallax scroll
      gsap.to('.hero-img', {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-v2',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        }
      });

      // Section Reveals
      const reveals = gsap.utils.toArray('.reveal-up');
      reveals.forEach(elem => {
        gsap.fromTo(elem, 
          { y: 100, opacity: 0 },
          { 
            y: 0, opacity: 1, duration: 1.5, ease: 'power3.out',
            scrollTrigger: {
              trigger: elem,
              start: 'top 85%',
            }
          }
        );
      });

    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="home-v2" ref={containerRef}>
      
      {/* V2 Hero Section */}
      <section className="hero-v2">
        <div className="hero-img-wrapper">
          <img src={heroImg} alt="Creative Woman" className="hero-img" />
          <div className="hero-overlay"></div>
        </div>
        
        <div className="hero-content-v2 container-fluid">
          <div className="hero-logo-container">
             <img src={premiumMarketLogo} alt="P31" className="premium-logo-center" />
          </div>
          
          <h1 className="hero-large-text">
            <span className="v2-text-mask-wrapper"><span className="word block">Empower</span></span>
            <span className="v2-text-mask-wrapper"><span className="word block">Women</span></span><br/>
            <span className="v2-text-mask-wrapper"><span className="word block">To Rise &</span></span>
            <span className="v2-text-mask-wrapper"><span className="word block">Build</span></span>
          </h1>
          
          <div className="hero-cta-area">
            <Link to="/directory" className="btn-primary">The Curators</Link>
          </div>
        </div>
      </section>

      {/* V2 Scripture Section - Asymmetric */}
      <section className="scripture-v2 section-fluid container-fluid">
        <div className="scripture-grid-v2">
          <div className="scripture-quote-col reveal-up">
            <h2 className="v2-scripture">
              "Give her of the fruit of her hands; And let her own works praise her in the gates."
            </h2>
            <p className="v2-scripture-ref">Proverbs 31:31 KJV</p>
          </div>
          <div className="scripture-img-col reveal-up">
             <div className="v2-img-reveal">
               <img src={featImg2} alt="Premium Products" />
             </div>
          </div>
        </div>
      </section>

      {/* V2 Brand Statement */}
      <section className="statement-v2 section-fluid">
        <div className="container-fluid flex-center text-center">
          <h3 className="statement-text reveal-up">
            We are a traveling sanctuary of creativity.<br/>
            Curating the finest in handmade, artisanal, and fashion luxury.<br/>
            Where faith meets excellence.
          </h3>
        </div>
      </section>

      {/* V2 Featured Creators */}
      <section className="featured-v2 section-fluid container-fluid">
        <div className="featured-header reveal-up">
          <h4 className="v2-overline">The Experience</h4>
          <h2>Unparalleled Craftsmanship</h2>
        </div>
        
        <div className="featured-grid-v2">
          <div className="feat-col-left reveal-up">
            <Link to="/directory" className="feat-block hover-lift">
              <img src={featImg1} alt="Creator" />
              <div className="feat-info">
                <h5>Meet the Makers</h5>
                <p>Discover independent visionaries.</p>
              </div>
            </Link>
          </div>
          <div className="feat-col-right reveal-up" style={{marginTop: '15vh'}}>
             <Link to="/calendar" className="feat-block hover-lift">
               <div className="feat-color-block">
                 <h2>RSVP To The Next Show</h2>
                 <p className="text-gold">Atlanta, GA</p>
               </div>
             </Link>
             <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" className="feat-block hover-lift" style={{marginTop: '5vh'}}>
               <div className="feat-color-block outline-block">
                 <h2>Apply as a Vendor</h2>
                 <p>Join the movement.</p>
               </div>
             </a>
          </div>
        </div>
      </section>
      
    </div>
  );
};

export default Home;
