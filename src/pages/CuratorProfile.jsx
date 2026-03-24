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
  5: {
    name: 'Melanie',
    businessName: 'Incandescent Lily Collection',
    tagline: 'Wellness and body care rooted in purity, purpose, and divine intention.',
    bio: 'At Incandescent Lily, we are transforming the beauty industry by creating wellness and body care rooted in purity, purpose, and divine intention. Our collection consists of luxurious wellness and body care products crafted with pure ingredients derived from the plants given to us by God. We believe that true beauty and healing is experienced through the way we nurture our spirit mind and body.',
    heroImage: 'https://static.wixstatic.com/media/a60154_732e513fd3594078b0b4c1d08679ba20~mv2.png',
    contact: {
      email: 'hello@nebaministry.org',
      phone: '+1 (470) 562-2852',
      address: 'Atlanta, GA',
      website: 'nebaministry.org/ilcollection',
      instagram: '@ilcollection__'
    },
    events: [
      { id: 1, date: 'Mar 29', name: 'P31 Grand Launch Event', location: 'Embassy Suites, Duluth, GA' }
    ],
    products: [
      { id: 501, name: 'Resolved™ A 30-Day Mentorship Devotional', price: '$17.99', imageUrl: 'https://static.wixstatic.com/media/023b68_cf305faf0edb4a439b635209757c2ee6~mv2.png' },
      { id: 502, name: 'Illumine™ Brightening & Anti-aging Serum', price: '$59.98', imageUrl: 'https://static.wixstatic.com/media/023b68_89c240ffcf5f4259a294815ae126c41d~mv2.png' },
      { id: 503, name: 'Enlighten Mist™ by IL Collection', price: '$17.98', imageUrl: 'https://static.wixstatic.com/media/023b68_2633224a4c7348daa15c904aa06772af~mv2.png' },
      { id: 504, name: 'Garden Restore™ Teas by IL Collection', price: '$16.98', imageUrl: 'https://static.wixstatic.com/media/023b68_98d473ae7dd941d4b0c19b8f66218345~mv2.png' },
      { id: 505, name: 'Restore™ Eye Cream', price: '$34.98', imageUrl: 'https://static.wixstatic.com/media/023b68_98de1d742a844fc3b5e3c9464daf6ed9~mv2.png' },
      { id: 506, name: 'Lip Love™ Brightening Balm', price: '$14.98', imageUrl: 'https://static.wixstatic.com/media/023b68_e5e4a3a726b34b74a609aa66196f235d~mv2.jpg' },
      { id: 507, name: 'Awaken™: A 30-Day Mentorship Devotional', price: '$17.99', imageUrl: 'https://static.wixstatic.com/media/a60154_d6d0c7e381034c38b7a10c3222fdbb8b~mv2.png' },
      { id: 508, name: 'Lemongrass Growth & Refresher Mist™', price: '$37.98', imageUrl: 'https://static.wixstatic.com/media/a60154_bea567e6bc8d497a8b90b3bfd7fe637a~mv2.png' },
      { id: 509, name: 'Awaken™ Healing Soy Candle', price: '$29.98', imageUrl: 'https://static.wixstatic.com/media/4ede06_cc29c619d0674c8da3f690014d15150a~mv2.png' },
      { id: 510, name: 'Manuka Honey Exfoliant Mask & Scrub', price: '$27.98', imageUrl: 'https://static.wixstatic.com/media/a60154_d47a8fe5c9e9443bb05203a7b5f5e2a7~mv2.png' },
      { id: 511, name: 'Woke™ Luxury Oil', price: '$27.98', imageUrl: 'https://static.wixstatic.com/media/a60154_2ec8d0a27e41440e8b1af6012cec4840~mv2.png' },
      { id: 512, name: 'Brightstar™ Manuka Honey Cleanser', price: '$27.98', imageUrl: 'https://static.wixstatic.com/media/a60154_1b9bd3b2c5fc481e93c4345f06424f34~mv2.png' },
      { id: 513, name: 'Reign Premium Plant-Based Sanitary Napkins', price: '$10.98', imageUrl: 'https://static.wixstatic.com/media/a60154_bfeb7ef5acfc4055b5f75f4120575dcd~mv2.jpg' },
      { id: 514, name: 'Favor™ Brightening Youth Face Serum', price: '$49.99', imageUrl: 'https://static.wixstatic.com/media/a60154_f94875201f7e4860add6148a89649e73~mv2.png' },
      { id: 515, name: 'Face & Body Healing Salve', price: '$54.98', imageUrl: 'https://static.wixstatic.com/media/a60154_3b623d2c73694d38b85067f772e21f33~mv2.png' },
      { id: 516, name: 'Glow & Grow Duo', price: '$87.98', imageUrl: 'https://static.wixstatic.com/media/a60154_ab5fac8fc89640acabdebc69d15872ab~mv2.png' },
      { id: 517, name: 'Blush & Bloom™ Collagen Rose Toner', price: '$25.98', imageUrl: 'https://static.wixstatic.com/media/4ede06_339efcba85de49ccb3b282be550e17df~mv2.jpg' },
      { id: 518, name: 'Incandescent Luxe Box™', price: '$174.98', imageUrl: 'https://static.wixstatic.com/media/a60154_732e513fd3594078b0b4c1d08679ba20~mv2.png' },
      { id: 519, name: 'Woke™ Oil & Scrub Bundle', price: '$49.98', imageUrl: 'https://static.wixstatic.com/media/a60154_49e4a5a0c74e4f1bb09676748c19b3a2~mv2.png' },
      { id: 520, name: 'Bundle - Woke™ His & Hers Luxury Oil', price: '$98.99', imageUrl: 'https://static.wixstatic.com/media/4ede06_7dbe0de9f064472ea9cb7ac5336ff835~mv2.png' }
    ]
  },
  1: {
    name: 'Serena James',
    businessName: 'Luminescent Essentials',
    tagline: 'Illuminating spaces with pure, non-toxic luxury.',
    bio: 'Serena James brings healing through the power of scent. Her hand-poured, artisanal candles are crafted in small batches to ensure environmentally flawless, therapeutic experiences. P31 is proud to showcase her mastery of light and fragrance.',
    heroImage: vendorCandles,
    contact: {
      email: 'inquiries@luminescentessentials.com',
      phone: '+1 (404) 555-0812',
      address: 'Atlanta, GA (Studio visits by appointment)',
      website: 'luminescentessentials.com',
      instagram: '@luminescent_essentials'
    },
    events: [
      { id: 1, date: 'Mar 29', name: 'P31 Grand Launch Event', location: 'Embassy Suites, Duluth, GA' },
      { id: 2, date: 'Apr 15', name: 'Spring Artisan Light Expo', location: 'Buckhead, GA' }
    ],
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
    contact: {
      email: 'hello@royalplumbeauty.com',
      phone: '+1 (770) 555-0943',
      address: 'Decatur, GA 30030',
      website: 'royalplumbeauty.com',
      instagram: '@royalplum_beauty'
    },
    events: [
      { id: 1, date: 'Mar 29', name: 'P31 Grand Launch Event', location: 'Embassy Suites, Duluth, GA' },
      { id: 2, date: 'May 02', name: 'Natural Beauty Summit', location: 'Atlanta Convention Center' }
    ],
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
  
  const isUnderConstruction = id !== '5';
  const curator = curatorData[id] || curatorData[5];

  useEffect(() => {
    if (isUnderConstruction) return;
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
  }, [id, isUnderConstruction]);

  if (isUnderConstruction) {
    return (
      <div className="curator-profile-page" style={{minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white', textAlign: 'center', padding: '2rem'}}>
        <span className="material-symbols-outlined text-gold" style={{fontSize: '4rem', marginBottom: '1rem'}}>construction</span>
        <h2 className="font-headline" style={{fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--metallic-gold)'}}>Profile Under Construction</h2>
        <p style={{color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', fontSize: '1.2rem'}}>This curator's exquisite collection is currently being curated for the digital space.</p>
        <Link to="/directory" className="btn-solid-gold">Return to Directory</Link>
      </div>
    );
  }

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

      {/* Curator Business & Bio Details */}
      <section className="cp-bio-section section-padded">
        <div className="container-fluid">
            <h2 className="cp-section-title text-center">The Hands That Build</h2>
            <div className="divider-gold"></div>
            
            <div className="cp-details-grid">
               {/* Left Column: Bio & Events */}
               <div className="cp-bio-column">
                  <p className="cp-bio-text">{curator.bio}</p>
                  
                  <div className="cp-events-card">
                     <h4 className="cp-card-title">Upcoming Appearances</h4>
                     <ul className="cp-events-list">
                       {curator.events.map(event => (
                          <li key={event.id}>
                             <div className="cp-event-date">{event.date}</div>
                             <div className="cp-event-info">
                                <strong>{event.name}</strong>
                                <span>{event.location}</span>
                             </div>
                          </li>
                       ))}
                     </ul>
                  </div>
               </div>

               {/* Right Column: Contact Info */}
               <div className="cp-contact-column">
                  <div className="cp-contact-card">
                     <h4 className="cp-card-title">Direct Concierge</h4>
                     
                     <div className="cp-contact-row">
                        <span className="cp-contact-label">Website</span>
                        <a href={`https://${curator.contact.website}`} target="_blank" rel="noreferrer" className="cp-contact-val link-gold-inline">{curator.contact.website}</a>
                     </div>
                     <div className="cp-contact-row">
                        <span className="cp-contact-label">Email</span>
                        <a href={`mailto:${curator.contact.email}`} className="cp-contact-val link-no-style">{curator.contact.email}</a>
                     </div>
                     <div className="cp-contact-row">
                        <span className="cp-contact-label">Phone</span>
                        <a href={`tel:${curator.contact.phone}`} className="cp-contact-val link-no-style">{curator.contact.phone}</a>
                     </div>
                     <div className="cp-contact-row">
                        <span className="cp-contact-label">Address</span>
                        <span className="cp-contact-val">{curator.contact.address}</span>
                     </div>
                     <div className="cp-contact-row" style={{borderBottom: 'none'}}>
                        <span className="cp-contact-label">Socials</span>
                        <span className="cp-contact-val" style={{color: 'var(--metallic-gold)'}}>{curator.contact.instagram}</span>
                     </div>
                  </div>
               </div>
            </div>
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
                <a key={product.id} href="https://www.nebaministry.org/ilcollection" target="_blank" rel="noreferrer" className="cp-product-card" style={{display: 'block', textDecoration: 'none'}}>
                   <div className="cp-product-img-wrapper" style={{background: '#ffffff'}}>
                      <img src={product.imageUrl || placeholderProduct} alt={product.name} className="cp-product-img" style={{objectFit: 'contain', padding: '1rem'}} />
                      <div className="cp-product-hover" style={{background: 'rgba(203, 167, 47, 0.9)'}}>
                         <span style={{color: '#241a00', fontWeight: 'bold', letterSpacing: '1px'}}>Secure at Checkout</span>
                      </div>
                   </div>
                   <div className="cp-product-info">
                      <h4>{product.name}</h4>
                      <p className="cp-product-price">{product.price}</p>
                   </div>
                </a>
              ))}
           </div>
        </div>
      </section>

    </div>
  );
};

export default CuratorProfile;
