import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import './Directory.css';
import vendor1 from '../assets/vendor_candles.png';
import vendor2 from '../assets/vendor_skincare.png';
import vendor3 from '../assets/vendor_ceramics.png';
import vendor4 from '../assets/vendor_jewelry.png';

const vendors = [
  {
    id: 5,
    name: 'Melanie',
    businessName: 'Incandescent Lily Collection',
    bio: 'Transforming the beauty industry by creating wellness and body care rooted in purity, purpose, and divine intention.',
    products: 'Plant-Based Bodycare, Wellness',
    image: 'https://static.wixstatic.com/media/a60154_732e513fd3594078b0b4c1d08679ba20~mv2.png',
    social: 'https://instagram.com/ilcollection__'
  },
  {
    id: 1,
    name: 'Serena James',
    businessName: 'Luminescent Essentials',
    bio: 'Artisanal candle maker specializing in non-toxic, eco-friendly luxury candles.',
    products: 'Soy Candles, Diffusers',
    image: vendor1,
    social: 'https://instagram.com/luminescent_essentials'
  },
  {
    id: 2,
    name: 'Aaliyah Brown',
    businessName: 'Royal Plum Beauty',
    bio: 'Handmade organic skincare goods crafted for sensitive skin targeting natural glow.',
    products: 'Organic Soaps, Body Butter',
    image: vendor2,
    social: 'https://instagram.com/royalplum_beauty'
  },
  {
    id: 3,
    name: 'Chloe Monet',
    businessName: 'Monet Artistry',
    bio: 'Premium handmade crafts and home decor blending modern design with earthy tones.',
    products: 'Ceramics, Wall Art',
    image: vendor3,
    social: 'https://instagram.com/monet_artistry'
  },
  {
    id: 4,
    name: 'Imogen Luxe',
    businessName: 'Aurum Jewelry',
    bio: 'Fine bespoke jewelry designed for the modern woman using ethically sourced gold.',
    products: 'Gold Necklaces, Rings',
    image: vendor4,
    social: 'https://instagram.com/aurum_jewelry'
  }
];

const Directory = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from('.v2-vendor-item', {
        opacity: 0,
        y: 80,
        duration: 1.2,
        stagger: 0.2,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.directory-list-v2',
          start: 'top 80%',
        }
      });
      
      gsap.from('.dir-header-title', {
        opacity: 0, x: -50, duration: 1, ease: 'power3.out', delay: 0.2
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="directory-v2" ref={containerRef}>
      <div className="container-fluid dir-header-v2" style={{position: 'relative'}}>
        <div style={{position: 'absolute', top: 0, left: 0, width: '100%', background: 'linear-gradient(90deg, #320E2C 0%, #CBA72F 50%, #320E2C 100%)', color: 'white', textAlign: 'center', padding: '10px 0', fontSize: '0.85rem', letterSpacing: '2px', fontWeight: 600, textTransform: 'uppercase'}}>
          Curators Directory Currently Under Construction
        </div>
        <h1 className="dir-header-title" style={{marginTop: '40px'}}>The Curators.</h1>
        <p className="dir-header-sub">Discover the women defining excellence at P31 Marketplace.</p>
      </div>

      <div className="directory-list-v2 container-fluid">
        {vendors.map((vendor, index) => (
          <div key={vendor.id} className={`v2-vendor-item ${index % 2 !== 0 ? 'vendor-reverse' : ''}`}>
            <div className="v2-vendor-img-wrap">
              <img src={vendor.image} alt={vendor.businessName} className="v2-vendor-img" />
            </div>
            <div className="v2-vendor-content">
              <h4 className="v2-vendor-meta">{vendor.name} &mdash; {vendor.products}</h4>
              <h2 className="v2-vendor-biz">{vendor.businessName}</h2>
              <p className="v2-vendor-bio">{vendor.bio}</p>
              {vendor.id === 5 ? (
                <Link to={`/curator/${vendor.id}`} className="v2-vendor-link btn-outline">
                  Explore Collection
                </Link>
              ) : (
                <span className="v2-vendor-link btn-outline" style={{opacity: 0.5, cursor: 'not-allowed', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)', pointerEvents: 'none'}}>
                  Profile Coming Soon
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Directory;
