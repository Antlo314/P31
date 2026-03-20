import React, { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './CuratorProfile.css';

// We import the curator images from Directory logic 
// (In a real app, this would come from a database)
import vendorCandles from '../assets/vendor_candles.png';
import vendorSkincare from '../assets/vendor_skincare.png';
import placeholderProduct from '../assets/generic_p31_product.png';

gsap.registerPlugin(ScrollTrigger);

const curatorData = {
  1: {
    name: 'Serena James',
    businessName: 'Luminescent Essentials',
    tagline: 'Illuminating spaces with pure, non-toxic luxury.',
    bio: 'Serena James brings healing through the power of scent. Her hand-poured, artisanal candles are crafted in small batches to ensure environmentally flawless, therapeutic experiences. P31 is proud to showcase her mastery of light and fragrance.',
    heroImage: vendorCandles,
    products: [
      { id: 101, name: 'Royal Plum Amber Diffuser', price: '$45.00' },
      { id: 102, name: 'Frankincense & Myrrh Candle', price: '$55.00' },
      { id: 103, name: 'Golden Hour Massage Candle', price: '$65.00' },
      { id: 104, name: 'Sovereign Oudh Collection', price: '$120.00' }
    ]
  },
  2: {
    name: 'Aaliyah Brown',
    businessName: 'Royal Plum Beauty',
    tagline: 'Redefining organic radiance for the sensitive soul.',
    bio: 'Aaliyah Brown crafts skincare as a ritual of self-love. Formulated organically to breathe life back into worn skin, Royal Plum Beauty is a testimony to the earth’s natural restoring properties. Experience her exquisite body butters and glowing serums.',
    heroImage: vendorSkincare,
    products: [
      { id: 201, name: 'P31 Virtuous Glow Serum', price: '$75.00' },
      { id: 202, name: 'Whipped Shea & Plum Butter', price: '$40.00' },
      { id: 203, name: 'Restorative Night Elixir', price: '$85.00' },
      { id: 204, name: 'Botanical Bath Soak Trio', price: '$50.00' }
    ]
  }
};

const CuratorProfile = () => {
  const { id } = useParams();
  const containerRef = useRef(null);
  
  // Fallback to curator 1 if invalid
  const curator = curatorData[id] || curatorData[1];

  useEffect(() => {
    let ctx = gsap.context(() => {
       gsap.fromTo('.cp-hero-text', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.5, ease: 'power3.out' });
       
       gsap.from('.cp-product-card', {
         opacity: 0,
         y: 50,
         duration: 1,
         stagger: 0.15,
         scrollTrigger: {
           trigger: '.cp-products-grid',
           start: 'top 85%'
         }
       });
    }, containerRef);
    return () => ctx.revert();
  }, [id]);

  return (
    <div className="curator-profile-page" ref={containerRef}>
      
      {/* Curator Hero Header */}
      <section className="cp-hero-section">
         <div className="cp-hero-bg">
            <img src={curator.heroImage} alt={curator.name} className="cp-hero-img" />
            <div className="cp-hero-gradient"></div>
         </div>
         <div className="cp-hero-text container-fluid">
            <Link to="/directory" className="link-gold-inline" style={{marginBottom: '2rem', display: 'inline-block'}}>&larr; Back to Directory</Link>
            <h4 className="overline-gold">{curator.name}</h4>
            <h1 className="cp-biz-name">{curator.businessName}</h1>
            <p className="cp-biz-tagline">{curator.tagline}</p>
         </div>
      </section>

      {/* Curator Bio & Story */}
      <section className="cp-bio-section section-padded">
        <div className="container-fluid text-center">
            <h2 style={{color: 'var(--pure-white)', marginBottom: '2rem'}}>The Hands That Build</h2>
            <p className="cp-bio-text">{curator.bio}</p>
        </div>
      </section>

      {/* Products Showcase */}
      <section className="cp-products-section section-padded">
        <div className="container-fluid">
           <div className="cp-products-header">
              <h3>The Collection</h3>
              <div className="divider-gold"></div>
           </div>

           <div className="cp-products-grid">
              {curator.products.map(product => (
                <div key={product.id} className="cp-product-card">
                   <div className="cp-product-img-wrapper">
                      <img src={placeholderProduct} alt="P31 Generic Product Placeholder" className="cp-product-img" />
                      <div className="cp-product-hover">
                         <span>View Details</span>
                      </div>
                   </div>
                   <div className="cp-product-info">
                      <h4>{product.name}</h4>
                      <p className="cp-product-price">{product.price}</p>
                   </div>
                </div>
              ))}
           </div>
        </div>
      </section>

    </div>
  );
};

export default CuratorProfile;
