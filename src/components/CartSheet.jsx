import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Minus, Plus, Trash2, ShoppingBag, CreditCard, Tag, Store, Loader2, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { invokePayment } from '../lib/payments';
import { useCart } from '../context/CartContext';
import { MERCH_SHOP, isMerch } from '../pages/merch/shop';
import { SHIPPING } from '../../supabase/functions/_shared/merch-catalog.js';
import './CartSheet.css';

const money = (n) => `$${Number(n).toFixed(2)}`;
const optText = (o) => Object.entries(o || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
// One shop's part of the bag: lines, discount, and checkout.
const ShopGroup = ({ group, shop }) => {
  const { setQty, remove } = useCart();
  const [code, setCode] = useState('');
  const [disc, setDisc] = useState(null); // { ok, amount_cents, message, code }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const subtotalCents = Math.round(group.subtotal * 100);
  const discountCents = disc?.ok ? disc.amount_cents : 0;
  const total = (subtotalCents - discountCents) / 100;
  // Shops are paid only through Stripe; a shop that has not finished Stripe sign-up cannot check out yet.
  const cards = !!shop?.stripe_charges_enabled;
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
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code" aria-label="Promo code" />
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

      {!merch && (
        <div className="cs2-actions">
          {cards ? (
            <button className="cs2-btn cs2-btn--plum" onClick={payByCard} disabled={busy}>
              {busy ? <Loader2 size={16} className="cs2-spin" /> : <CreditCard size={16} />} Checkout · {money(total)}
            </button>
          ) : shop && (
            <>
              <p className="cs2-label" style={{ margin: 0 }}>{group.shopName} is finishing its secure checkout. Your bag stays here until it opens.</p>
              {shop.public_email && <a className="cs2-btn cs2-btn--ghost" href={`mailto:${shop.public_email}`}><Mail size={16} /> Ask the shop</a>}
            </>
          )}
          {cards && <p className="cs2-label" style={{ margin: 0 }}>Cards, Apple Pay, Google Pay, Klarna and Afterpay, by Stripe.</p>}
          <button className="cs2-link" onClick={() => group.items.forEach((l) => remove(l.key))}>Remove shop from bag</button>
        </div>
      )}
    </section>
  );
};

const CartSheet = () => {
  const { open, closeCart, groups, count } = useCart();
  const [shops, setShops] = useState({});
  const close = () => closeCart();
  const ids = groups.map((g) => g.curatorId).filter((id) => !isMerch(id)).join(',');

  useEffect(() => {
    if (!open || !ids) return;
    supabase.from('curator_data')
      .select('id, business_name, slug, logo_url, stripe_charges_enabled, public_email')
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

        {groups.length === 0 ? (
          <div className="cs2-empty">
            <ShoppingBag size={30} /><p>Your bag is empty.</p>
            <Link to="/shop" className="cs2-btn cs2-btn--plum" onClick={close}>Browse the marketplace</Link>
          </div>
        ) : (
          groups.map((g) => <ShopGroup key={g.curatorId} group={g} shop={isMerch(g.curatorId) ? MERCH_SHOP : shops[g.curatorId]} />)
        )}
      </div>
    </div>
  );
};

export default CartSheet;
