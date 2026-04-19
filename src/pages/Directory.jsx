import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles, Leaf, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Directory.css';

import vendor1 from '../assets/vendor_candles.png';
import vendor2 from '../assets/vendor_skincare.png';
import vendor3 from '../assets/vendor_ceramics.png';
import vendor4 from '../assets/vendor_jewelry.png';

gsap.registerPlugin(ScrollTrigger);
const vendors = [
  {
    id: '545b1f22-6780-49a8-a3c6-408812815fb0',
    name: 'Melanie JC',
    businessName: 'Incandescent Lily Collection',
    bio: 'Transforming the beauty industry by creating wellness and body care rooted in purity, purpose, and divine intention. Built for the Proverbs 31 woman.',
    products: 'Bespoke Wellness, Bodycare',
    image: 'https://static.wixstatic.com/media/a60154_732e513fd3594078b0b4c1d08679ba20~mv2.png',
    social: 'https://instagram.com/ilcollection__',
    slug: 'ilcollection',
    isFounder: true,
    isAdmin: true
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
  const [activeVendors, setActiveVendors] = useState(vendors);

  useEffect(() => {
    fetchRealCurators();
  }, []);

  const fetchRealCurators = async () => {
    const { data } = await supabase
      .from('curator_data')
      .select('*, profiles(full_name, avatar_url, email)')
      .eq('status', 'approved'); // Only show approved sanctuaries
    
    // Pick Melanie (Matriarch) and 2 examples as requested
    const examples = vendors.filter(v => 
      v.id === '545b1f22-6780-49a8-a3c6-408812815fb0' || 
      v.id === 1 || 
      v.id === 4
    );
    
    if (data && data.length > 0) {
      const realVendors = data.map(d => ({
        id: d.id,
        name: d.profiles?.full_name || 'Artisan',
        businessName: d.business_name,
        bio: d.bio,
        products: d.tagline || 'P31 Collective',
        image: d.profiles?.avatar_url || vendor1,
        slug: d.slug,
        isFounder: d.is_early_bird,
        isAdmin: ['info@lumenlabsatl.com', 'proverbs31markets@gmail.com'].includes(d.profiles?.email?.toLowerCase())
      }));
      
      // Filter out those who haven't set up a business name yet (sanity check)
      const filtered = realVendors.filter(v => v.businessName);
      setActiveVendors([...filtered, ...examples]);
    } else {
      setActiveVendors(examples);
    }
  };
  useEffect(() => {
    let ctx = gsap.context(() => {
      // Stagger initial items
      gsap.from('.v2-vendor-item', {
        opacity: 0,
        y: 60,
        duration: 1.2,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.directory-list-v2',
          start: 'top 85%',
        }
      });
      
      gsap.from('.dir-header-title', {
        opacity: 0, y: 30, duration: 1, ease: 'power3.out', delay: 0.1
      });
      
      gsap.from('.dir-header-sub', {
        opacity: 0, y: 20, duration: 1, ease: 'power3.out', delay: 0.2
      });
    }, containerRef);
    return () => ctx.revert();
  }, [activeVendors]);

  return (
    <div className="directory-v2 font-body" ref={containerRef}>
      
      {/* Directory Header Section */}
      <section className="dir-header-v2 text-center" style={{ padding: '15vh 5vw 10vh' }}>
        
        {/* Elegant "Foundation" Badge */}
        <div className="glass-card flex-center" style={{ display: 'inline-flex', padding: '10px 24px', borderRadius: '40px', marginBottom: '3rem', border: '1px solid var(--outline-variant)' }}>
          <Leaf className="text-gold" size={16} style={{ marginRight: '8px' }} />
          <span className="font-label text-primary" style={{ letterSpacing: '2px', fontSize: '0.75rem' }}>The Foundation Founders</span>
        </div>
        
        <h1 className="dir-header-title font-headline text-primary" style={{ fontSize: 'clamp(3.5rem, 8vw, 6rem)', lineHeight: 1.1, marginBottom: '1.5rem' }}>
          The Curators.
        </h1>
        <p className="dir-header-sub" style={{ fontSize: '1.25rem', color: 'var(--on-surface-variant)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          Discover the women defining excellence at P31 Marketplace. From organic botanicals to fine jewelry, explore the pinnacle of craftsmanship.
        </p>
      </section>

      {/* Directory List Container */}
      <section className="directory-list-v2 container-fluid" style={{ paddingBottom: '15vh', maxWidth: '1400px', margin: '0 auto' }}>
        {activeVendors.map((vendor, index) => (
          <div key={vendor.id} className={`v2-vendor-item ${index % 2 !== 0 ? 'vendor-reverse' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6vw', marginBottom: '12vh' }}>
            
            {/* Vendor Image Wrap with Glass Border */}
            <div className="v2-vendor-img-wrap glass-border" style={{ flex: 1, position: 'relative', aspectRatio: '4/5', overflow: 'hidden' }}>
              <img src={vendor.image} alt={vendor.businessName} className="v2-vendor-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              
              {/* Prestige Corner Badge */}
              <div className="vendor-prestige-corner">
                {vendor.isAdmin && <div className="p-badge admin-badge"><Crown size={18} /></div>}
                {vendor.isFounder && !vendor.isAdmin && <div className="p-badge founder-badge"><Leaf size={18} /></div>}
              </div>
            </div>
            
            {/* Vendor Info Glass Card */}
            <div className="v2-vendor-content glass-card shadow-lg" style={{ flex: 1, padding: '4rem 3rem' }}>
              <h4 className="v2-vendor-meta font-label text-gold" style={{ marginBottom: '1.5rem', letterSpacing: '2px' }}>
                {vendor.name} &mdash; {vendor.products}
              </h4>
              <h2 className="v2-vendor-biz font-headline text-primary" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.1, marginBottom: '1.5rem' }}>
                {vendor.businessName}
              </h2>
              <p className="v2-vendor-bio" style={{ fontSize: '1.15rem', color: 'var(--on-surface-variant)', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '500px' }}>
                {vendor.bio}
              </p>
              
              <div className="vendor-actions">
                {vendor.slug || vendor.id ? (
                  <Link to={vendor.slug ? `/${vendor.slug}` : `/${vendor.id}`} className="btn-solid-gold">
                    Explore Collection
                  </Link>
                ) : (
                  <span className="btn-outline-primary" style={{ opacity: 0.6, cursor: 'not-allowed', pointerEvents: 'none' }}>
                    Profile Coming Soon
                  </span>
                )}
              </div>
            </div>
            
          </div>
        ))}
      </section>
      
    </div>
  );
};

export default Directory;
