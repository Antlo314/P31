import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, Leaf, Crown, MapPin, ArrowUpRight, Store, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import './Directory.css';

import defaultLogo from '../assets/web/p31_botanical_logo-256.webp';

const APPLY_URL = 'https://forms.gle/vmkK7fhgwiYNYEa38';

const Directory = () => {
  const [vendors, setVendors] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Real approved curators only — no mock/sample data.
    supabase
      .from('curator_data')
      .select('id, slug, business_name, tagline, bio, location, logo_url, banner_url, is_featured, is_early_bird, profiles(full_name, avatar_url)')
      .eq('status', 'approved')
      .order('is_featured', { ascending: false })
      .order('is_early_bird', { ascending: false })
      .then(({ data }) => {
        setVendors((data || []).filter((d) => d.business_name).map((d) => ({
          id: d.id,
          to: `/${d.slug || d.id}`,
          owner: d.profiles?.full_name,
          name: d.business_name,
          tagline: d.tagline,
          bio: d.bio,
          location: d.location,
          logo: d.logo_url || d.profiles?.avatar_url || defaultLogo,
          banner: d.banner_url,
          featured: d.is_featured,
          founder: d.is_early_bird,
          admin: false,
        })));
        setLoaded(true);
      });
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => [v.name, v.tagline, v.bio, v.owner, v.location].some((f) => f?.toLowerCase().includes(q)));
  }, [vendors, query]);

  return (
    <div className="dir">
      <PageHeader
        eyebrow="The Collective"
        title="Curators"
        accent="& shops"
        lead="Hand-selected women makers — from organic botanicals to fine jewelry. Find a shop you love."
      >
        <label className="k-search">
          <Search size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shops, makers, cities"
            aria-label="Search curators"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
        </label>
      </PageHeader>

      <section className="dir__body">
        {loaded && (
          <p className="dir__count">
            {shown.length} {shown.length === 1 ? 'shop' : 'shops'}{query ? ` matching “${query}”` : ''}
          </p>
        )}

        <div className="dir__grid" data-reveal-group>
          {shown.map((v) => (
            <Link to={v.to} className={`dir-card ${v.featured ? 'is-featured' : ''}`} key={v.id}>
              <div className="dir-card__banner">
                {v.banner && <img src={v.banner} alt="" loading="lazy" decoding="async" />}
                <div className="dir-card__badges">
                  {v.featured && <span><Sparkles size={12} /> Featured</span>}
                  {v.founder && <span><Leaf size={12} /> Founder</span>}
                  {v.admin && <span><Crown size={12} /> P31</span>}
                </div>
              </div>
              <div className="dir-card__body">
                <img className="dir-card__logo" src={v.logo} alt="" loading="lazy" decoding="async" />
                <h2>{v.name}</h2>
                {v.tagline && <p className="dir-card__tag">{v.tagline}</p>}
                {v.bio && <p className="dir-card__bio">{v.bio}</p>}
                <div className="dir-card__foot">
                  {v.location ? <span><MapPin size={13} /> {v.location}</span> : <span>{v.owner}</span>}
                  <span className="dir-card__go">Visit shop <ArrowUpRight size={14} /></span>
                </div>
              </div>
            </Link>
          ))}

          {!loaded && Array.from({ length: 3 }, (_, i) => <div className="dir-card k-skel" style={{ minHeight: 340 }} key={i} aria-hidden="true" />)}
        </div>

        {loaded && shown.length === 0 && (
          <div className="k-empty" data-reveal>
            <span className="k-icon"><Store size={26} /></span>
            <h2>{query ? 'No shops match that search' : <>The first shops are <em style={{ fontStyle: 'italic' }}>opening soon</em></>}</h2>
            <p>{query ? 'Try a different word, or clear the search.' : 'Approved curators appear here as they open their storefronts.'}</p>
            {query
              ? <button className="k-btn k-btn--ghost" onClick={() => setQuery('')}>Clear search</button>
              : <a className="k-btn k-btn--gold" href={APPLY_URL} target="_blank" rel="noopener noreferrer">Become a curator <ArrowUpRight size={16} /></a>}
          </div>
        )}
      </section>
    </div>
  );
};

export default Directory;
