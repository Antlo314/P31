import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, CalendarClock, ArrowRight, ArrowUpRight, Lock, Sparkles, Gem, Users, Music4, Check, ArrowDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchUpcomingEvents, formatEventDate, parseEventDate, showDate } from '../lib/events';
import { gsap, reducedMotion } from '../lib/motion';
import { openJoin } from '../lib/join';
import { hrefFor } from '../lib/site';
import LazyVideo from '../components/LazyVideo';
import './Home.css';

// Web-optimised copies of the original footage and photos (same media,
// re-encoded: no audio track, 720px, fast-start). See src/assets/web/.
import heroVid from '../assets/web/hero.mp4';
import heroPoster from '../assets/web/hero-poster.webp';
import faithVid from '../assets/web/faith.mp4';
import faithPoster from '../assets/web/faith-poster.webp';
import missionVid from '../assets/web/p31market2.mp4';
import missionPoster from '../assets/web/p31market2-poster.webp';
import curatorVid from '../assets/web/curator.mp4';
import curatorPoster from '../assets/web/curator-poster.webp';
import productVid from '../assets/web/product.mp4';
import productPoster from '../assets/web/product-poster.webp';
import bentoJewelry from '../assets/web/vendor_jewelry.webp';
import bentoCeramics from '../assets/web/vendor_ceramics.webp';
import bentoCandles from '../assets/web/vendor_candles.webp';
import bentoSkincare from '../assets/web/vendor_skincare.webp';
import bentoCommunity from '../assets/web/p31_community_impact_editorial_1776544076592.webp';
import partnerImg from '../assets/web/p31_partner_hero_editorial.webp';

const APPLY_URL = 'https://forms.gle/vmkK7fhgwiYNYEa38';
const CATEGORIES = ['Art', 'Wellness', 'Clothing', 'Food', 'Literature', 'Community', 'Services'];
const PILLARS = [
  { Icon: Gem, title: 'Artisan crafted', body: 'Elite, hand-selected curators representing the pinnacle of craftsmanship and true beauty.' },
  { Icon: Users, title: 'Strategic networking', body: 'A community of visionary women cultivating powerful, faith-driven connections.' },
  { Icon: Music4, title: 'Exclusive ambiance', body: 'A majestic, high-end atmosphere elevated by curated aesthetics and live music.' },
];
const STATS = [['7', 'Curated categories'], ['4', 'Seasonal markets a year'], ['100%', 'Hand-selected curators'], ['1K+', 'Community members']];

const monthShort = (iso) => parseEventDate(iso).toLocaleDateString('en-US', { month: 'short' });

const Home = () => {
  const [events, setEvents] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [curators, setCurators] = useState([]);
  const [news, setNews] = useState({ name: '', email: '', trap: '' });
  const [newsState, setNewsState] = useState('idle'); // idle | sending | done | error
  const heroRef = useRef(null);
  const nextEvent = events[0];

  useEffect(() => {
    fetchUpcomingEvents().then((rows) => {
      setEvents(rows);
      setEventsLoaded(true);
    });
    // Live curator spotlight — only approved, published storefronts.
    supabase
      ?.from('curator_data')
      .select('id, slug, business_name, tagline, custom_title, logo_url, banner_url, location')
      .eq('status', 'approved')
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .limit(8)
      .then(({ data }) => setCurators(data || []));
  }, []);

  // Hero: the film slowly pushes in and the copy lifts away as you scroll.
  useEffect(() => {
    if (reducedMotion() || !heroRef.current) return undefined;
    const ctx = gsap.context(() => {
      const st = { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.h26-hero__media', { scale: 1.14, yPercent: 6, ease: 'none', scrollTrigger: st });
      gsap.to('.h26-hero__inner', { yPercent: -18, opacity: 0.15, ease: 'none', scrollTrigger: { ...st, start: 'top top', end: '80% top' } });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  const handleNewsletter = async (e) => {
    e.preventDefault();
    setNewsState('sending');
    const { error } = await supabase.rpc('subscribe_lead', {
      p_name: news.name.trim(), p_email: news.email.trim(), p_source: 'home', p_trap: news.trap,
    });
    if (error) return setNewsState('error');
    try { localStorage.setItem('p31_subscribed', '1'); } catch { /* private mode */ }
    setNewsState('done');
  };

  return (
    <div className="h26">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="h26-hero k-dark" ref={heroRef}>
        <LazyVideo src={heroVid} poster={heroPoster} className="h26-hero__media" eager />
        <div className="h26-hero__scrim" />
        <span className="k-hero__arch h26-hero__arch" aria-hidden="true" />

        <div className="h26-hero__inner">
          {nextEvent && (
            <a href="#dates" className="k-chip k-chip--glass h26-hero__next" data-intro="0">
              <span className="h26-pulse" aria-hidden="true" />
              Next market · {nextEvent.title} · {showDate(nextEvent) ? formatEventDate(nextEvent.event_date, { month: 'short', day: 'numeric' }) : 'Coming soon'}
              <ArrowRight size={13} />
            </a>
          )}
          <p className="k-eyebrow" data-intro="0.05">Proverbs 31 Marketplace</p>
          <h1 className="k-display h26-hero__title" data-split="intro" data-delay="0.1">
            Where her gifts <em>make room.</em>
          </h1>
          <p className="k-lede h26-hero__lead" data-intro="0.45">
            A premium curated marketplace for women creatives, artisans and visionaries — online and at our seasonal markets.
          </p>
          <div className="k-actions h26-hero__ctas" data-intro="0.6">
            <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className="k-btn k-btn--gold k-btn--lg">
              Become a curator <ArrowUpRight size={18} />
            </a>
            <button type="button" className="k-btn k-btn--light k-btn--lg" onClick={openJoin}>Join the Inner Circle</button>
          </div>
        </div>

        <a href="#story" className="h26-scroll" aria-label="Scroll to explore" data-intro="1"><ArrowDown size={16} /></a>

        <div className="h26-marquee" aria-hidden="true">
          <div className="h26-marquee__track">
            {[...CATEGORIES, ...CATEGORIES].map((w, i) => <span key={i}>{w}<i>✦</i></span>)}
          </div>
        </div>
      </section>

      {/* ── SCRIPTURE ───────────────────────────────────────── */}
      <section className="h26-scripture k-dark" id="story">
        <LazyVideo src={faithVid} poster={faithPoster} className="h26-scripture__media" />
        <div className="h26-scripture__scrim" />
        <figure className="k-quote k-center h26-scripture__body">
          <p className="k-eyebrow k-eyebrow--center" style={{ margin: 0 }} data-reveal="fade">Proverbs 31:31</p>
          <blockquote data-scrub>“Give her of the fruit of her hands; and let her own works praise her in the gates.”</blockquote>
        </figure>
      </section>

      {/* ── EXPERIENCE + STATS ──────────────────────────────── */}
      <section className="k-section">
        <div className="k-head k-head--row">
          <div style={{ display: 'grid', gap: 16 }}>
            <p className="k-eyebrow" style={{ margin: 0 }} data-reveal="fade">The Experience</p>
            <h2 className="k-h2" data-split>Beyond a <em>marketplace</em></h2>
          </div>
          <p className="k-lede" data-reveal style={{ maxWidth: '42ch' }}>Part gallery, part gathering, part storefront — built for the woman of influence and the people who love what she makes.</p>
        </div>
        <div className="k-grid k-grid--3" data-reveal-group>
          {PILLARS.map((p, i) => (
            <article className={`k-card ${i === 1 ? 'k-card--night' : ''}`} key={p.title}>
              <span className="k-num">0{i + 1}</span>
              <span className="k-icon"><p.Icon size={22} /></span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
        <dl className="k-stats" style={{ marginTop: 'clamp(20px, 3vw, 36px)' }} data-reveal>
          {STATS.map(([n, l]) => <div key={l}><dt data-count>{n}</dt><dd>{l}</dd></div>)}
        </dl>
      </section>

      {/* ── MISSION ─────────────────────────────────────────── */}
      <section className="k-section k-section--night k-dark" id="about">
        <div className="k-split k-split--wide-right">
          <div className="k-arch k-arch--ring h26-mission__media" data-reveal="clip">
            <LazyVideo src={missionVid} poster={missionPoster} label="Melanie Jeffers-Cameron at the P31 Marketplace" />
          </div>
          <div className="k-head" style={{ marginBottom: 0 }}>
            <p className="k-eyebrow" data-reveal="fade">Our mission · The Matriarch</p>
            <h2 className="k-h2" data-split>Melanie <em>Jeffers-Cameron</em></h2>
            <p className="k-lede" data-reveal>
              Proverbs 31 Marketplace is a global marketplace for creativity. We honor the modern woman of
              influence with a premium platform to showcase her gifts — every curator hand-selected,
              rooted in purposeful elegance, where faith and luxury converge.
            </p>
            <ul className="h26-tags" data-reveal-group>
              {CATEGORIES.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <div className="k-actions" data-reveal>
              <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className="k-btn k-btn--gold">Become a curator <ArrowUpRight size={18} /></a>
              <Link to="/about" className="k-btn k-btn--light">Our story</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENTO SHOWCASE ──────────────────────────────────── */}
      <section className="k-section" id="marketplace">
        <div className="k-head k-center">
          <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Inside the collective</p>
          <h2 className="k-h2" data-split>A marketplace, <em>composed</em></h2>
          <p className="k-lede" data-reveal>Seven worlds of craftsmanship under one roof — each curator hand-selected, each piece a testament to gifted hands.</p>
        </div>

        <div className="h26-bento" data-reveal-group="scale">
          <article className="h26-tile h26-tile--media h26-tile--tall">
            <LazyVideo src={curatorVid} poster={curatorPoster} className="h26-fill" />
            <div className="h26-tile__copy">
              <span className="k-chip">Featured</span>
              <h3>Curated by hand</h3>
              <p>Every maker is vetted for craft, story and purpose.</p>
            </div>
          </article>
          <article className="h26-tile h26-tile--media">
            <img src={bentoJewelry} alt="Artisan jewelry" loading="lazy" decoding="async" />
            <div className="h26-tile__copy"><span className="h26-tile__cat">Adornment</span></div>
          </article>
          <article className="h26-tile h26-tile--media">
            <img src={bentoCeramics} alt="Handmade ceramics" loading="lazy" decoding="async" />
            <div className="h26-tile__copy"><span className="h26-tile__cat">Home &amp; craft</span></div>
          </article>
          <article className="h26-tile h26-tile--gold">
            <div className="h26-tile__copy">
              <span className="h26-tile__big" data-count>7</span>
              <span className="h26-tile__cat">Curated categories</span>
            </div>
          </article>
          <article className="h26-tile h26-tile--media">
            <img src={bentoCandles} alt="Botanical candles" loading="lazy" decoding="async" />
            <div className="h26-tile__copy"><span className="h26-tile__cat">Wellness</span></div>
          </article>
          <article className="h26-tile h26-tile--night h26-tile--wide">
            <div className="h26-tile__copy">
              <Sparkles size={22} className="h26-gold" />
              <p className="h26-tile__quote">Where faith, purpose and beauty converge.</p>
            </div>
          </article>
          <article className="h26-tile h26-tile--media">
            <LazyVideo src={productVid} poster={productPoster} className="h26-fill" />
            <div className="h26-tile__copy"><span className="h26-tile__cat">The craft</span></div>
          </article>
          <Link to="/shop" className="h26-tile h26-tile--night h26-tile--link">
            <div className="h26-tile__copy">
              <h3>Shop the collective</h3>
              <p>Every piece, every curator.</p>
              <span className="k-link">Browse <ArrowRight size={16} /></span>
            </div>
          </Link>
          <article className="h26-tile h26-tile--media h26-tile--wide">
            <img src={bentoCommunity} alt="P31 community gathering" loading="lazy" decoding="async" />
            <div className="h26-tile__copy">
              <h3>More than commerce</h3>
              <p>A movement of visionary women, gathering in person and online.</p>
            </div>
          </article>
          <article className="h26-tile h26-tile--media">
            <img src={bentoSkincare} alt="Artisan skincare" loading="lazy" decoding="async" />
            <div className="h26-tile__copy"><span className="h26-tile__cat">Beauty</span></div>
          </article>
        </div>
      </section>

      {/* ── CURATOR SPOTLIGHT (live; hidden until curators are approved) ── */}
      {curators.length > 0 && (
        <section className="k-section k-section--mist">
          <div className="k-head k-head--row">
            <div style={{ display: 'grid', gap: 16 }}>
              <p className="k-eyebrow" style={{ margin: 0 }} data-reveal="fade">Meet the curators</p>
              <h2 className="k-h2" data-split>Shop the <em>collective</em></h2>
            </div>
            <Link to="/directory" className="k-link" data-reveal>View all <ArrowRight size={16} /></Link>
          </div>
          <div className="h26-rail" data-reveal-group>
            {curators.map((c) => (
              <Link to={`/${c.slug || c.id}`} className="h26-curator" key={c.id}>
                <div className="h26-curator__banner">
                  {c.banner_url && <img src={c.banner_url} alt="" loading="lazy" decoding="async" />}
                </div>
                <div className="h26-curator__body">
                  {c.logo_url
                    ? <img className="h26-curator__logo" src={c.logo_url} alt="" loading="lazy" decoding="async" />
                    : <span className="h26-curator__logo h26-curator__logo--blank">{(c.business_name || '?').charAt(0)}</span>}
                  <h3>{c.business_name}</h3>
                  {(c.custom_title || c.tagline) && <p>{c.custom_title || c.tagline}</p>}
                  {c.location && <span className="h26-curator__loc"><MapPin size={12} /> {c.location}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── MARKET DATES ────────────────────────────────────── */}
      <section className="k-section k-section--night k-dark" id="dates">
        <div className="k-head k-head--row">
          <div style={{ display: 'grid', gap: 16 }}>
            <p className="k-eyebrow" style={{ margin: 0 }} data-reveal="fade">Upcoming</p>
            <h2 className="k-h2" data-split>Market <em>dates</em></h2>
          </div>
          <Link to="/calendar" className="k-link" data-reveal>All dates &amp; RSVP <ArrowRight size={16} /></Link>
        </div>

        <div className="h26-dates__grid">
          <div className="h26-dates__list" data-reveal-group>
            {events.map((ev, i) => (
              <article className="h26-date" key={ev.id}>
                <div className="h26-date__cal">
                  {showDate(ev) ? (
                    <>
                      <span className="h26-date__day">{parseEventDate(ev.event_date).getDate()}</span>
                      <span className="h26-date__mon">{monthShort(ev.event_date)} ’{String(parseEventDate(ev.event_date).getFullYear()).slice(2)}</span>
                    </>
                  ) : (
                    <>
                      <CalendarClock size={24} className="h26-date__icon" />
                      <span className="h26-date__mon">Soon</span>
                    </>
                  )}
                </div>
                <div className="h26-date__info">
                  <h3>{ev.title}</h3>
                  <p>{showDate(ev) ? ([ev.start_time, ev.venue].filter(Boolean).join(' · ') || 'Details coming soon') : 'Date coming soon'}</p>
                </div>
                {ev.rsvp_url ? (
                  <a href={ev.rsvp_url} target="_blank" rel="noreferrer" className="k-btn k-btn--sm k-btn--gold">RSVP</a>
                ) : ev.rsvp_enabled !== false ? (
                  <Link to="/calendar" className="k-btn k-btn--sm k-btn--light">RSVP</Link>
                ) : i < 2 ? (
                  <button type="button" onClick={openJoin} className="k-btn k-btn--sm k-btn--light">Notify me</button>
                ) : (
                  <span className="k-chip k-chip--glass">Incoming</span>
                )}
              </article>
            ))}
            {eventsLoaded && events.length === 0 && (
              <article className="h26-date">
                <div className="h26-date__info">
                  <h3>New dates coming soon</h3>
                  <p>Join the collective to hear first.</p>
                </div>
                <button type="button" onClick={openJoin} className="k-btn k-btn--sm k-btn--light">Notify me</button>
              </article>
            )}
          </div>

          <aside className="h26-visit" data-reveal="right">
            <span className="k-icon"><MapPin size={22} /></span>
            <p className="k-eyebrow" style={{ margin: '18px 0 8px' }}>Next market location</p>
            <h3>{nextEvent?.venue || 'Venue to be announced'}</h3>
            {(nextEvent?.address || nextEvent?.location) && <p className="h26-visit__addr">{nextEvent.address || nextEvent.location}</p>}
            <p className="h26-visit__date">
              {showDate(nextEvent) ? formatEventDate(nextEvent.event_date) : 'Date coming soon'}
              {showDate(nextEvent) && nextEvent?.start_time ? ` · ${nextEvent.start_time}` : ''}
            </p>
            {nextEvent?.address && (
              <a className="k-link" href={`https://maps.google.com/?q=${encodeURIComponent(`${nextEvent.venue || ''} ${nextEvent.address}`)}`} target="_blank" rel="noreferrer">
                Directions <ArrowUpRight size={16} />
              </a>
            )}
          </aside>
        </div>
      </section>

      {/* ── PARTNER ─────────────────────────────────────────── */}
      <section className="k-section">
        <div className="k-split k-split--wide-left">
          <div className="k-head" style={{ marginBottom: 0 }}>
            <p className="k-eyebrow" data-reveal="fade">Bespoke offerings</p>
            <h2 className="k-h2" data-split>Elevate your <em>presence</em></h2>
            <p className="k-lede" data-reveal>
              Proverbs 31 Marketplace is more than an event — it is a movement. Partner with us, sponsor a
              market, or work with our team on bespoke brand services.
            </p>
            <div className="k-actions" data-reveal>
              <Link to="/partner" className="k-btn k-btn--plum">Explore partnerships <ArrowRight size={18} /></Link>
              <Link to="/services" className="k-btn k-btn--outline">Services</Link>
            </div>
          </div>
          <div className="k-arch k-arch--ring" data-reveal="clip" style={{ maxWidth: 440, justifySelf: 'center', width: '100%' }}>
            <img src={partnerImg} alt="" loading="lazy" decoding="async" data-parallax="7" style={{ height: '116%', top: '-8%' }} />
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ──────────────────────────────────────── */}
      <section className="k-section k-section--tight" id="newsletter">
        <div className="k-cta k-dark h26-news" data-reveal="scale">
          <p className="k-eyebrow">The Inner Circle</p>
          <h2 className="k-h2">Join the <em>collective</em></h2>
          <p className="k-lede">Exclusive invitations, market dates and highlights from our community of visionary women.</p>
          {newsState === 'done' ? (
            <p className="h26-news__done"><Check size={18} /> You’re on the list — welcome to the collective.</p>
          ) : (
            <form className="h26-news__form" onSubmit={handleNewsletter}>
              <label className="sr-only" htmlFor="h26-name">First name</label>
              <input id="h26-name" className="k-input" required autoComplete="given-name" placeholder="First name"
                value={news.name} onChange={(e) => setNews({ ...news, name: e.target.value })} />
              <label className="sr-only" htmlFor="h26-email">Email address</label>
              <input id="h26-email" className="k-input" required type="email" autoComplete="email" inputMode="email" placeholder="Email address"
                value={news.email} onChange={(e) => setNews({ ...news, email: e.target.value })} />
              <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={news.trap} onChange={(e) => setNews({ ...news, trap: e.target.value })} />
              <button className="k-btn k-btn--gold" disabled={newsState === 'sending'}>
                {newsState === 'sending' ? 'Joining…' : <>Join <ArrowRight size={18} /></>}
              </button>
              {newsState === 'error' && <p className="k-error" role="alert">Something went wrong — please try again.</p>}
            </form>
          )}
        </div>
      </section>

      {/* ── SYSTEMS (team sign-in) ──────────────────────────── */}
      <section className="k-section k-section--tight" id="systems" style={{ paddingTop: 0 }}>
        <div className="h26-systems" data-reveal>
          <span className="k-icon"><Lock size={20} /></span>
          <div>
            <h3>Systems — the P31 operations console</h3>
            <p>Social command, growth search, campaigns, orders and the creative studios. Team sign-in only.</p>
          </div>
          <a href={hrefFor('/systems')} className="k-btn k-btn--outline k-btn--sm">Sign in <ArrowRight size={16} /></a>
        </div>
      </section>
    </div>
  );
};

export default Home;
