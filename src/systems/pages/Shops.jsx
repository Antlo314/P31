import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Search, Star, ExternalLink, MessagesSquare, Check, X, Eye, EyeOff, Package, FileSignature, Mail, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SITES } from '../nav';

const STATUSES = [['pending', 'Pending'], ['approved', 'Approved'], ['paused', 'Paused'], ['declined', 'Declined']];
const money = (n) => (n == null ? '' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0 })}`);
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

// Systems → Curators & shops: every shop on p31market.com, with its status, products and controls.
const Shops = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [products, setProducts] = useState(null);
  const [edit, setEdit] = useState({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error: err } = await supabase.rpc('shop_admin_list');
    if (err) { setError(/does not exist|schema cache/i.test(err.message) ? 'Run storefront_v41_team_dashboards.sql in Supabase to manage shops here.' : err.message); setShops([]); return; }
    setShops(data || []);
    if (sel) setSel((data || []).find((s) => s.id === sel.id) || null);
  };
  useEffect(() => { Promise.resolve().then(load); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (s) => {
    setSel(s); setProducts(null); setMsg(''); setError('');
    setEdit({ business_name: s.business_name || '', slug: s.slug || '', tagline: s.tagline || '', admin_feedback: s.admin_feedback || '', verification_badges: (s.verification_badges || []).join(', ') });
    const { data } = await supabase.rpc('shop_admin_products', { p_id: s.id });
    setProducts(data || []);
  };
  const patch = async (s, p, note) => {
    setBusy(true); setError(''); setMsg('');
    const { error: err } = await supabase.rpc('shop_admin_update', { p_id: s.id, p_patch: p });
    setBusy(false);
    if (err) return setError(err.message);
    setMsg(note || 'Saved.');
    load();
  };
  const saveDetails = (e) => {
    e.preventDefault();
    patch(sel, { business_name: edit.business_name, slug: edit.slug, tagline: edit.tagline, admin_feedback: edit.admin_feedback, verification_badges: edit.verification_badges.split(',').map((b) => b.trim()).filter(Boolean) }, 'Shop details saved.');
  };
  const setProduct = async (p, change) => {
    const { error: err } = await supabase.rpc('shop_admin_set_product', { p_id: p.id, p_patch: change });
    if (err) return setError(err.message);
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, ...change } : x)));
  };
  const message = async (s) => {
    const { data, error: err } = await supabase.rpc('chat_open_dm', { p_user: s.id });
    if (err) return setError(err.message);
    navigate(`/gather/${data}`);
  };

  const counts = useMemo(() => (shops || []).reduce((c, s) => ({ ...c, [s.status]: (c[s.status] || 0) + 1 }), {}), [shops]);
  const shown = (shops || []).filter((s) => (filter === 'all' || s.status === filter) && (!q || `${s.business_name} ${s.slug} ${s.owner_name} ${s.owner_email}`.toLowerCase().includes(q.toLowerCase())));
  const storefront = (s) => `${SITES.market.url}/${s.slug}`;

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Market</p>
        <h1>Curators &amp; shops</h1>
        <p className="sys-muted">Every shop on p31market.com. Approve or pause a shop, feature it at the top of the directory, give badges, leave the vendor a note, and switch products on or off.</p>
      </header>
      {error && <p className="sys-alert" role="alert">{error}</p>}
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}

      <div className="sh-layout">
        <section className="sys-card" data-tour="shops-list">
          <div className="sh-head">
            <label className="sys-field sh-search"><span className="sr-only">Search shops</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by shop, owner or email" aria-label="Search shops" /></label>
          </div>
          <div className="sys-chips sh-counts" role="tablist" data-tour="shops-filters">
            {[['all', 'All', shops?.length], ...STATUSES.map(([v, l]) => [v, l, counts[v] || 0])].map(([v, l, n]) => (
              <button key={v} role="tab" aria-selected={filter === v} className={`sys-chip ${filter === v ? 'is-on' : ''}`} onClick={() => setFilter(v)}>{l}{n != null ? ` · ${n}` : ''}</button>
            ))}
          </div>
          {shops === null ? <p className="sys-muted">Loading shops…</p> : shown.length === 0 ? <p className="sys-muted">{shops.length ? 'No shops match.' : 'No shops yet.'}</p> : (
            <div className="sh-list">
              {shown.map((s) => (
                <button key={s.id} type="button" className={`sh-row ${sel?.id === s.id ? 'is-on' : ''}`} onClick={() => open(s)}>
                  {s.logo_url ? <img className="sh-logo" src={s.logo_url} alt="" /> : <span className="sh-logo"><Store size={18} /></span>}
                  <span className="sh-row__main">
                    <strong>{s.business_name || 'New shop'}{s.is_featured && <Star size={13} style={{ marginLeft: 6, verticalAlign: '-2px', color: '#F2CE4D' }} />}</strong>
                    <small>{s.owner_name || s.owner_email || 'Owner'} · {s.products_active}/{s.products} products · {s.orders} order{s.orders === 1 ? '' : 's'}{s.orders_30d ? ` (${s.orders_30d} this month)` : ''} · since {fmt(s.created_at)}</small>
                  </span>
                  <span className="sh-row__meta">
                    <span className={`sh-status sh-status--${s.status}`}>{s.status}</span>
                    {s.is_paid && <span className="sh-status">Paid</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {sel && (
          <section className="sys-card sh-detail" data-tour="shops-detail">
            <div className="sh-detail__head">
              {sel.logo_url ? <img className="sh-logo" src={sel.logo_url} alt="" /> : <span className="sh-logo"><Store size={18} /></span>}
              <div><h2>{sel.business_name || 'New shop'}</h2><p className="sys-muted" style={{ margin: 0 }}>{sel.owner_name || 'Owner'}{sel.owner_email && <> · <a href={`mailto:${sel.owner_email}`}>{sel.owner_email}</a></>}</p></div>
              <span className="sh-row__meta" style={{ marginLeft: 'auto' }}>
                <a className="sys-btn sys-btn--ghost sys-btn--sm" href={storefront(sel)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open shop</a>
                <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => message(sel)}><MessagesSquare size={14} /> Message</button>
                <button type="button" className="sys-icon-btn" onClick={() => setSel(null)} aria-label="Close"><X size={16} /></button>
              </span>
            </div>

            <div>
              <p className="sys-eyebrow">Status</p>
              <div className="sys-chips">
                {STATUSES.map(([v, l]) => <button key={v} type="button" className={`sys-chip ${sel.status === v ? 'is-on' : ''}`} disabled={busy} onClick={() => patch(sel, { status: v }, `${sel.business_name} is now ${l.toLowerCase()}.`)}>{l}</button>)}
              </div>
              <p className="sys-muted" style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>Approved shops are live on the site. Paused shops stay hidden until approved again; the vendor keeps her studio.</p>
            </div>

            <div>
              <p className="sys-eyebrow">Switches</p>
              <div className="sh-toggles">
                {[['is_featured', 'Featured in the directory', Star], ['is_paid', 'Paid storefront', Check], ['is_early_bird', 'Early bird (free store)', Star], ['is_published', 'Published', Eye]].map((sw) => {
                  const k = sw[0]; const l = sw[1]; const Icon = sw[2];
                  return <button key={k} type="button" className={`sys-chip ${sel[k] ? 'is-on' : ''}`} aria-pressed={!!sel[k]} disabled={busy} onClick={() => patch(sel, { [k]: !sel[k] }, `${l}: ${sel[k] ? 'off' : 'on'}.`)}><Icon size={13} /> {l}</button>;
                })}
              </div>
            </div>

            <form className="sys-form" onSubmit={saveDetails}>
              <div className="sys-row">
                <label className="sys-field sys-grow"><span>Shop name</span><input value={edit.business_name} onChange={(e) => setEdit({ ...edit, business_name: e.target.value })} /></label>
                <label className="sys-field sys-grow"><span>Link (p31market.com/…)</span><input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} /></label>
              </div>
              <label className="sys-field"><span>Tagline</span><input value={edit.tagline} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} /></label>
              <label className="sys-field"><span>Badges (comma-separated, e.g. Handmade, Organic, Verified)</span><input value={edit.verification_badges} onChange={(e) => setEdit({ ...edit, verification_badges: e.target.value })} /></label>
              <label className="sys-field"><span>Note to the vendor (she sees it in her studio while her shop is pending or paused)</span><textarea rows={3} value={edit.admin_feedback} onChange={(e) => setEdit({ ...edit, admin_feedback: e.target.value })} /></label>
              <button className="sys-btn sys-btn--gold sys-btn--sm" disabled={busy}><Save size={14} /> Save details</button>
            </form>

            <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <span className="sys-muted"><FileSignature size={13} /> {sel.agreement_signed_at ? `Storefront agreement signed ${fmt(sel.agreement_signed_at)}` : 'Storefront agreement not signed yet'}</span>
              <span className="sys-muted"><Mail size={13} /> {sel.stripe_connected ? 'Payouts connected' : 'Payouts not connected'}</span>
              {sel.plan && <span className="sys-muted">Plan: {sel.plan}</span>}
            </div>

            <div>
              <p className="sys-eyebrow"><Package size={13} /> Products ({products ? products.length : '…'})</p>
              {products === null ? <p className="sys-muted">Loading…</p> : products.length === 0 ? <p className="sys-muted">No products yet.</p> : (
                <div className="sh-products">
                  {products.map((p) => (
                    <div key={p.id} className={`sh-product ${p.is_active ? '' : 'is-off'}`}>
                      {p.image_url ? <img src={p.image_url} alt="" /> : <span className="sh-product__ph" />}
                      <span className="sh-product__main"><strong>{p.name}</strong><small>{money(p.price)}{p.badge ? ` · ${p.badge}` : ''}{p.is_featured ? ' · featured' : ''}{p.is_active ? '' : ' · hidden'}</small></span>
                      <span className="sh-product__actions">
                        <button type="button" className="sys-icon-btn" title={p.is_active ? 'Hide this product' : 'Show this product'} aria-label={p.is_active ? 'Hide' : 'Show'} onClick={() => setProduct(p, { is_active: !p.is_active })}>{p.is_active ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                        <button type="button" className="sys-icon-btn" title={p.is_featured ? 'Unfeature' : 'Feature in the shop'} aria-label="Feature" onClick={() => setProduct(p, { is_featured: !p.is_featured })}><Star size={14} fill={p.is_featured ? '#F2CE4D' : 'none'} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Shops;
