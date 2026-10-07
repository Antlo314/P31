import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Share2, ShoppingBag, Sparkles, Leaf, BadgeCheck, Instagram, Facebook, Globe, Mail, Phone, MapPin,
  CreditCard, DollarSign, Send, Check, X, ShieldAlert, Star, Images, Store, Loader2, Minus, Plus, Heart,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { applyMeta, curatorMeta } from '../lib/seo';
import { invokePayment, CARD_PAYMENTS_ENABLED } from '../lib/payments';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useFavorites } from '../lib/favorites';
import { resolveDesign, designAttrs } from '../features/store-design/templates';
import './CuratorProfile.css';
import '../features/store-design/store.css';

import defaultLogo from '../assets/web/p31_botanical_logo-256.webp';

const P31_EMAIL = 'proverbs31markets@gmail.com';
const money = (n) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;

const stockLabel = (p) => {
  if (p.inventory === 0 || p.stock_status === 'out_of_stock') return 'Sold out';
  if (p.stock_status === 'limited_edition') return 'Limited';
  if (p.stock_status === 'pre_order') return 'Pre-order';
  return null;
};

const CuratorProfile = () => {
  const { user } = useAuth();
  const { id: slug } = useParams();
  const [curator, setCurator] = useState(null);
  const [products, setProducts] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('All');
  const [open, setOpen] = useState(null); // product shown in the sheet
  const [sel, setSel] = useState({});     // chosen options in the sheet
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [optError, setOptError] = useState('');
  const cart = useCart();
  const fav = useFavorites();
  const [checkoutLoadingId, setCheckoutLoadingId] = useState(null);
  const [shared, setShared] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const purchaseStatus = searchParams.get('purchase'); // 'success' | 'cancelled' | null

  const dismissPurchaseBanner = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('purchase');
    next.delete('session_id');
    setSearchParams(next, { replace: true });
  };

  // Native checkout when the vendor finished Stripe onboarding and the item
  // is a real catalog product with a valid price.
  const canCheckout = (p) =>
    CARD_PAYMENTS_ENABLED &&
    !!curator?.stripe_charges_enabled &&
    typeof p.id === 'number' &&
    parseFloat(p.price) >= 0.5 &&
    p.stock_status !== 'out_of_stock' &&
    p.inventory !== 0;

  const logEvent = async (type, productId = null) => {
    if (!curator) return;
    try {
      await supabase.from('curator_analytics').insert([{ curator_id: curator.id, product_id: productId, event_type: type }]);
    } catch (err) {
      console.warn('Analytics log failed:', err.message);
    }
  };

  const startCheckout = async (p, quantity = 1, options = {}) => {
    if (checkoutLoadingId) return;
    setCheckoutLoadingId(p.id);
    try {
      const { url } = await invokePayment('stripe-checkout', { items: [{ productId: p.id, quantity, options }] });
      window.location.href = url;
    } catch (err) {
      alert('Checkout could not be started: ' + err.message);
      setCheckoutLoadingId(null);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!supabase) { setLoading(false); return; }
      setLoading(true);
      try {
        // Resolve by vanity slug or by UUID.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        let query = supabase.from('curator_data').select('*');
        query = isUuid ? query.or(`slug.eq.${slug},id.eq.${slug}`) : query.eq('slug', slug);
        const { data, error: dbError } = await query.single();
        if (dbError) throw dbError;
        setCurator(data);
        if (data.status === 'approved') applyMeta(curatorMeta(data));

        const { data: prodData } = await supabase
          .from('products').select('*').eq('curator_id', data.id).order('created_at', { ascending: false });
        // Hidden items stay in the dashboard only; the curator's own order wins.
        setProducts((prodData || [])
          .filter((p) => p.is_active !== false)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));

        const { data: testData } = await supabase
          .from('testimonials').select('*').eq('curator_id', data.id).eq('is_approved', true);
        setTestimonials(testData || []);
      } catch (err) {
        console.error('Curator fetch error:', err);
        setError('Curator not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  // Lock the page while the product sheet is open; Escape closes it.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  // Deep link from the marketplace: /shop-slug?p=123 opens that product.
  const deepProduct = searchParams.get('p');
  useEffect(() => {
    if (!deepProduct || !products.length) return;
    const p = products.find((x) => String(x.id) === deepProduct);
    if (p) Promise.resolve().then(() => { setOpen(p); setSel({}); setQty(1); setAdded(false); });
  }, [deepProduct, products]);

  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category || 'Collection'))], [products]);
  const shown = category === 'All' ? products : products.filter((p) => (p.category || 'Collection') === category);

  if (loading) {
    return (
      <div className="sf sf--loading" aria-busy="true">
        <div className="sf-skel sf-skel--hero" />
        <div className="sf-skel-grid">{[0, 1, 2, 3].map((i) => <div className="sf-skel" key={i} />)}</div>
      </div>
    );
  }

  if (error || !curator) {
    return (
      <div className="sf-state">
        <span><Store size={28} /></span>
        <h1>Shop not found</h1>
        <p>This storefront doesn’t exist yet — or the link has changed.</p>
        <Link to="/directory" className="sf-btn sf-btn--accent">Browse all shops</Link>
      </div>
    );
  }

  // Unapproved shops are private (except to their owner).
  // Dev-only (?devPreview, compiled out of production): view any storefront locally.
  const devPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('devPreview');
  if (curator.status !== 'approved' && user?.id !== curator.id && !devPreview) {
    return (
      <div className="sf-state">
        <span><ShieldAlert size={28} /></span>
        <h1>Opening soon</h1>
        <p>This boutique is being reviewed by the P31 team and will open shortly.</p>
        <Link to="/directory" className="sf-btn sf-btn--accent">Browse all shops</Link>
      </div>
    );
  }

  const design = resolveDesign(curator.store_design);
  const store = designAttrs(design);
  const contactEmail = curator.public_email || P31_EMAIL;
  const hasPayments = curator.stripe_charges_enabled || curator.stripe_link || curator.cashapp_tag || curator.venmo_handle || curator.other_payment_link;

  const share = async () => {
    const url = window.location.href.split('?')[0];
    try {
      if (navigator.share) await navigator.share({ title: curator.business_name, text: curator.tagline || '', url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 1800); }
    } catch { /* closed */ }
  };

  const groupsOf = (p) => (Array.isArray(p.variants) ? p.variants.filter((g) => g?.name && g.options?.length) : []);
  const missingOption = (p) => groupsOf(p).find((g) => !sel[g.name]);
  const soldOut = (p) => stockLabel(p) === 'Sold out';
  const maxQty = (p) => Math.min(p.inventory ?? 20, 20);

  // Add to the site-wide bag (works for every shop — card or order request).
  const addToBag = (p) => {
    const miss = missingOption(p);
    if (miss) return setOptError(`Choose a ${miss.name.toLowerCase()}.`);
    cart.add(p, curator, qty, sel);
    logEvent('add_to_bag', p.id);
    setAdded(true);
  };

  // Straight to checkout (card shops), external link, or bag + request.
  const buyNow = (p) => {
    const miss = missingOption(p);
    if (miss) return setOptError(`Choose a ${miss.name.toLowerCase()}.`);
    logEvent('product_click', p.id);
    if (canCheckout(p)) return startCheckout(p, qty, sel);
    if (p.external_url) return window.open(p.external_url, '_blank', 'noopener');
    cart.add(p, curator, qty, sel);
    setOpen(null);
    cart.openCart();
  };

  const openProduct = (p) => { setOpen(p); setSel({}); setQty(1); setAdded(false); setOptError(''); logEvent('product_view', p.id); };

  const productsSection = (
    <section className="sf-products" id="products">
      {categories.length > 2 && (
        <div className="sf-cats" role="tablist" aria-label="Categories">
          {categories.map((c) => (
            <button key={c} role="tab" aria-selected={category === c} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      )}

      <div className="sf-grid" data-reveal-group>
        {shown.map((p) => {
          const tag = stockLabel(p);
          const onSale = Number(p.compare_at_price) > Number(p.price);
          return (
            <button className="sf-card" key={p.id} onClick={() => openProduct(p)}>
              <div className="sf-card__img">
                {p.image_url ? <img src={p.image_url} alt="" loading="lazy" decoding="async" /> : <ShoppingBag size={28} />}
                <div className="sf-card__tags">
                  {tag && <span className={tag === 'Sold out' ? 'is-dark' : ''}>{tag}</span>}
                  {onSale && !tag && <span className="is-accent">Sale</span>}
                </div>
                {p.image_urls?.length > 1 && <span className="sf-card__count"><Images size={12} /> {p.image_urls.length}</span>}
              </div>
              <div className="sf-card__info">
                <h3>{p.name}</h3>
                <p className="sf-price">
                  <strong>{money(p.price)}</strong>
                  {onSale && <s>{money(p.compare_at_price)}</s>}
                </p>
                {p.inventory > 0 && p.inventory <= 5 && <p className="sf-low">Only {p.inventory} left</p>}
              </div>
            </button>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="sf-empty">
          <ShoppingBag size={26} />
          <p>New pieces are on their way — check back soon.</p>
        </div>
      )}
    </section>
  );

  return (
    <div className={`sf ${store.className}`} style={store.style}>
      {purchaseStatus && (
        <div className={`sf-toast ${purchaseStatus === 'success' ? 'is-ok' : ''}`} role="status">
          {purchaseStatus === 'success' ? <Check size={18} /> : <ShieldAlert size={18} />}
          <span>
            {purchaseStatus === 'success'
              ? `Payment received — thank you for supporting ${curator.business_name}! Your receipt is on its way.`
              : 'Checkout was cancelled — your card was not charged.'}
          </span>
          <button onClick={dismissPurchaseBanner} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className={`sf-hero ${curator.banner_url ? 'has-banner' : ''}`}>
        {curator.banner_url && <img className="sf-hero__bg" src={curator.banner_url} alt="" />}
        <div className="sf-hero__inner">
          <div className="sf-hero__top">
            <Link to="/directory" className="sf-chip"><ArrowLeft size={15} /> All shops</Link>
            <button className="sf-chip" onClick={share}>{shared ? <><Check size={15} /> Link copied</> : <><Share2 size={15} /> Share</>}</button>
          </div>

          <img className="sf-logo" data-intro="0" src={curator.logo_url || defaultLogo} alt={`${curator.business_name} logo`} />
          <h1 data-intro="0.1">{curator.business_name}</h1>
          {curator.tagline && <p className="sf-tagline" data-intro="0.2">{curator.tagline}</p>}

          <div className="sf-badges">
            {curator.is_featured && <span><Sparkles size={13} /> Featured</span>}
            {curator.is_early_bird && <span><Leaf size={13} /> Founding Artisan</span>}
            {curator.custom_title && <span>{curator.custom_title}</span>}
            {(curator.verification_badges || []).map((b) => <span key={b}><BadgeCheck size={13} /> {b}</span>)}
            {curator.location && <span><MapPin size={13} /> {curator.location}</span>}
          </div>

          <div className="sf-hero__actions" data-intro="0.3">
            <a href="#products" className="sf-btn sf-btn--accent"><ShoppingBag size={18} /> Shop {products.length ? `${products.length} item${products.length === 1 ? '' : 's'}` : 'now'}</a>
            <div className="sf-social">
              {curator.instagram && <a href={`https://instagram.com/${curator.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>}
              {curator.facebook && <a href={curator.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>}
              {curator.website && <a href={curator.website} target="_blank" rel="noreferrer" aria-label="Website"><Globe size={18} /></a>}
            </div>
          </div>
        </div>
      </header>

      {curator.shop_announcement && <p className="sf-announce"><Sparkles size={15} /> {curator.shop_announcement}</p>}

      {design.productsFirst && productsSection}

      {design.showAbout && (curator.bio || hasPayments) && (
        <section className="sf-about" data-reveal>
          {curator.bio && (
            <article className="sf-panel">
              <p className="sf-eyebrow">The hands that build</p>
              <h2>About {curator.business_name}</h2>
              <p className="sf-bio">{curator.bio}</p>
              <p className="sf-since">P31 curator since {new Date(curator.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </article>
          )}
          {hasPayments && (
            <article className="sf-panel">
              <p className="sf-eyebrow">How to pay</p>
              <div className="sf-pay">
                {curator.stripe_charges_enabled && <div className="sf-pay__item is-native"><CreditCard size={18} /> Cards accepted — tap any item to buy</div>}
                {curator.stripe_link && <a className="sf-pay__item" href={curator.stripe_link} target="_blank" rel="noreferrer" onClick={() => logEvent('payment_click')}><CreditCard size={18} /> Pay with card</a>}
                {curator.cashapp_tag && <a className="sf-pay__item" href={`https://cash.app/$${curator.cashapp_tag.replace('$', '')}`} target="_blank" rel="noreferrer" onClick={() => logEvent('payment_click')}><DollarSign size={18} /> Cash App ${curator.cashapp_tag.replace('$', '')}</a>}
                {curator.venmo_handle && <a className="sf-pay__item" href={`https://venmo.com/${curator.venmo_handle.replace('@', '')}`} target="_blank" rel="noreferrer" onClick={() => logEvent('payment_click')}><Send size={18} /> Venmo @{curator.venmo_handle.replace('@', '')}</a>}
                {curator.other_payment_link && <a className="sf-pay__item" href={curator.other_payment_link.startsWith('http') ? curator.other_payment_link : `mailto:${curator.other_payment_link}`} target="_blank" rel="noreferrer" onClick={() => logEvent('payment_click')}><ShoppingBag size={18} /> {curator.other_payment_label || 'Direct payment'}</a>}
              </div>
            </article>
          )}
        </section>
      )}

      {!design.productsFirst && productsSection}

      {design.showTestimonials && testimonials.length > 0 && (
        <section className="sf-reviews" data-reveal>
          <p className="sf-eyebrow">Collector’s praise</p>
          <div className="sf-reviews__rail">
            {testimonials.map((t) => (
              <figure className="sf-review" key={t.id}>
                <div className="sf-stars" aria-label={`${t.rating} out of 5`}>
                  {Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < t.rating ? 'is-on' : ''} />)}
                </div>
                <blockquote>“{t.content}”</blockquote>
                <figcaption>— {t.customer_name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="sf-contact" data-reveal>
        <a href={`mailto:${contactEmail}`}><Mail size={17} /> {curator.public_email ? 'Email the shop' : 'Contact P31'}</a>
        {curator.phone && <a href={`tel:${curator.phone.replace(/[^\d+]/g, '')}`}><Phone size={17} /> {curator.phone}</a>}
        <span>p31market.com/{curator.slug || curator.id.slice(0, 8)}</span>
      </section>

      {/* ── Product sheet ────────────────────────────────── */}
      {open && (
        <div className="sf-sheet" role="dialog" aria-modal="true" aria-label={open.name} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="sf-sheet__panel">
            <button className="sf-sheet__close" onClick={() => setOpen(null)} aria-label="Close"><X size={18} /></button>
            <div className="sf-gallery">
              {(open.image_urls?.length ? open.image_urls : [open.image_url]).filter(Boolean).map((src, i) => (
                <img key={src} src={src} alt={i === 0 ? open.name : ''} />
              ))}
              {!open.image_url && !open.image_urls?.length && <div className="sf-gallery__none"><ShoppingBag size={32} /></div>}
            </div>
            <div className="sf-sheet__body">
              <p className="sf-eyebrow">{open.category || 'Collection'}</p>
              <h2>{open.name}</h2>
              <p className="sf-price sf-price--lg">
                <strong>{money(open.price)}</strong>
                {Number(open.compare_at_price) > Number(open.price) && <s>{money(open.compare_at_price)}</s>}
                {stockLabel(open) && <span className="sf-pill">{stockLabel(open)}</span>}
              </p>
              {open.inventory > 0 && open.inventory <= 5 && <p className="sf-low">Only {open.inventory} left</p>}
              {open.description && <p className="sf-desc">{open.description}</p>}
              {open.tags?.length > 0 && <div className="sf-tags">{open.tags.map((t) => <span key={t}>#{t}</span>)}</div>}

              {groupsOf(open).map((g) => (
                <div className="sf-opt" key={g.name}>
                  <p className="sf-opt__label">{g.name}{sel[g.name] ? `: ${sel[g.name]}` : ''}</p>
                  <div className="sf-opt__choices" role="radiogroup" aria-label={g.name}>
                    {g.options.map((o) => (
                      <button key={o} role="radio" aria-checked={sel[g.name] === o}
                        onClick={() => { setSel({ ...sel, [g.name]: o }); setOptError(''); setAdded(false); }}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}

              {!soldOut(open) && !open.external_url && (
                <div className="sf-qty">
                  <span className="sf-opt__label">Quantity</span>
                  <div>
                    <button onClick={() => setQty(Math.max(1, qty - 1))} aria-label="One fewer"><Minus size={15} /></button>
                    <span>{qty}</span>
                    <button onClick={() => setQty(Math.min(maxQty(open), qty + 1))} disabled={qty >= maxQty(open)} aria-label="One more"><Plus size={15} /></button>
                  </div>
                </div>
              )}
              {optError && <p className="sf-low">{optError}</p>}
            </div>
            <div className="sf-sheet__bar">
              <button className={`sf-fav ${fav.has(open.id) ? 'is-on' : ''}`} onClick={() => fav.toggle(open, curator)} aria-label={fav.has(open.id) ? 'Remove from favorites' : 'Save to favorites'}>
                <Heart size={20} />
              </button>
              {soldOut(open) ? (
                <button className="sf-btn sf-btn--accent sf-btn--block" disabled>Sold out</button>
              ) : open.external_url && !canCheckout(open) ? (
                <button className="sf-btn sf-btn--accent sf-btn--block" onClick={() => buyNow(open)}><ShoppingBag size={18} /> Buy on the shop’s site</button>
              ) : added ? (
                <button className="sf-btn sf-btn--accent sf-btn--block" onClick={() => { setOpen(null); cart.openCart(); }}><Check size={18} /> Added — view bag ({cart.count})</button>
              ) : (
                <>
                  <button className="sf-btn sf-btn--soft" onClick={() => buyNow(open)} disabled={checkoutLoadingId === open.id}>
                    {checkoutLoadingId === open.id ? <Loader2 size={18} className="sf-spin" /> : null} Buy now
                  </button>
                  <button className="sf-btn sf-btn--accent sf-btn--block" onClick={() => addToBag(open)}><ShoppingBag size={18} /> Add to bag</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuratorProfile;
