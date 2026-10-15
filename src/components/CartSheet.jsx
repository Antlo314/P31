import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, Trash2, ShoppingBag, CreditCard, Send, Tag, Check, Store, Loader2, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { invokePayment, CARD_PAYMENTS_ENABLED } from '../lib/payments';
import { useCart } from '../context/CartContext';
import { MERCH_SHOP, isMerch } from '../pages/merch/shop';
import { SHIPPING } from '../../supabase/functions/_shared/merch-catalog.js';
import './CartSheet.css';

const money = (n) => `$${Number(n).toFixed(2)}`;
const optText = (o) => Object.entries(o || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
const METHODS = [
  ['market', 'Pick up at the next market'],
  ['pickup', 'Local pickup'],
  ['ship', 'Ship to me'],
];

// What a shopper sees once her order request is in: the order number and the shop's ways to pay.
const SentNote = ({ receipt: r }) => (
  <section className="cs2-group">
    <div className="cs2-done">
      <span><Check size={24} /></span>
      <h3>Order request sent</h3>
      <p>{r.shopName} has your order <strong>#{r.ref}</strong> and will confirm it by email.</p>
      {(r.shop?.cashapp_tag || r.shop?.venmo_handle || r.shop?.stripe_link || r.shop?.other_payment_link) && (
        <div className="cs2-pay">
          <p className="cs2-label">Pay {money(r.total)} — include #{r.ref}</p>
          {r.shop.cashapp_tag && <a href={`https://cash.app/$${r.shop.cashapp_tag.replace('$', '')}`} target="_blank" rel="noreferrer"><DollarSign size={16} /> Cash App ${r.shop.cashapp_tag.replace('$', '')}</a>}
          {r.shop.venmo_handle && <a href={`https://venmo.com/${r.shop.venmo_handle.replace('@', '')}`} target="_blank" rel="noreferrer"><Send size={16} /> Venmo @{r.shop.venmo_handle.replace('@', '')}</a>}
          {r.shop.stripe_link && <a href={r.shop.stripe_link} target="_blank" rel="noreferrer"><CreditCard size={16} /> Pay by card</a>}
          {r.shop.other_payment_link && <a href={r.shop.other_payment_link.startsWith('http') ? r.shop.other_payment_link : `mailto:${r.shop.other_payment_link}`} target="_blank" rel="noreferrer"><ShoppingBag size={16} /> {r.shop.other_payment_label || 'Direct payment'}</a>}
        </div>
      )}
    </div>
  </section>
);

// One shop's part of the bag: lines, discount, and checkout.
const ShopGroup = ({ group, shop, onSent }) => {
  const { setQty, remove, clearShop } = useCart();
  const [code, setCode] = useState('');
  const [disc, setDisc] = useState(null); // { ok, amount_cents, message, code }
  const [mode, setMode] = useState('bag'); // bag | request
  const [form, setForm] = useState({ name: '', email: '', phone: '', method: 'market', note: '', trap: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const subtotalCents = Math.round(group.subtotal * 100);
  const discountCents = disc?.ok ? disc.amount_cents : 0;
  const total = (subtotalCents - discountCents) / 100;
  const cards = CARD_PAYMENTS_ENABLED && shop?.stripe_charges_enabled;
  const payload = group.items.map((l) => ({ productId: l.productId, quantity: l.quantity, options: l.options }));

  // Re-check the code whenever the bag changes.
  useEffect(() => {
    if (!disc?.code) return;
    supabase.rpc('compute_discount', { p_curator_id: group.curatorId, p_code: disc.code, p_subtotal_cents: subtotalCents })
      .then(({ data }) => setDisc(data));
  }, [subtotalCents]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    const { data, error: err } = await supabase.rpc('compute_discount', {
      p_curator_id: group.curatorId, p_code: code.trim(), p_subtotal_cents: subtotalCents,
    });
    setDisc(err ? { ok: false, message: 'Codes aren’t available right now.' } : { ...data, code: data?.ok ? data.code : null });
  };

  const merch = isMerch(group.curatorId);
  const merchShipping = group.subtotal * 100 >= SHIPPING.freeOverCents ? 0 : SHIPPING.cents / 100;
  const merchCheckout = async () => {
    setBusy(true); setError('');
    try {
      const { url } = await invokePayment('merch', {
        action: 'checkout',
        items: group.items.map((l) => ({ item: String(l.productId).replace(/^merch:/, ''), color: l.options?.Color, size: l.options?.Size, quantity: l.quantity })),
      });
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const payByCard = async () => {
    setBusy(true); setError('');
    try {
      const { url } = await invokePayment('stripe-checkout', { items: payload, discountCode: disc?.ok ? disc.code : undefined });
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const sendRequest = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await invokePayment('order-request', {
        curatorId: group.curatorId,
        items: payload,
        buyer: { name: form.name, email: form.email, phone: form.phone },
        method: form.method,
        note: form.note,
        discountCode: disc?.ok ? disc.code : undefined,
        trap: form.trap,
      });
      // The note goes up to the bag first: clearing the shop removes this group.
      onSent({ curatorId: group.curatorId, shopName: group.shopName, shop, ref: data?.ref, total: data?.total ? data.total / 100 : total });
      clearShop(group.curatorId);
      return;
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <section className="cs2-group">
      <header className="cs2-shop">
        {shop?.logo_url ? <img src={shop.logo_url} alt="" /> : <span><Store size={16} /></span>}
        <Link to={`/${group.shopSlug}`}>{group.shopName}</Link>
      </header>

      <ul className="cs2-lines">
        {group.items.map((l) => (
          <li key={l.key}>
            <div className="cs2-thumb">{l.image ? <img src={l.image} alt="" /> : <ShoppingBag size={18} />}</div>
            <div className="cs2-info">
              <strong>{l.name}</strong>
              {optText(l.options) && <span>{optText(l.options)}</span>}
              <span className="cs2-price">{money(l.price)}</span>
            </div>
            <div className="cs2-qty">
              <button onClick={() => setQty(l.key, l.quantity - 1)} aria-label="One fewer">{l.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button>
              <span aria-live="polite">{l.quantity}</span>
              <button onClick={() => setQty(l.key, l.quantity + 1)} disabled={l.quantity >= (l.max || 20)} aria-label="One more"><Plus size={14} /></button>
            </div>
          </li>
        ))}
      </ul>

      {!merch && (<form className="cs2-code" onSubmit={applyCode}>
        <Tag size={15} />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Discount code" aria-label="Discount code" />
        <button>Apply</button>
      </form>)}
      {disc?.message && <p className={disc.ok ? 'cs2-ok' : 'cs2-err'}>{disc.ok ? `${disc.code} — ${disc.message}` : disc.message}</p>}

      <dl className="cs2-totals">
        <div><dt>Subtotal</dt><dd>{money(group.subtotal)}</dd></div>
        {discountCents > 0 && <div className="is-disc"><dt>Discount</dt><dd>−{money(discountCents / 100)}</dd></div>}
        {merch && <div><dt>Shipping</dt><dd>{merchShipping ? money(merchShipping) : 'Free'}</dd></div>}
        <div className="is-total"><dt>Total</dt><dd>{money(merch ? group.subtotal + merchShipping : total)}</dd></div>
      </dl>

      {error && <p className="cs2-err" role="alert">{error}</p>}

      {merch && (
        <div className="cs2-actions">
          <button className="cs2-btn cs2-btn--plum" onClick={merchCheckout} disabled={busy}>
            {busy ? <Loader2 size={16} className="cs2-spin" /> : <CreditCard size={16} />} Checkout · {money(group.subtotal + merchShipping)}
          </button>
          <p className="cs2-label" style={{ margin: 0 }}>Printed to order and shipped to you. Free shipping over {money(SHIPPING.freeOverCents / 100)}.</p>
          <button className="cs2-link" onClick={() => group.items.forEach((l) => remove(l.key))}>Remove merch from bag</button>
        </div>
      )}

      {!merch && mode === 'bag' && (
        <div className="cs2-actions">
          {cards && (
            <button className="cs2-btn cs2-btn--plum" onClick={payByCard} disabled={busy}>
              {busy ? <Loader2 size={16} className="cs2-spin" /> : <CreditCard size={16} />} Pay {money(total)} by card
            </button>
          )}
          <button className={`cs2-btn ${cards ? 'cs2-btn--ghost' : 'cs2-btn--plum'}`} onClick={() => setMode('request')}>
            <Send size={16} /> {cards ? 'Or request & pay the shop directly' : 'Request this order'}
          </button>
          <button className="cs2-link" onClick={() => group.items.forEach((l) => remove(l.key))}>Remove shop from bag</button>
        </div>
      )}

      {mode === 'request' && (
        <form className="cs2-form" onSubmit={sendRequest}>
          <p className="cs2-label">Your details — {group.shopName} will confirm and share how to pay.</p>
          <input required autoComplete="name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="email" inputMode="email" autoComplete="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="cs2-methods" role="radiogroup" aria-label="Delivery">
            {METHODS.map(([v, label]) => (
              <label key={v} className={form.method === v ? 'is-on' : ''}>
                <input type="radio" name={`m-${group.curatorId}`} value={v} checked={form.method === v} onChange={() => setForm({ ...form, method: v })} />
                {label}
              </label>
            ))}
          </div>
          <textarea rows={2} placeholder="Note for the shop (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <input className="cs2-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.trap} onChange={(e) => setForm({ ...form, trap: e.target.value })} />
          <button className="cs2-btn cs2-btn--plum" disabled={busy}>{busy ? 'Sending…' : `Send order request · ${money(total)}`}</button>
          <button type="button" className="cs2-link" onClick={() => setMode('bag')}>Back</button>
        </form>
      )}
    </section>
  );
};

const CartSheet = () => {
  const { open, closeCart, groups, count } = useCart();
  const [shops, setShops] = useState({});
  const [sent, setSent] = useState([]);
  const close = () => { setSent([]); closeCart(); };
  const ids = groups.map((g) => g.curatorId).filter((id) => !isMerch(id)).join(',');

  useEffect(() => {
    if (!open || !ids) return;
    supabase.from('curator_data')
      .select('id, business_name, slug, logo_url, stripe_charges_enabled, cashapp_tag, venmo_handle, stripe_link, other_payment_link, other_payment_label')
      .in('id', ids.split(','))
      .then(({ data }) => setShops(Object.fromEntries((data || []).map((s) => [s.id, s]))));
  }, [open, ids]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div className="cs2" role="dialog" aria-modal="true" aria-label="Your bag" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="cs2__panel">
        <div className="cs2__grip" aria-hidden="true" />
        <header className="cs2__head">
          <h2><ShoppingBag size={20} /> Your bag {count > 0 && <span>{count}</span>}</h2>
          <button className="cs2__close" onClick={close} aria-label="Close bag"><X size={18} /></button>
        </header>

        {sent.map((r) => <SentNote key={`${r.curatorId}-${r.ref}`} receipt={r} />)}
        {groups.length === 0 ? (
          <div className="cs2-empty">
            {!sent.length && <><ShoppingBag size={30} /><p>Your bag is empty.</p></>}
            <Link to="/shop" className="cs2-btn cs2-btn--plum" onClick={close}>{sent.length ? 'Keep shopping' : 'Browse the marketplace'}</Link>
          </div>
        ) : (
          groups.map((g) => <ShopGroup key={g.curatorId} group={g} shop={isMerch(g.curatorId) ? MERCH_SHOP : shops[g.curatorId]} onSent={(r) => setSent((x) => [...x, r])} />)
        )}
      </div>
    </div>
  );
};

export default CartSheet;
