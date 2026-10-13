import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Star, ExternalLink, MessagesSquare, Check, X, Eye, EyeOff, Package, FileSignature, Mail, Save, CreditCard, CalendarPlus, Gift, Ban, PlayCircle, Settings2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRoles } from '../../lib/roles';
import { SITES } from '../nav';
import { DeleteRecord, EditRecord } from '../AdminRecord';

// The vendor studio's availability choices, so an admin edit matches what she sees.
const STOCK = [['in_stock', 'In stock'], ['out_of_stock', 'Sold out'], ['limited_edition', 'Limited edition'], ['pre_order', 'Pre-order']];
const PRODUCT_FIELDS = [['name', 'Name'], ['price', 'Price ($)', 'number'], ['compare_at_price', 'Was price ($, shows a sale)', 'number'], ['category', 'Category'],
  ['stock_status', 'Availability', 'select', STOCK], ['inventory', 'How many left', 'number'], ['badge', 'Badge (New, Bestseller, Handmade…)'], ['description', 'Description', 'textarea']];

const STATUSES = [['draft', 'Draft'], ['pending', 'Pending'], ['approved', 'Approved'], ['paused', 'Paused'], ['rejected', 'Needs changes']];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const BILLING = {
  none: ['Not in billing', ''], trial: ['Free period', 'trial'], ended: ['Free period ended', 'ended'], active: ['Subscribed', 'active'],
  past_due: ['Payment failed', 'ended'], canceled: ['Canceled', 'ended'], comp: ['Complimentary', 'comp'],
};
const BILLING_FILTERS = [['any', 'Any billing'], ['soon', 'Ending soon'], ['trial', 'Free period'], ['ended', 'Ended or failed'], ['active', 'Subscribed'], ['comp', 'Complimentary'], ['none', 'Not in billing']];
const money = (n) => (n == null ? '' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: Number(n) % 1 ? 2 : 0 })}`);
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const daysLeft = (iso) => (iso ? Math.ceil((new Date(iso) - Date.now()) / 864e5) : null);
const billingNote = (s) => {
  if (!('subscription_status' in s)) return null;
  const d = daysLeft(s.trial_ends_at);
  if (s.subscription_status === 'trial') return d != null ? (d > 0 ? `Free period · ${d} day${d === 1 ? '' : 's'} left (ends ${fmt(s.trial_ends_at)})` : 'Free period ends today') : 'Free period';
  if (s.subscription_status === 'ended') return `Free period ended ${fmt(s.trial_ends_at)} · not subscribed`;
  if (s.subscription_status === 'active') return `Subscribed${s.subscription_current_end ? ` · renews ${fmt(s.subscription_current_end)}` : ''}`;
  return BILLING[s.subscription_status]?.[0] || s.subscription_status;
};
const matchesBilling = (s, f) => {
  if (f === 'any') return true;
  const st = s.subscription_status;
  if (f === 'soon') return st === 'trial' && daysLeft(s.trial_ends_at) <= 14;
  if (f === 'ended') return ['ended', 'past_due', 'canceled'].includes(st);
  return st === f;
};

// Systems → Curators & shops: every shop on p31market.com, with its status, billing, products and controls.
const Shops = () => {
  const navigate = useNavigate();
  const { roles } = useRoles();
  const admin = !!(roles.admin || roles.operator);
  const [shops, setShops] = useState(null);
  const [filter, setFilter] = useState('all');
  const [billing, setBilling] = useState('any');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [products, setProducts] = useState(null);
  const [edit, setEdit] = useState({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(null);
  const [showTerms, setShowTerms] = useState(false);

  const load = async () => {
    const { data, error: err } = await supabase.rpc('shop_admin_list');
    if (err) { setError(/does not exist|schema cache|Could not find/i.test(err.message) ? 'Run storefront_v41_team_dashboards.sql in Supabase to manage shops here (Systems → Health has a copy button).' : err.message); setShops([]); return; }
    setShops(data || []);
    setSel((cur) => (cur ? (data || []).find((s) => s.id === cur.id) || null : cur));
  };
  useEffect(() => {
    Promise.resolve().then(load);
    supabase.from('app_settings').select('value').eq('key', 'billing').maybeSingle().then(({ data }) => setTerms(data?.value || null));
  }, []);

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
  const bill = async (s, action, days, note) => {
    if (action === 'start_all' && !window.confirm(`Start the free period today for every approved shop that is not in billing yet (early-bird shops stay complimentary)? Each one gets a reminder ${terms?.remind_days || 14} days before it ends.`)) return;
    setBusy(true); setError(''); setMsg('');
    const { data, error: err } = await supabase.rpc('storefront_billing_admin', { p_id: s?.id || null, p_action: action, p_days: days ?? null });
    setBusy(false);
    if (err) return setError(/does not exist|Could not find/i.test(err.message) ? 'Run storefront_v42_operations.sql in Supabase to turn on billing (Systems → Health has a copy button).' : err.message);
    setMsg(action === 'start_all' ? `Free period started for ${data?.changed ?? 0} shop${data?.changed === 1 ? '' : 's'}.` : note);
    load();
  };
  const saveTerms = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const value = { price_cents: Math.round(Number(f.get('price')) * 100) || 1499, free_months: Number(f.get('months')) || 3, remind_days: Number(f.get('remind')) || 14, grace_days: Number(f.get('grace')) || 7, auto_pause: f.get('auto') === 'on' };
    const { error: err } = await supabase.from('app_settings').upsert({ key: 'billing', value, updated_at: new Date().toISOString() });
    if (err) return setError(err.message);
    setTerms(value); setMsg('Billing terms saved.'); setShowTerms(false);
  };
  const saveDetails = (e) => {
    e.preventDefault();
    patch(sel, { business_name: edit.business_name, slug: edit.slug, tagline: edit.tagline, admin_feedback: edit.admin_feedback, verification_badges: edit.verification_badges.split(',').map((b) => b.trim()).filter(Boolean) }, 'Shop details saved.');
  };
  const setProduct = async (p, change) => {
    const { data, error: err } = await supabase.rpc('shop_admin_set_product', { p_id: p.id, p_patch: change });
    if (err) { setError(err.message); return { error: err }; }
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, ...change, ...(data && typeof data === 'object' ? data : {}) } : x)));
    return { data };
  };
  const message = async (s) => {
    const { data, error: err } = await supabase.rpc('chat_open_dm', { p_user: s.id });
    if (err) return setError(err.message);
    navigate(`/gather/${data}`);
  };

  const counts = useMemo(() => (shops || []).reduce((c, s) => ({ ...c, [s.status]: (c[s.status] || 0) + 1 }), {}), [shops]);
  const hasBilling = (shops || []).some((s) => 'subscription_status' in s);
  const shown = (shops || []).filter((s) => (filter === 'all' || s.status === filter) && matchesBilling(s, billing)
    && (!q || `${s.business_name} ${s.slug} ${s.owner_name} ${s.owner_email}`.toLowerCase().includes(q.toLowerCase())));
  const storefront = (s) => `${SITES.market.url}/${s.slug}`;
  const notInBilling = (shops || []).filter((s) => s.status === 'approved' && s.subscription_status === 'none' && !s.is_early_bird).length;

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Market</p>
        <h1>Curators &amp; shops</h1>
        <p className="sys-muted">Every shop on p31market.com. Approve or pause a shop, feature it at the top of the directory, give badges, leave the vendor a note, switch products on or off, and look after her storefront subscription.</p>
      </header>
      {error && <p className="sys-alert" role="alert">{error}</p>}
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}

      {hasBilling && (
        <section className="sys-card sh-billing" data-tour="shops-billing">
          <div className="sh-billing__row">
            <div>
              <h2><CreditCard size={18} /> Storefront billing</h2>
              <p className="sys-muted" style={{ margin: 0 }}>{terms ? `${money((terms.price_cents || 1499) / 100)} a month after a ${terms.free_months || 3}-month free period · reminder ${terms.remind_days || 14} days before it ends · ${terms.auto_pause ? `shops pause ${terms.grace_days || 7} days after an unpaid free period` : 'shops are never paused automatically'}.` : 'Loading the terms…'} New shops start their free period when approved.</p>
            </div>
            <span className="sh-billing__actions">
              {notInBilling > 0 && <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" disabled={busy} onClick={() => bill(null, 'start_all')}><PlayCircle size={14} /> Start for {notInBilling} approved shop{notInBilling === 1 ? '' : 's'}</button>}
              {admin && <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setShowTerms(!showTerms)}><Settings2 size={14} /> Terms</button>}
            </span>
          </div>
          {showTerms && admin && terms && (
            <form className="sys-form sh-terms" onSubmit={saveTerms}>
              <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10 }}>
                <label className="sys-field"><span>Monthly price ($)</span><input name="price" inputMode="decimal" defaultValue={((terms.price_cents || 1499) / 100).toFixed(2)} /></label>
                <label className="sys-field"><span>Free months</span><input name="months" type="number" min="0" max="24" defaultValue={terms.free_months || 3} /></label>
                <label className="sys-field"><span>Reminder (days before)</span><input name="remind" type="number" min="1" max="60" defaultValue={terms.remind_days || 14} /></label>
                <label className="sys-field"><span>Grace days</span><input name="grace" type="number" min="0" max="60" defaultValue={terms.grace_days || 7} /></label>
              </div>
              <label className="sys-chip" style={{ cursor: 'pointer', justifySelf: 'start' }}><input type="checkbox" name="auto" defaultChecked={!!terms.auto_pause} /> Pause a shop automatically when the grace days pass without a subscription</label>
              <p className="sys-muted" style={{ margin: 0, fontSize: '0.82rem' }}>The Storefront Agreement says the storefront is free for 3 months, then {money((terms.price_cents || 1499) / 100)} a month, with a 5% fee per sale. Change these only alongside the agreement.</p>
              <button className="sys-btn sys-btn--gold sys-btn--sm" style={{ justifySelf: 'start' }}><Save size={14} /> Save terms</button>
            </form>
          )}
        </section>
      )}

      <div className="sh-layout">
        <section className="sys-card" data-tour="shops-list">
          <div className="sh-head">
            <label className="sys-field sh-search"><span className="sr-only">Search shops</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by shop, owner or email" aria-label="Search shops" /></label>
          </div>
          <div className="sys-chips sh-counts" role="tablist" data-tour="shops-filters">
            {[['all', 'All', shops?.length], ...STATUSES.filter(([v]) => v !== 'draft' || counts.draft).map(([v, l]) => [v, l, counts[v] || 0])].map(([v, l, n]) => (
              <button key={v} role="tab" aria-selected={filter === v} className={`sys-chip ${filter === v ? 'is-on' : ''}`} onClick={() => setFilter(v)}>{l}{n != null ? ` · ${n}` : ''}</button>
            ))}
          </div>
          {hasBilling && (
            <div className="sys-chips sh-counts" role="tablist" aria-label="Billing">
              {BILLING_FILTERS.map(([v, l]) => <button key={v} role="tab" aria-selected={billing === v} className={`sys-chip ${billing === v ? 'is-on' : ''}`} onClick={() => setBilling(v)}>{l}</button>)}
            </div>
          )}
          {shops === null ? <p className="sys-muted">Loading shops…</p> : shown.length === 0 ? <p className="sys-muted">{shops.length ? 'No shops match.' : 'No shops yet.'}</p> : (
            <div className="sh-list">
              {shown.map((s) => (
                <button key={s.id} type="button" className={`sh-row ${sel?.id === s.id ? 'is-on' : ''}`} onClick={() => open(s)}>
                  {s.logo_url ? <img className="sh-logo" src={s.logo_url} alt="" /> : <span className="sh-logo"><Store size={18} /></span>}
                  <span className="sh-row__main">
                    <strong>{s.business_name || 'New shop'}{s.is_featured && <Star size={13} style={{ marginLeft: 6, verticalAlign: '-2px', color: '#F2CE4D' }} />}</strong>
                    <small>{s.owner_name || s.owner_email || 'Owner'} · {s.products_active}/{s.products} products · {s.orders} order{s.orders === 1 ? '' : 's'}{s.orders_30d ? ` (${s.orders_30d} this month)` : ''} · since {fmt(s.created_at)}</small>
                    {billingNote(s) && <small>{billingNote(s)}</small>}
                  </span>
                  <span className="sh-row__meta">
                    <span className={`sh-status sh-status--${s.status}`}>{STATUS_LABEL[s.status] || s.status}</span>
                    {s.subscription_status && s.subscription_status !== 'none' && <span className={`sh-status sh-bill--${BILLING[s.subscription_status]?.[1] || ''}`}>{BILLING[s.subscription_status]?.[0]}</span>}
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
                {STATUSES.filter(([v]) => v !== 'draft').map(([v, l]) => <button key={v} type="button" className={`sys-chip ${sel.status === v ? 'is-on' : ''}`} disabled={busy} onClick={() => patch(sel, { status: v }, `${sel.business_name} is now ${l.toLowerCase()}.`)}>{l}</button>)}
              </div>
              <p className="sys-muted" style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>Approved shops are live on the site. Paused shops are hidden until approved again; the vendor keeps her studio. Needs changes sends her back to edit, with your note.</p>
            </div>

            {'subscription_status' in sel && (
              <div data-tour="shops-billing-actions">
                <p className="sys-eyebrow">Billing</p>
                <p style={{ margin: '0 0 8px' }}><strong>{billingNote(sel) || BILLING[sel.subscription_status]?.[0] || sel.subscription_status}</strong></p>
                <div className="sys-chips">
                  {['none', 'ended', 'canceled'].includes(sel.subscription_status) && <button type="button" className="sys-chip" disabled={busy} onClick={() => bill(sel, 'start', null, `Free period started for ${sel.business_name}.`)}><PlayCircle size={13} /> Start free period</button>}
                  {['trial', 'ended'].includes(sel.subscription_status) && <button type="button" className="sys-chip" disabled={busy} onClick={() => bill(sel, 'extend', 30, `Free period extended by 30 days for ${sel.business_name}.`)}><CalendarPlus size={13} /> Extend 30 days</button>}
                  {sel.subscription_status !== 'comp' && sel.subscription_status !== 'active' && <button type="button" className="sys-chip" disabled={busy} onClick={() => bill(sel, 'comp', null, `${sel.business_name} is complimentary.`)}><Gift size={13} /> Complimentary</button>}
                  {sel.subscription_status !== 'none' && sel.subscription_status !== 'active' && <button type="button" className="sys-chip" disabled={busy} onClick={() => bill(sel, 'none', null, `${sel.business_name} is out of billing.`)}><Ban size={13} /> Take out of billing</button>}
                </div>
                <p className="sys-muted" style={{ margin: '6px 0 0', fontSize: '0.82rem' }}>The vendor subscribes from her studio (Plan &amp; billing). A subscription is changed or canceled by the vendor herself, or in Stripe.</p>
              </div>
            )}

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
              <label className="sys-field"><span>Note to the vendor (she sees it in her studio)</span><textarea rows={3} value={edit.admin_feedback} onChange={(e) => setEdit({ ...edit, admin_feedback: e.target.value })} /></label>
              <button className="sys-btn sys-btn--gold sys-btn--sm" disabled={busy}><Save size={14} /> Save details</button>
            </form>

            <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <span className="sys-muted"><FileSignature size={13} /> {sel.agreement_signed_at ? `Storefront agreement signed ${fmt(sel.agreement_signed_at)}` : 'Storefront agreement not signed yet'}</span>
              <span className="sys-muted"><Mail size={13} /> {sel.stripe_connected ? 'Payouts connected' : 'Payouts not connected'}</span>
              {sel.plan && <span className="sys-muted">Plan: {sel.plan}</span>}
            </div>
            {admin && (
              <div className="adm-actions">
                <DeleteRecord what={`the shop ${sel.business_name || ''} and all of its products`} note="Her login stays, so she could start a new shop; orders keep their record." label="Delete shop"
                  onDelete={() => supabase.rpc('shop_admin_delete_shop', { p_id: sel.id })}
                  onDone={() => { setSel(null); setMsg('Shop deleted.'); load(); }} />
              </div>
            )}

            <div>
              <p className="sys-eyebrow"><Package size={13} /> Products ({products ? products.length : '…'})</p>
              {products === null ? <p className="sys-muted">Loading…</p> : products.length === 0 ? <p className="sys-muted">No products yet.</p> : (
                <div className="sh-products">
                  {products.map((p) => (
                    <div key={p.id} className="sh-product-wrap">
                      <div className={`sh-product ${p.is_active ? '' : 'is-off'}`}>
                        {p.image_url ? <img src={p.image_url} alt="" /> : <span className="sh-product__ph" />}
                        <span className="sh-product__main"><strong>{p.name}</strong><small>{money(p.price)}{p.badge ? ` · ${p.badge}` : ''}{p.is_featured ? ' · featured' : ''}{p.is_active ? '' : ' · hidden'}</small></span>
                        <span className="sh-product__actions">
                          <button type="button" className="sys-icon-btn" title={p.is_active ? 'Hide this product' : 'Show this product'} aria-label={p.is_active ? 'Hide' : 'Show'} onClick={() => setProduct(p, { is_active: !p.is_active })}>{p.is_active ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                          <button type="button" className="sys-icon-btn" title={p.is_featured ? 'Unfeature' : 'Feature in the shop'} aria-label="Feature" onClick={() => setProduct(p, { is_featured: !p.is_featured })}><Star size={14} fill={p.is_featured ? '#F2CE4D' : 'none'} /></button>
                        </span>
                      </div>
                      <div className="adm-actions sh-product__more">
                        <EditRecord title="Edit product" value={{ ...p, stock_status: p.stock_status || 'in_stock' }} fields={PRODUCT_FIELDS} onSave={(patch) => setProduct(p, patch)} />
                        <DeleteRecord what={`${p.name}`} note="It disappears from her shop." label="Delete product"
                          onDelete={() => supabase.rpc('shop_admin_delete_product', { p_id: p.id })}
                          onDone={() => setProducts((list) => list.filter((x) => x.id !== p.id))} />
                      </div>
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
