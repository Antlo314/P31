import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Crown, Leaf, MapPin, Instagram, Facebook, Globe, Calendar } from 'lucide-react';
import './CuratorProfile.css';

// Mock images fallback
import vendorCandles from '../assets/vendor_candles.png';
import vendorSkincare from '../assets/vendor_skincare.png';
import placeholderProduct from '../assets/generic_p31_product.png';

gsap.registerPlugin(ScrollTrigger);

const CuratorProfile = () => {
  const { id: slug } = useParams();
  const [curator, setCurator] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const fetchCurator = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Try to fetch by slug or by profile ID
        const { data, error: dbError } = await supabase
          .from('curator_data')
          .select(`
            *,
            profiles (*)
          `)
          .or(`slug.eq.${slug},id.eq.${slug}`)
          .single();

        if (dbError) throw dbError;
        setCurator(data);

        // Fetch products for this curator
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('curator_id', data.id)
          .order('created_at', { ascending: false });
        
        if (prodData) setProducts(prodData);
      } catch (err) {
        console.error('Curator fetch error:', err);
        setError('Curator not found');
      } finally {
        setLoading(false);
      }
    };

    fetchCurator();
  }, [slug]);

  useEffect(() => {
    if (!curator || loading) return;

    let ctx = gsap.context(() => {
       gsap.fromTo('.cp-hero-text', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.5, ease: 'power3.out' });
    }, containerRef);

    return () => ctx.revert();
  }, [curator, loading]);

  if (loading) {
    return <div className="curator-profile-page loading">Loading Sanctuary...</div>;
  }

  if (error || !curator) {
    return (
      <div className="curator-profile-page error-state">
        <span className="material-symbols-outlined text-gold" style={{fontSize: '4rem', marginBottom: '1rem'}}>explore_off</span>
        <h2 className="font-headline">Sanctum Not Found</h2>
        <p>The curators of this space are currently establishing their presence.</p>
        <Link to="/directory" className="btn-solid-gold mt-4">Return to Directory</Link>
      </div>
    );
  }

  // If curator hasn't paid, they shouldn't be publicly visible (optional logic)
  if (!curator.is_paid && slug !== curator.id) {
     return <div className="curator-profile-page error-state">This sanctuary is currently awaiting verification.</div>;
  }

  return (
    <div className="curator-profile-page" ref={containerRef}>
      
      {/* Curator Hero Header */}
      <section className="cp-hero-section">
         <div className="cp-hero-bg">
            <img 
              src={curator.profiles?.avatar_url || 'https://images.unsplash.com/photo-1531123897727-8f129e1bfa82?auto=format&fit=crop&w=1200'} 
              alt={curator.business_name} 
              className="cp-hero-img" 
            />
            <div className="cp-hero-gradient"></div>
         </div>
          <div className="cp-hero-text container-fluid">
            <Link to="/directory" className="link-gold-inline" style={{marginBottom: '2rem', display: 'inline-block'}}>&larr; Back to Directory</Link>
            
            <div className="cp-prestige-row">
              {['info@lumenlabsatl.com', 'proverbs31markets@gmail.com'].includes(curator.profiles?.email?.toLowerCase()) ? (
                <div className="cp-prestige-badge admin-badge">
                  <Crown size={16} /> Master Architect
                </div>
              ) : curator.is_early_bird ? (
                <div className="cp-prestige-badge founder-badge">
                  <Leaf size={16} /> Foundation Founder
                </div>
              ) : null}
              {curator.location && <span className="cp-location-pill"><MapPin size={12} /> {curator.location}</span>}
            </div>

            <h4 className="overline-gold">{curator.profiles?.full_name}</h4>
            <h1 className="cp-biz-name">{curator.business_name}</h1>
            <p className="cp-biz-tagline">{curator.tagline}</p>

            <div className="cp-social-strip">
              {curator.instagram && (
                <a href={`https://instagram.com/${curator.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">
                  <Instagram size={20} />
                </a>
              )}
              {curator.facebook && (
                <a href={curator.facebook} target="_blank" rel="noreferrer">
                  <Facebook size={20} />
                </a>
              )}
              {curator.website && (
                <a href={curator.website} target="_blank" rel="noreferrer">
                  <Globe size={20} />
                </a>
              )}
            </div>
          </div>
      </section>

      {/* Curator Business & Bio Details */}
      <section className="cp-bio-section section-padded">
        <div className="container-fluid">
            <h2 className="cp-section-title text-center">The Hands That Build</h2>
            <div className="divider-gold"></div>
            
            <div className="cp-details-grid">
               <div className="cp-bio-column">
                  <p className="cp-bio-text">{curator.bio}</p>
                  
                   <div className="cp-events-card">
                      <h4 className="cp-card-title"><Calendar size={18} /> Established</h4>
                      <p style={{color: 'rgba(255,255,255,0.7)'}}>Vetted P31 Curator since {new Date(curator.created_at).toLocaleDateString()}</p>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-sm opacity-60 italic">"She considers a field and buys it; out of her earnings she plants a vineyard." &mdash; Prov. 31:16</p>
                      </div>
                   </div>
               </div>

               <div className="cp-contact-column">
                  <div className="cp-contact-card">
                     <h4 className="cp-card-title">Direct Concierge</h4>
                     <div className="cp-contact-row">
                        <span className="cp-contact-label">Email</span>
                        <span className="cp-contact-val">{curator.profiles?.email}</span>
                     </div>
                     <div className="cp-contact-row" style={{borderBottom: 'none'}}>
                        <span className="cp-contact-label">Vanity URL</span>
                        <span className="cp-contact-val" style={{color: 'var(--metallic-gold)'}}>p31market.com/{curator.slug || curator.id.slice(0, 8)}</span>
                     </div>
                  </div>
               </div>
            </div>
        </div>
      </section>

      {/* Products Showcase (Mocked or from DB later) */}
      <section className="cp-products-section section-padded">
        <div className="container-fluid">
           <div className="cp-products-header">
              <h3>The Collection</h3>
              <div className="divider-gold"></div>
           </div>

           <div className="cp-products-grid">
             {products.map(p => (
               <div key={p.id} className="cp-product-card">
                 <div className="cp-product-img-wrapper">
                    <img src={p.image_url || 'https://via.placeholder.com/400x500?text=Artifact'} alt={p.name} className="cp-product-img" />
                    <div className="cp-product-hover">
                       <span>Inquiry Only</span>
                    </div>
                 </div>
                 <div className="cp-product-info">
                    <h4>{p.name}</h4>
                    <p className="cp-product-price">${p.price}</p>
                 </div>
               </div>
             ))}
             {products.length === 0 && (
               <div className="text-center" style={{gridColumn: '1 / -1', padding: '4rem 0'}}>
                  <p style={{color: 'rgba(255,255,255,0.5)', fontStyle: 'italic'}}>Product catalog integration in progress.</p>
               </div>
             )}
           </div>
        </div>
      </section>

    </div>
  );
};

export default CuratorProfile;
