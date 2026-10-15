import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingBag, X, Check, Minus, Plus, Truck, Sparkles, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import PageHeader from '../components/PageHeader';
import MerchMock from './merch/MerchMock';
import {
  ITEMS, TYPES, GROUPS, DESIGNS, SHIPPING, colorHex, itemName, priceFor, fromPrice, money,
} from '../../supabase/functions/_shared/merch-catalog.js';
import { MERCH_SHOP } from './merch/shop';
import './Merch.css';

// p31market.com/merch: P31 designs printed and shipped by Printful.
const Merch = () => {
  const cart = useCart();
  const [params, setParams] = useSearchParams();
  const [photos, setPhotos] = useState({});
  const [open, setOpen] = useState(null); // { item, color, size, qty, added }
  const group = params.get('c') || 'All';
  const status = params.get('status');
  const ref = params.get('order');

  useEffect(() => {
    supabase.from('merch_mockups').select('item, color, url').then(({ data }) => {
      setPhotos(Object.fromEntries((data || []).map((r) => [`${r.item}|${r.color}`, r.url])));
    });
  }, []);

  // A paid order: the bag's merch lines are done.
  useEffect(() => { if (status === 'success') cart.clearShop(MERCH_SHOP.id); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const shown = useMemo(() => (group === 'All' ? ITEMS : ITEMS.filter((i) => TYPES[i.type].group === group)), [group]);
  const photo = (item, color) => photos[`${item.id}|${color}`];
  const picture = (item, color, cls) => (photo(item, color)
    ? <img className={cls} src={photo(item, color)} alt={`${itemName(item)} in ${color}`} loading="lazy" decoding="async" />
    : <MerchMock className={cls} item={item} color={color} />);

  const openItem = (item, color = item.colors[0]) => setOpen({ item, color, size: TYPES[item.type].sizes.length === 1 ? TYPES[item.type].sizes[0] : '', qty: 1, added: false, error: '' });
  const addToBag = () => {
    const { item, color, size, qty } = open;
    if (!size) return setOpen({ ...open, error: 'Choose a size.' });
    cart.add({ id: `merch:${item.id}`, name: itemName(item), price: priceFor(item, size) / 100, image_url: photo(item, color) || null, inventory: 20 }, MERCH_SHOP, qty, { Color: color, Size: size });
    setOpen({ ...open, added: true, error: '' });
  };
  const setParam = (k, v) => { const next = new URLSearchParams(params); if (v && v !== 'All') next.set(k, v); else next.delete(k); setParams(next, { replace: true }); };
  const dismiss = () => { const next = new URLSearchParams(params); next.delete('status'); next.delete('order'); setParams(next, { replace: true }); };

  return (
    <div className="k-page mer">
      <PageHeader eyebrow="P31 Merch" title="Wear the" accent="word"
        lead="Proverbs 31 on cotton, ceramic and canvas. Every piece is printed for you when you order, in designs made for women who build." />

      {status && (
        <div className={`mer-toast ${status === 'success' ? 'is-ok' : ''}`} role="status">
          {status === 'success' ? <Check size={18} /> : <ShieldAlert size={18} />}
          <span>{status === 'success' ? `Thank you! Order #${ref || ''} is in. Your receipt is in your email, and tracking follows when it ships.` : 'Checkout was cancelled. Your card was not charged, and your bag is just as you left it.'}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      <section className="mer__body">
        <div className="mer__cats" role="tablist" aria-label="Product types">
          {['All', ...GROUPS].map((g) => (
            <button key={g} role="tab" aria-selected={group === g} onClick={() => setParam('c', g)}>{g}</button>
          ))}
        </div>
        <p className="mer__note"><Truck size={15} /> Shipping {money(SHIPPING.cents)} per order, free over {money(SHIPPING.freeOverCents)}. Printed to order in 2 to 7 business days.</p>

        <div className="mer__grid">
          {shown.map((item) => (
            <article className="mer-card" key={item.id}>
              <button type="button" className="mer-card__img" onClick={() => openItem(item)} aria-label={`${itemName(item)}, from ${money(fromPrice(item))}`}>
                {picture(item, item.colors[0], 'mer-pic')}
              </button>
              <div className="mer-card__info">
                <p className="mer-card__type">{TYPES[item.type].label}</p>
                <h3><button type="button" className="mer-card__name" onClick={() => openItem(item)}>{DESIGNS[item.design].name}</button></h3>
                <p className="mer-card__price">{money(fromPrice(item))}</p>
                {item.colors.length > 1 && (
                  <div className="mer-swatches" aria-label="Colors">
                    {item.colors.map((c) => <button type="button" key={c} title={c} style={{ background: colorHex(c) }} onClick={() => openItem(item, c)} aria-label={c} />)}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <aside className="mer__about">
          <Sparkles size={20} />
          <div>
            <h2>Every piece carries a word</h2>
            <p>The designs come from Proverbs 31 and from the women of the P31 Collective. Each one is printed when you order, so nothing sits in a warehouse, and every purchase supports the Proverbs 31 Marketplace and the women it serves.</p>
          </div>
        </aside>
      </section>

      {open && (() => {
        const { item, color, size, qty, added, error } = open;
        const t = TYPES[item.type];
        const d = DESIGNS[item.design];
        const price = priceFor(item, size || t.sizes[0]);
        return (
          <div className="mer-sheet" role="dialog" aria-modal="true" aria-label={itemName(item)} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
            <div className="mer-sheet__panel">
              <button type="button" className="mer-sheet__close" onClick={() => setOpen(null)} aria-label="Close"><X size={18} /></button>
              <div className="mer-sheet__pic">{picture(item, color, 'mer-pic')}</div>
              <div className="mer-sheet__body">
                <p className="mer-card__type">{t.name}</p>
                <h2>{d.name}</h2>
                <p className="mer-sheet__price">{money(price)}</p>
                <blockquote>{d.line} <cite>{d.verse}</cite></blockquote>

                {item.colors.length > 1 && (
                  <div className="mer-opt">
                    <p className="mer-opt__label">Color: {color}</p>
                    <div className="mer-opt__swatches" role="radiogroup" aria-label="Color">
                      {item.colors.map((c) => <button type="button" key={c} role="radio" aria-checked={c === color} title={c} style={{ background: colorHex(c) }} onClick={() => setOpen({ ...open, color: c, added: false })} />)}
                    </div>
                  </div>
                )}
                {t.sizes.length > 1 && (
                  <div className="mer-opt">
                    <p className="mer-opt__label">Size{size ? `: ${size}` : ''}</p>
                    <div className="mer-opt__sizes" role="radiogroup" aria-label="Size">
                      {t.sizes.map((s) => <button type="button" key={s} role="radio" aria-checked={s === size} onClick={() => setOpen({ ...open, size: s, added: false, error: '' })}>{s}{t.upcharge[s] ? <small>+{money(t.upcharge[s])}</small> : null}</button>)}
                    </div>
                  </div>
                )}
                <div className="mer-opt mer-qty">
                  <p className="mer-opt__label">Quantity</p>
                  <div>
                    <button type="button" onClick={() => setOpen({ ...open, qty: Math.max(1, qty - 1), added: false })} aria-label="One fewer"><Minus size={15} /></button>
                    <span>{qty}</span>
                    <button type="button" onClick={() => setOpen({ ...open, qty: Math.min(20, qty + 1), added: false })} aria-label="One more"><Plus size={15} /></button>
                  </div>
                </div>
                <p className="mer-sheet__blurb">{t.blurb} {SHIPPING.note}</p>
                {error && <p className="mer-error">{error}</p>}
              </div>
              <div className="mer-sheet__bar">
                {added
                  ? <button type="button" className="k-btn k-btn--gold k-btn--block" onClick={() => { setOpen(null); cart.openCart(); }}><Check size={18} /> Added: view bag ({cart.count})</button>
                  : <button type="button" className="k-btn k-btn--gold k-btn--block" onClick={addToBag}><ShoppingBag size={18} /> Add to bag · {money(price * qty)}</button>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Merch;
