import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { Sparkles, Crown, ArrowRight } from 'lucide-react';
import './FeaturedCurator.css';

import melanieAvatar from '../assets/melanie_rm_1.png';
import oilImg from '../assets/curators/ilcollection/oil.png';
import logoImg from '../assets/curators/ilcollection/logo.png';

const MIST_WIX_URL = 'https://static.wixstatic.com/media/a60154_6mzv95gw89fc41d08679ba2089fc41d08679ba20~mv2.png';

const FeaturedCurator = () => {
  const sectionRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from('.fc-parallax-bg', {
        yPercent: 20,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });

      gsap.from('.fc-content > *', {
        opacity: 0,
        y: 40,
        duration: 1.2,
        stagger: 0.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.fc-content',
          start: 'top 80%',
        }
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section className="featured-curator-section" ref={sectionRef}>
      <div className="fc-parallax-wrap">
        <div className="fc-parallax-bg" />
      </div>
      
      <div className="fc-overlay" />
      
      <div className="container-fluid fc-container">
        <div className="fc-grid">
          <div className="fc-content">
            <div className="fc-badge">
              <Crown size={16} className="text-gold" />
              <span>Master Architect Featured</span>
            </div>
            
            <h2 className="fc-headline font-headline">
              The Divine <br />
              <em>Sanctuary.</em>
            </h2>
            
            <p className="fc-subline">
              Explore the Incandescent Lily Collection. A bespoke suite of wellness and body care 
              crafted by our Matriarch, Melanie Jeffers-Cameron.
            </p>
            
            <div className="fc-quote">
              <p>"Purity is not a destination, it's the foundation of every gift we offer."</p>
              <span>&mdash; MELANIE J.C.</span>
            </div>

            <div className="fc-actions">
              <Link to="/ilcollection" className="btn-solid-gold">
                Visit Sanctuary <ArrowRight size={18} />
              </Link>
            </div>
          </div>
          
          <div className="fc-visual">
            <div className="fc-main-card glass-card">
              <img src={logoImg} alt="IL Collection" className="fc-logo" />
              <div className="fc-product-glance">
                <div className="fc-product-mini">
                  <img src={MIST_WIX_URL} alt="Enlighten Mist" />
                  <span>Enlighten Mist</span>
                </div>
                <div className="fc-product-mini">
                  <img src={oilImg} alt="Soul Glow Oil" />
                  <span>Soul Glow Oil</span>
                </div>
              </div>
            </div>
            
            <div className="fc-floating-avatar">
              <img src={melanieAvatar} alt="Melanie" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedCurator;
