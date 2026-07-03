import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Sparkles, Leaf, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Directory.css';

import defaultAvatar from '../assets/p31_botanical_logo.png';

gsap.registerPlugin(ScrollTrigger);

const Directory = () => {
  const containerRef = useRef(null);
  const [activeVendors, setActiveVendors] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Real approved curators only — no mock/sample data.
    const loadCurators = async () => {
      const { data } = await supabase
        .from('curator_data')
        .select('*, profiles(full_name, avatar_url, email)')
        .eq('status', 'approved')
        .order('is_featured', { ascending: false })
        .order('is_early_bird', { ascending: false });

      const realVendors = (data || [])
        .filter(d => d.business_name)
        .map(d => ({
          id: d.id,
          name: d.profiles?.full_name || 'Artisan',
          businessName: d.business_name,
          bio: d.bio,
          products: d.tagline || 'P31 Collective',
          image: d.profiles?.avatar_url || d.logo_url || defaultAvatar,
          slug: d.slug,
          isFounder: d.is_early_bird,
          isFeatured: d.is_featured,
          isAdmin: ['info@lumenlabsatl.com', 'proverbs31markets@gmail.com'].includes(d.profiles?.email?.toLowerCase())
        }));

      setActiveVendors(realVendors);
      setLoaded(true);
    };
    loadCurators();
  }, []);
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
          <div key={vendor.id} className={`v2-vendor-item ${index % 2 !== 0 ? 'vendor-reverse' : ''} ${vendor.isFeatured ? 'featured-sanctuary' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6vw', marginBottom: '12vh' }}>
            
            {/* Vendor Image Wrap with Glass Border */}
            <div className="v2-vendor-img-wrap glass-border" style={{ flex: 1, position: 'relative', aspectRatio: '4/5', overflow: 'hidden' }}>
              <img src={vendor.image} alt={vendor.businessName} className="v2-vendor-img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              
              {/* Prestige Corner Badge */}
              <div className="vendor-prestige-corner">
                {vendor.isAdmin && <div className="p-badge admin-badge"><Crown size={18} /></div>}
                {vendor.isFeatured && <div className="p-badge featured-badge"><Sparkles size={18} /></div>}
                {vendor.isFounder && !vendor.isAdmin && !vendor.isFeatured && <div className="p-badge founder-badge"><Leaf size={18} /></div>}
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
                {/* Only link to a storefront that actually exists: real curators have a slug
                    or a UUID id. Hardcoded sample boutiques use numeric ids and have no store. */}
                {vendor.slug || (typeof vendor.id === 'string' && vendor.id.includes('-')) ? (
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

        {loaded && activeVendors.length === 0 && (
          <div className="text-center" style={{ padding: '8vh 0' }}>
            <h3 className="font-headline" style={{ color: 'var(--primary)', fontSize: '2rem', marginBottom: '0.75rem' }}>No Curators Yet</h3>
            <p style={{ color: 'var(--on-surface-variant)' }}>Approved curators will appear here as they join the collective.</p>
          </div>
        )}
      </section>

    </div>
  );
};

export default Directory;
