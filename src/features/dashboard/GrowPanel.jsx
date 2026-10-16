import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Megaphone, MapPin, Loader2, CheckCircle2, Star, Crown, ImagePlus, X, ExternalLink, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { dollars } from './billingState';
import './BillingPanel.css';
import './GrowPanel.css';

const DEFAULTS = {
  included_products: 10,
  product_packs: [{ key: 'p1', slots: 1, cents: 200 }, { key: 'p7', slots: 7, cents: 1000 }, { key: 'p20', slots: 20, cents: 2000 }],
  featured_plans: [{ key: 'f2', posts: 2, cents: 2500 }, { key: 'f5', posts: 5, cents: 5000 }],
  featured_cap: 10,
};
const POST_STATUS = { waiting: 'Send your photos', submitted: 'With the team', scheduled: 'Scheduled', posted: 'Posted', skipped: 'Skipped' };
const monthName = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

async function call(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  let msg = error?.message;
  if (error) { try { msg = (await error.context?.json())?.error || msg; } catch { /* keep message */ } }
  if (error || data?.error) throw new Error(data?.error || msg || 'Something went wrong. Write to vendor@p31market.com and we will help.');
  return data;
}

/** One owed post: photos, caption and an optional product, sent to the team for the P31 feeds. */
const PostForm = ({ post, products, userId, onSent }) => {
  const [caption, setCaption] = useState(post.caption || '');
  const [media, setMedia] = useState(Array.isArray(post.media) ? post.media : []);
  const [product, setProduct] = useState(post.product_id || '');
  const [note, setNote] = useState(post.vendor_note || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const upload = async (files) => {
    setBusy('upload'); setError('');
    try {
      const added = [];
      for (const file of [...files].slice(0, 10 - media.length)) {
        if (!file.type.startsWith('image/')) throw new Error('Photos only, please (JPG or PNG).');
        const path = `${userId}-featured-${Date.now()}-${Math.floor(Math.random() * 1000)}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
        const { error: err } = await supabase.storage.from('products').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (err) throw err;
        added.push({ type: 'image', url: supabase.storage.from('products').getPublicUrl(path).data.publicUrl, name: file.name });
      }
      setMedia((m) => [...m, ...added]);
    } catch (e) { setError(e.message); }
    setBusy('');
  };
  const send = async (e) => {
    e.preventDefault();
    setBusy('send'); setError('');
    const { error: err } = await supabase.rpc('featured_submit', { p_id: post.id, p_caption: caption, p_media: media, p_product: product ? Number(product) : null, p_note: note || null });
    setBusy('');
    if (err) return setError(err.message);
    onSent();
  };

  return (
    <form className="gr-post__form" onSubmit={send}>
      <div className="gr-media">
        {media.map((m, i) => (
          <figure key={m.url}><img src={m.url} alt="" /><button type="button" onClick={() => setMedia(media.filter((_, j) => j !== i))} aria-label="Remove photo"><X size={12} /></button></figure>
        ))}
        {media.length < 10 && (
          <label className="gr-media__add">
            {busy === 'upload' ? <Loader2 size={18} className="spin" /> : <ImagePlus size={18} />}
            <span>Add photos</span>
            <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          </label>
        )}
      </div>
      <label className="gr-field"><span>Caption (we may polish it)</span>
        <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What should women know about your shop or this product?" /></label>
      <div className="gr-row">
        <label className="gr-field"><span>Product to spotlight (optional)</span>
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">The whole shop</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label className="gr-field"><span>Note for the team (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A date, a sale, who to tag…" /></label>
      </div>
      {error && <p className="bl-error" role="alert">{error}</p>}
      <button className="btn-solid-gold" disabled={!!busy || !media.length || caption.trim().length < 10}>
        {busy === 'send' ? <><Loader2 size={16} className="spin" /> Sending…</> : <><Send size={16} /> {post.status === 'submitted' ? 'Update what I sent' : 'Send to the P31 team'}</>}
      </button>
    </form>
  );
};

/** /dashboard/grow — add-ons for a shop: product slots, Featured, Google reviews. */
const GrowPanel = ({ curator, userId }) => {
  const [params] = useSearchParams();
  const [terms, setTerms] = useState(DEFAULTS);
  const [addons, setAddons] = useState([]);
  const [limit, setLimit] = useState(null);
  const [products, setProducts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pick, setPick] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [placeSet, setPlace] = useState(undefined); // undefined: show what the shop has saved
  const [googleInput, setGoogleInput] = useState(curator?.google_maps_url || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState({});
  const [openPost, setOpenPost] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!userId) return null;
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(0, 7) + '-01';
    const [t, a, l, p, f, k, c] = await Promise.all([
      supabase.from('app_settings').select('value').eq('key', 'addons').maybeSingle(),
      supabase.from('shop_addons').select('*').eq('curator_id', userId).order('created_at', { ascending: false }),
      supabase.rpc('shop_product_limit', { p_curator: userId }),
      supabase.from('products').select('id, name, is_active').eq('curator_id', userId).order('created_at', { ascending: false }),
      supabase.from('featured_posts').select('*').eq('curator_id', userId).not('status', 'in', '(posted,skipped)').order('month').order('created_at'),
      supabase.from('featured_picks').select('month, note').eq('curator_id', userId).eq('month', month).maybeSingle(),
      supabase.rpc('featured_capacity'),
    ]);
    return { t, a, l, p, f, k, c };
  }, [userId]);
  const apply = (r) => {
    if (!r) return;
    if (r.t.data?.value) setTerms({ ...DEFAULTS, ...r.t.data.value });
    setAddons(r.a.data || []);
    setLimit(typeof r.l.data === 'number' ? r.l.data : null);
    setProducts(r.p.data || []);
    setPosts(r.f.data || []);
    setPick(r.k.data || null);
    setCapacity(r.c.data || null);
  };
  const load = () => fetchAll().then(apply);
  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [fetchAll]);
  const place = placeSet === undefined ? curator?.google_place || null : placeSet;

  const live = (kind) => addons.filter((a) => a.kind === kind && ['active', 'past_due'].includes(a.status));
  const showing = products.filter((p) => p.is_active !== false).length;
  const featured = live('featured')[0];
  const full = capacity && capacity.taken >= capacity.cap;

  const buy = async (kind, plan) => {
    setBusy(`${kind}:${plan}`); setError({});
    try { const d = await call('vendor-billing', { action: 'addon', kind, plan }); if (d?.url) window.location.assign(d.url); } catch (e) { setError({ [kind]: e.message }); setBusy(''); }
  };
  const manage = async (kind) => {
    setBusy(`${kind}:portal`); setError({});
    try { const d = await call('vendor-billing', { action: 'portal' }); if (d?.url) window.location.assign(d.url); } catch (e) { setError({ [kind]: e.message }); setBusy(''); }
  };
  const connectGoogle = async (e) => {
    e.preventDefault();
    setBusy('google'); setError({});
    try { const d = await call('google-place', { action: 'connect', input: googleInput }); setPlace(d.place); } catch (err) { setError({ google: err.message }); }
    setBusy('');
  };
  const disconnectGoogle = async () => {
    setBusy('google-off'); setError({});
    try { await call('google-place', { action: 'disconnect' }); setPlace(null); setGoogleInput(''); } catch (err) { setError({ google: err.message }); }
    setBusy('');
  };

  const status = params.get('status');
  return (
    <div className="dashboard-view bl gr">
      <header className="dashboard-header">
        <h1 className="font-headline text-primary">Grow your <span className="text-gold">shop</span></h1>
        <p>Add-ons for your storefront: more product space, a Featured spot on P31’s social media, and your Google reviews.</p>
      </header>
      {status === 'success' && <p className="bl-note bl-note--ok" role="status"><CheckCircle2 size={18} /> Thank you. Your add-on is set up; it can take a minute to show here.</p>}
      {status === 'cancelled' && <p className="bl-note" role="status">No changes were made.</p>}

      {/* Product slots */}
      <section className="bl-card" data-tour="grow-products">
        <span className="bl-card__icon"><Package size={24} /></span>
        <div>
          <h2>Product slots</h2>
          <p>Your plan includes {terms.included_products} products. {limit != null && <>You are showing <b>{showing} of {limit}</b>.</>}</p>
          {limit != null && <div className="gr-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (showing / Math.max(limit, 1)) * 100)}%` }} /></div>}
          <div className="gr-plans">
            {terms.product_packs.map((p) => (
              <button type="button" key={p.key} className="gr-plan" disabled={!!busy} onClick={() => buy('products', p.key)}>
                <strong>+{p.slots} product{p.slots === 1 ? '' : 's'}</strong>
                <span>{dollars(p.cents)}/month</span>
                {busy === `products:${p.key}` && <Loader2 size={14} className="spin" />}
              </button>
            ))}
          </div>
          {live('products').length > 0 && (
            <p className="bl-fine">Your packs: {live('products').map((a) => `+${a.slots}`).join(', ')}{live('products').some((a) => a.cancel_at_period_end) ? ' (one ends at the close of this billing month)' : ''}.{' '}
              <button type="button" className="gr-link" onClick={() => manage('products')}>Manage billing</button></p>
          )}
          <p className="bl-fine">Packs add up and renew monthly. If a pack ends, your newest products over the limit are hidden (never deleted) until you make room.</p>
          {error.products && <p className="bl-error" role="alert">{error.products}</p>}
        </div>
      </section>

      {/* Featured */}
      <section className="bl-card" data-tour="grow-featured">
        <span className="bl-card__icon"><Megaphone size={24} /></span>
        <div>
          <h2>Featured on P31</h2>
          <p>We post your shop or products on the Proverbs 31 Marketplace Instagram and Facebook, and you sit on the Featured shelf on p31market.com while your plan is active.</p>
          {pick && <p className="gr-pick"><Crown size={16} /> You are the <b>CEO Selected</b> shop for {monthName(pick.month)}. One post is on us.</p>}
          {featured ? (
            <p className="bl-fine"><CheckCircle2 size={14} /> Your plan: <b>{featured.posts} posts a month</b>{featured.cancel_at_period_end ? ', ending at the close of this billing month' : ''}.{' '}
              <button type="button" className="gr-link" onClick={() => manage('featured')}>Change or cancel</button></p>
          ) : (
            <>
              <div className="gr-plans">
                {terms.featured_plans.map((p) => (
                  <button type="button" key={p.key} className="gr-plan" disabled={!!busy || full} onClick={() => buy('featured', p.key)}>
                    <strong>{p.posts} posts a month</strong>
                    <span>{dollars(p.cents)}/month</span>
                    {busy === `featured:${p.key}` && <Loader2 size={14} className="spin" />}
                  </button>
                ))}
              </div>
              {capacity && <p className="bl-fine">{full ? 'Featured is full this month. Write to vendor@p31market.com and we will save you the next spot.' : `${capacity.cap - capacity.taken} of ${capacity.cap} Featured spots open this month.`}</p>}
            </>
          )}
          {posts.length > 0 && (
            <ul className="gr-posts">
              {posts.map((p, n) => (
                <li key={p.id} className={`gr-post gr-post--${p.status}`}>
                  <div className="gr-post__head">
                    <span>{p.source === 'ceo' ? <Crown size={14} /> : <Megaphone size={14} />} Post {n + 1} · {monthName(p.month)}</span>
                    <span className="gr-pill">{POST_STATUS[p.status]}</span>
                    {['waiting', 'submitted'].includes(p.status) && (
                      <button type="button" className="gr-link" onClick={() => setOpenPost(openPost === p.id ? null : p.id)}>{openPost === p.id ? 'Close' : p.status === 'waiting' ? 'Send photos' : 'Edit'}</button>
                    )}
                  </div>
                  {openPost === p.id && <PostForm post={p} products={products} userId={userId} onSent={() => { setOpenPost(null); load(); }} />}
                </li>
              ))}
            </ul>
          )}
          <p className="bl-fine">How it works: send photos and a caption for each post. The team reviews it, may polish the words, and schedules it on P31’s feeds. A post not sent in its month rolls over to the next. Renews monthly; cancel any time.</p>
          {error.featured && <p className="bl-error" role="alert">{error.featured}</p>}
        </div>
      </section>

      {/* Google */}
      <section className="bl-card" data-tour="grow-google">
        <span className="bl-card__icon"><MapPin size={24} /></span>
        <div>
          <h2>Google reviews</h2>
          <p>Show your Google star rating, recent reviews, hours and map on your storefront. Free, and it updates on its own.</p>
          {place ? (
            <div className="gr-place">
              <strong>{place.name}</strong>
              {place.rating != null && <span className="gr-stars"><Star size={14} /> {Number(place.rating).toFixed(1)} · {place.count} review{place.count === 1 ? '' : 's'}</span>}
              <span>{place.address}</span>
              <div className="gr-place__acts">
                <a href={place.maps_url} target="_blank" rel="noreferrer" className="gr-link"><ExternalLink size={13} /> See it on Google</a>
                <button type="button" className="gr-link" onClick={disconnectGoogle} disabled={!!busy}>Remove from my shop</button>
              </div>
            </div>
          ) : (
            <form className="gr-google" onSubmit={connectGoogle}>
              <input value={googleInput} onChange={(e) => setGoogleInput(e.target.value)} placeholder="Paste your Google Maps link, or your business name and city" aria-label="Google Maps link or business name" />
              <button className="btn-solid-gold" disabled={!!busy || googleInput.trim().length < 3}>{busy === 'google' ? <><Loader2 size={16} className="spin" /> Finding…</> : 'Connect'}</button>
            </form>
          )}
          <p className="bl-fine">On your phone: open Google Maps, find your business, tap <b>Share</b>, and paste the link here.</p>
          {error.google && <p className="bl-error" role="alert">{error.google}</p>}
        </div>
      </section>
    </div>
  );
};

export default GrowPanel;
