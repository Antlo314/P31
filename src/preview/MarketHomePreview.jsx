import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchUpcomingEvents, formatEventDate, parseEventDate, showDate, showMonth, monthLabel, ticketLabel } from '../lib/events';
import { openJoin } from '../lib/join';
import PodcastFeature from '../components/PodcastFeature';
import { ITEMS, DESIGNS, TYPES, fromPrice, money } from '../../supabase/functions/_shared/merch-catalog.js';
import heroVid from '../assets/web/hero.mp4';
import heroPhoneVid from '../assets/web/hero-phone.mp4';
import heroPoster from '../assets/web/hero-poster.webp';
import curatorVid from '../assets/web/curator.mp4';
import curatorPoster from '../assets/web/curator-poster.webp';
import productVid from '../assets/web/product.mp4';
import productPoster from '../assets/web/product-poster.webp';
import jewelry from '../assets/web/vendor_jewelry.webp';
import ceramics from '../assets/web/vendor_ceramics.webp';
import candles from '../assets/web/vendor_candles.webp';
import skincare from '../assets/web/vendor_skincare.webp';
import './market-preview.css';

// PREVIEW ONLY (dev server, /preview/home): a new p31market.com home.
// Hero after MotionSites "Rare Gallery" (full-bleed film, serif headline at the foot, one pill, staggered rise);
// the body after "Luxury Ecommerce" (split panels, a product rail, tall category tiles). All data is live.
const TILES = [
  { img: jewelry, label: 'jewelry', to: '/shop' },
  { img: ceramics, label: 'art & ceramics', to: '/shop?c=Art' },
  { img: skincare, label: 'wellness', to: '/shop?c=Wellness' },
  { img: candles, label: 'home & gifts', to: '/shop' },
];

const useMounted = (delay = 100) => {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), delay); return () => clearTimeout(t); }, [delay]);
  return on;
};

const MarketHomePreview = () => {
  const mounted = useMounted(300);
  const [events, setEvents] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState({});
  const [merchPhotos, setMerchPhotos] = useState({});
  const [rail, setRail] = useState('curators');

  useEffect(() => {
    fetchUpcomingEvents().then(setEvents);
    supabase?.rpc('featured_shops').then(({ data }) => setFeatured(Array.isArray(data) ? data : []));
    supabase?.from('curator_data').select('id, slug, business_name').eq('status', 'approved').eq('is_published', true)
      .then(({ data }) => setShops(Object.fromEntries((data || []).map((s) => [s.id, s]))));
    supabase?.from('products').select('id, curator_id, name, price, image_url, category, is_active').eq('is_active', true).not('image_url', 'is', null).order('created_at', { ascending: false }).limit(16)
      .then(({ data }) => setProducts((data || []).filter((p) => p.image_url)));
    supabase?.from('merch_mockups').select('item, color, url, gallery')
      .then(({ data }) => setMerchPhotos(Object.fromEntries((data || []).map((r) => [r.item, r.gallery?.[0] || r.url]))));
  }, []);

  const shopProducts = products.filter((p) => shops[p.curator_id]);
  const merch = ITEMS.filter((i) => merchPhotos[i.id]).slice(0, 12);
  const showCurators = rail === 'curators' && shopProducts.length > 0;
  const next = events[0];
  const when = (e) => (showDate(e) ? formatEventDate(e.event_date, { month: 'short', day: 'numeric' }) : showMonth(e) ? monthLabel(e) : 'Date soon');

  return (
    <div className="mp">
      {/* ── Hero: Rare Gallery ── */}
      <section className="mp-hero">
        <div className={`mp-hero__media ${mounted ? 'is-on' : ''}`}>
          <video className="mp-hero__film is-wide" src={heroVid} poster={heroPoster} autoPlay muted loop playsInline />
          <video className="mp-hero__film is-phone" src={heroPhoneVid} poster={heroPoster} autoPlay muted loop playsInline />
        </div>
        <div className="mp-hero__copy">
          <h1 className={`mp-rise ${mounted ? 'is-on' : ''}`} style={{ transitionDelay: mounted ? '400ms' : '0ms' }}>
            A carefully curated<br className="mp-sm" /> marketplace for her gifts
          </h1>
          <p className={`mp-rise ${mounted ? 'is-on' : ''}`} style={{ transitionDelay: mounted ? '600ms' : '0ms' }}>
            Handmade goods, seasonal markets, and the women of faith who make them.
          </p>
          <div className={`mp-hero__acts mp-rise ${mounted ? 'is-on' : ''}`} style={{ transitionDelay: mounted ? '800ms' : '0ms' }}>
            <Link to="/shop" className="mp-pill">Shop the marketplace</Link>
            <Link to="/vendors" className="mp-ghost">Become a curator <ArrowRight size={16} /></Link>
          </div>
          {next && (
            <p className={`mp-next mp-rise ${mounted ? 'is-on' : ''}`} style={{ transitionDelay: mounted ? '1000ms' : '0ms' }}>
              Up next · {next.title} · {when(next)}
            </p>
          )}
        </div>
      </section>

      {/* ── Split panels: Luxury Ecommerce ── */}
      <section className="mp-split">
        <Link to="/directory" className="mp-split__panel">
          <video src={curatorVid} poster={curatorPoster} autoPlay muted loop playsInline />
          <div className="mp-split__copy">
            <h2>Made by women<br />who build.</h2>
            <p>Every curator is hand-selected for her craft, her story and her purpose.</p>
            <span className="mp-pill mp-pill--sm">Meet the curators</span>
          </div>
        </Link>
        <Link to="/merch" className="mp-split__panel">
          <video src={productVid} poster={productPoster} autoPlay muted loop playsInline />
          <div className="mp-split__copy">
            <h2>Wear the word.</h2>
            <p>Proverbs 31 pieces, printed for you when you order.</p>
            <span className="mp-pill mp-pill--sm">Shop P31 merch</span>
          </div>
        </Link>
      </section>

      {/* ── Product rail ── */}
      {(shopProducts.length > 0 || merch.length > 0) && (
        <section className="mp-rail">
          <div className="mp-rail__head">
            <h2>
              {shopProducts.length > 0 && <button type="button" className={showCurators ? 'is-on' : ''} onClick={() => setRail('curators')}><span className="mp-dot" />new from our curators</button>}
              {merch.length > 0 && <button type="button" className={!showCurators ? 'is-on' : ''} onClick={() => setRail('merch')}>{!shopProducts.length && <span className="mp-dot" />}p31 merch</button>}
            </h2>
            <Link to={showCurators ? '/shop' : '/merch'} className="mp-link">See all <ArrowRight size={15} /></Link>
          </div>
          <div className="mp-rail__track">
            {showCurators
              ? shopProducts.map((p) => (
                <Link key={p.id} to={`/${shops[p.curator_id]?.slug || p.curator_id}`} className="mp-card">
                  <div className="mp-card__img"><img src={p.image_url} alt="" loading="lazy" decoding="async" /></div>
                  <small>{p.category || shops[p.curator_id]?.business_name}</small>
                  <strong>{p.name}</strong>
                  <span>${Number(p.price).toFixed(2)}</span>
                </Link>
              ))
              : merch.map((i) => (
                <Link key={i.id} to="/merch" className="mp-card">
                  <div className="mp-card__img"><img src={merchPhotos[i.id]} alt="" loading="lazy" decoding="async" /></div>
                  <small>{TYPES[i.type].label}</small>
                  <strong>{DESIGNS[i.design].name}</strong>
                  <span>from {money(fromPrice(i))}</span>
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* ── Tall category tiles ── */}
      <section className="mp-tiles">
        {TILES.map((t) => (
          <Link key={t.label} to={t.to} className="mp-tile">
            <img src={t.img} alt="" loading="lazy" decoding="async" />
            <span className="mp-tile__word">{t.label}</span>
            <span className="mp-pill mp-pill--sm">shop {t.label.split(' ')[0]}</span>
          </Link>
        ))}
      </section>

      {/* ── Featured this month (live) ── */}
      {featured.length > 0 && (
        <section className="mp-featured">
          <div className="mp-rail__head"><h2><span className="mp-dot" />featured this month</h2><Link to="/directory" className="mp-link">All curators <ArrowRight size={15} /></Link></div>
          <div className="mp-featured__grid">
            {featured.map((c) => (
              <Link key={c.id} to={`/${c.slug || c.id}`} className="mp-shop">
                <div className="mp-shop__banner">{c.banner_url && <img src={c.banner_url} alt="" loading="lazy" />}<em>{c.kind === 'ceo' ? 'CEO Selected' : 'Featured'}</em></div>
                <div className="mp-shop__body">
                  {c.logo_url ? <img src={c.logo_url} alt="" /> : <span>{(c.business_name || '?').charAt(0)}</span>}
                  <div><strong>{c.business_name}</strong>{c.tagline && <small>{c.tagline}</small>}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Market dates (live), date tiles ── */}
      {events.length > 0 && (
        <section className="mp-dates">
          <div className="mp-dates__intro">
            <h2>Upcoming</h2>
            <p>Seasonal markets across Metro Atlanta, plus the gatherings that bring our community together.</p>
            <Link to="/calendar" className="mp-pill mp-pill--dark">All dates &amp; RSVP</Link>
          </div>
          <ul className="mp-dates__list">
            {events.slice(0, 4).map((e, i) => {
              const d = parseEventDate(e.event_date);
              return (
                <li key={e.id || e.title} className={i === 0 ? 'is-first' : ''}>
                  <span className="mp-date">{showDate(e) ? <><b>{d.getDate()}</b><small>{d.toLocaleDateString('en-US', { month: 'short' })}</small></> : <><b>{d.toLocaleDateString('en-US', { month: 'short' })}</b><small>soon</small></>}</span>
                  <div>
                    <strong>{e.title}</strong>
                    <small>{[showDate(e) && e.start_time, e.venue || e.location].filter(Boolean).join(' · ') || 'Details coming soon'}</small>
                    {e.address && showDate(e) && <small><MapPin size={12} /> {e.address}</small>}
                  </div>
                  {e.ticket_url && <a href={e.ticket_url} target="_blank" rel="noreferrer" className="mp-link">{ticketLabel(e.ticket_url)} <ArrowUpRight size={14} /></a>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Curator call ── */}
      <section className="mp-cta">
        <h2>Your gifts deserve<br />room to grow.</h2>
        <p>Open a virtual storefront free for three months, sell at our seasonal markets, and build alongside women of faith.</p>
        <div className="mp-hero__acts">
          <Link to="/vendors" className="mp-pill">Become a curator</Link>
          <button type="button" className="mp-ghost" onClick={() => openJoin()}>Join the community <ArrowRight size={16} /></button>
        </div>
      </section>

      <PodcastFeature />
    </div>
  );
};

export default MarketHomePreview;
