import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../context/AuthContext';
import { Crown, Leaf, MapPin, Instagram, Facebook, Globe, Calendar, ArrowRight, ShoppingBag, CreditCard, DollarSign, Send, ShieldAlert, X } from 'lucide-react';
import './CuratorProfile.css';
import './CuratorProfileMiniShop.css';

// Mock images fallback
import serumImg from '../assets/curators/ilcollection/serum_official.png';
import oilImg from '../assets/curators/ilcollection/oil_official.png';
import eyeCreamImg from '../assets/curators/ilcollection/eye_cream_official.png';
import cleanserImg from '../assets/curators/ilcollection/cleanser_official.png';
import collectionSetImg from '../assets/curators/ilcollection/luxe_box_official.png';
import heroUltra from '../assets/curators/ilcollection/hero_ultra.png';
import portraitUltra from '../assets/curators/ilcollection/portrait_ultra.png';
import bathroomAccent from '../assets/curators/ilcollection/bathroom_accent.png';

gsap.registerPlugin(ScrollTrigger);

const IL_COLLECTION_PRODUCTS = [
  {
    id: 'il-serum',
    name: 'Illumine™ Brightening & Anti-aging Serum',
    category: 'Skin',
    price: 59.98,
    description: 'A powerful anti-aging and brightening serum rooted in pure botanical power.',
    image_url: serumImg,
    external_url: 'https://www.nebaministry.org/product-page/illumine-brightening-anti-aging-serum'
  },
  {
    id: 'il-woke-oil',
    name: 'Woke™ Luxury Oil',
    category: 'Skin',
    price: 27.98,
    description: 'A premium hydrating oil that radiates beauty and purpose.',
    image_url: oilImg,
    external_url: 'https://www.nebaministry.org/product-page/awaken-glow-oil'
  },
  {
    id: 'il-restore-eye',
    name: 'Restore™ Eye Cream',
    category: 'Skin',
    price: 34.98,
    description: 'Bespoke eye restoration to illuminate and refresh.',
    image_url: eyeCreamImg,
    external_url: 'https://www.nebaministry.org/product-page/restore-eye-cream'
  },
  {
    id: 'il-brightstar',
    name: 'Brightstar™ Manuka Honey Cleanser',
    category: 'Skin',
    price: 27.98,
    description: 'A gentle, honey-based cleanser for deep purity.',
    image_url: cleanserImg,
    external_url: 'https://www.nebaministry.org/product-page/brightstar-manuka-honey-cleanser'
  },
  {
    id: 'il-luxe-box',
    name: 'Incandescent Luxe Box™',
    category: 'Wellness',
    price: 174.98,
    description: 'The ultimate botanical collection set for the complete artisan experience.',
    image_url: collectionSetImg,
    external_url: 'https://www.nebaministry.org/product-page/the-il-collection'
  }
];

const MELANIE_CURATOR_DATA = {
  id: '545b1f22-6780-49a8-a3c6-408812815fb0',
  business_name: 'Incandescent Lily Collection',
  tagline: 'Wellness and body care rooted in purity and intentional design.',
  bio: 'Transforming the beauty industry by creating wellness and body care rooted in purity and purpose. Built for the Proverbs 31 woman.',
  instagram: 'ilcollection__',
  website: 'https://www.nebaministry.org/ilcollection',
  slug: 'ilcollection',
  location: 'Atlanta, GA',
  is_early_bird: true,
  is_paid: true,
  profiles: {
    full_name: 'Melanie JC',
    email: 'proverbs31markets@gmail.com',
    avatar_url: portraitUltra
  },
  created_at: '2026-04-19'
};

const CuratorProfile = () => {
  const { user } = useAuth();
  const { id: slug } = useParams();
  const [curator, setCurator] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  const logEvent = async (type, productId = null) => {
    if (!curator) return;
    try {
      await supabase.from('curator_analytics').insert([{
        curator_id: curator.id,
        product_id: productId,
        event_type: type
      }]);
    } catch (err) {
      console.warn('Analytics log failed:', err.message);
    }
  };

  useEffect(() => {
    const fetchCurator = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // High-priority vanity bypass for Matriarch Storefront
        if (slug === 'ilcollection') {
          setCurator(MELANIE_CURATOR_DATA);
          setProducts(IL_COLLECTION_PRODUCTS);
          setLoading(false);
          return;
        }

        // Try to fetch others by slug or by profile ID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        
        let query = supabase
          .from('curator_data')
          .select('*, profiles (*)');

        if (isUuid) {
          query = query.or(`slug.eq.${slug},id.eq.${slug}`);
        } else {
          query = query.eq('slug', slug);
        }

        const { data, error: dbError } = await query.single();

        if (dbError) {
          if (slug === 'ilcollection' || slug === MELANIE_CURATOR_DATA.id) {
             setCurator(MELANIE_CURATOR_DATA);
             setProducts(IL_COLLECTION_PRODUCTS);
             setLoading(false);
             return;
          }
          throw dbError;
        }

        setCurator(data);

        // Fetch products for this curator
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .eq('curator_id', data.id)
          .order('created_at', { ascending: false });
        
        if (prodData && prodData.length > 0) {
          setProducts(prodData);
        } else if (slug === MELANIE_CURATOR_DATA.id || slug === 'ilcollection' || data.business_name?.includes('Incandescent Lily')) {
          setProducts(IL_COLLECTION_PRODUCTS);
        }
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

  // If curator hasn't been approved, they shouldn't be publicly visible (except to themselves)
  if (curator.status !== 'approved' && user?.id !== curator.id) {
     return (
       <div className="curator-profile-page error-state">
         <ShieldAlert size={48} className="text-gold mb-4" />
         <h2 className="font-headline">Sanctuary Under Review</h2>
         <p>This boutique is currently being vetted by the Master Architects for the June Marketplace.</p>
         <Link to="/directory" className="btn-solid-gold mt-6">Return to Directory</Link>
       </div>
     );
  }

  const productsByCategory = products.reduce((acc, p) => {
    const cat = p.category || 'Collection';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  const isILShop = slug === 'ilcollection' || (curator?.business_name && curator.business_name.includes('Incandescent Lily'));

  return (
    <div className={`curator-profile-page theme-${curator.theme_preference || 'classic'}`} ref={containerRef}>
      
      {/* Luxury Parallax Hero */}
      <section className="cp-hero-section">
        <div className="cp-hero-banner-wrap">
          <img 
            src={curator.banner_url || heroUltra} 
            alt="Sanctuary Banner" 
            className="cp-hero-banner"
          />
          <div className="cp-hero-overlay"></div>
        </div>
        
        <div className="cp-hero-content container-fluid">
          <div className="cp-logo-frame">
            <img src={curator.logo_url || portraitUltra} alt="Brand Logo" className="cp-brand-logo" />
            {curator.is_featured && (
              <div className="cp-featured-ring">
                <Sparkles size={24} className="text-gold" />
              </div>
            )}
          </div>
          
          <div className="cp-curator-info mt-8">
            <Link to="/directory" className="link-gold-inline" style={{marginBottom: '1rem', display: 'inline-block'}}>&larr; Back to Directory</Link>
            <h1 className="cp-business-name font-headline">{curator.business_name}</h1>
            
            {/* Verification Badges */}
            {curator.verification_badges && curator.verification_badges.length > 0 && (
              <div className="cp-badges-row">
                {curator.verification_badges.map(badge => (
                  <span key={badge} className="cp-badge-pill">
                    <ShieldAlert size={12} /> {badge}
                  </span>
                ))}
              </div>
            )}

            <p className="cp-tagline text-gold font-label">{curator.tagline}</p>
            
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
        </div>
      </section>

      {/* Mini-Shop Accent Banner & Spotlight (New Template Logic) */}
      {isILShop && (
        <>
          <section className="cp-accent-banner">
            <img src={bathroomAccent} alt="Luxury Sanctuary" />
            <div className="cp-accent-overlay"></div>
          </section>

          <section className="cp-spotlight-section">
            <div className="cp-spotlight-card">
              <img src={IL_COLLECTION_PRODUCTS[0].image_url} alt={IL_COLLECTION_PRODUCTS[0].name} className="cp-spotlight-img" />
              <div className="cp-spotlight-info">
                <span className="overline-gold">Matriarch Spotlight</span>
                <h2>{IL_COLLECTION_PRODUCTS[0].name}</h2>
                <p>{IL_COLLECTION_PRODUCTS[0].description}</p>
                <a href={IL_COLLECTION_PRODUCTS[0].external_url} target="_blank" rel="noreferrer" className="btn-solid-gold">
                  Explore The Serum <ArrowRight size={18} />
                </a>
              </div>
            </div>
          </section>
        </>
      )}

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

                  {(curator.stripe_link || curator.cashapp_tag || curator.venmo_handle || curator.other_payment_link) && (
                    <div className="cp-contact-card mt-6">
                      <h4 className="cp-card-title">Secure Payments</h4>
                      <div className="cp-payment-buttons mt-4">
                        {curator.stripe_link && (
                          <a href={curator.stripe_link} target="_blank" rel="noreferrer" className="cp-payment-btn stripe" onClick={() => logEvent('payment_click')}>
                            <CreditCard size={18} /> Pay with Card
                          </a>
                        )}
                        {curator.cashapp_tag && (
                          <a href={`https://cash.app/$${curator.cashapp_tag.replace('$', '')}`} target="_blank" rel="noreferrer" className="cp-payment-btn cashapp" onClick={() => logEvent('payment_click')}>
                            <DollarSign size={18} /> CashApp ${curator.cashapp_tag.replace('$', '')}
                          </a>
                        )}
                        {curator.venmo_handle && (
                          <a href={`https://venmo.com/${curator.venmo_handle.replace('@', '')}`} target="_blank" rel="noreferrer" className="cp-payment-btn venmo" onClick={() => logEvent('payment_click')}>
                            <Send size={18} /> Venmo @{curator.venmo_handle.replace('@', '')}
                          </a>
                        )}
                        {curator.other_payment_link && (
                          <a href={curator.other_payment_link.startsWith('http') ? curator.other_payment_link : `mailto:${curator.other_payment_link}`} target="_blank" rel="noreferrer" className="cp-payment-btn other" onClick={() => logEvent('payment_click')}>
                            <ShoppingBag size={18} /> {curator.other_payment_label || 'Direct Payment'}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
            </div>
        </div>
      </section>

      {/* Categorized Products Showcase */}
      <section className="cp-products-section section-padded">
        <div className="container-fluid">
           
           {Object.keys(productsByCategory).map(category => (
             <div key={category} className="cp-category-group">
                <h2 className="cp-category-title">{category}</h2>
                <div className="cp-products-grid">
                  {productsByCategory[category].map(p => (
                    <div 
                      key={p.id} 
                      className="cp-product-card" 
                      onClick={() => {
                        logEvent('product_click', p.id);
                        if (p.external_url) window.open(p.external_url, '_blank');
                      }}
                    >
                      <div className="cp-product-img-wrapper">
                         <img src={p.image_url || 'https://via.placeholder.com/400x500?text=Artifact'} alt={p.name} className="cp-product-img" />
                         {p.stock_status && p.stock_status !== 'in_stock' && (
                           <span className={`stock-badge ${p.stock_status}`}>
                             {p.stock_status === 'out_of_stock' ? 'Sold Out' : 
                              p.stock_status === 'limited_edition' ? 'Limited' : 
                              p.stock_status === 'pre_order' ? 'Pre-Order' : ''}
                           </span>
                         )}
                         <div className="cp-product-hover">
                            <span>{p.external_url ? 'Buy Now' : 'Inquiry Only'}</span>
                         </div>
                      </div>
                      <div className="cp-product-info">
                         <h4>{p.name}</h4>
                         <p className="cp-product-price">${p.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
           ))}

           {products.length === 0 && (
             <div className="text-center" style={{padding: '4rem 0'}}>
                <p style={{color: 'rgba(255,255,255,0.5)', fontStyle: 'italic'}}>Product catalog integration in progress.</p>
             </div>
           )}
        </div>
      </section>

    </div>
  );
};

export default CuratorProfile;
