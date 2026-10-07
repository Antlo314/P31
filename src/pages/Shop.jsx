import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Heart, ShoppingBag, SlidersHorizontal, Store, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useFavorites } from '../lib/favorites';
import PageHeader from '../components/PageHeader';
import { openJoin } from '../lib/join';
import './Shop.css';

const money = (n) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;
const SORTS = [
  ['new', 'Newest'],
  ['low', 'Price: low to high'],
  ['high', 'Price: high to low'],
];

// Every product from every approved, published shop — searchable in one place.
const Shop = ({ favoritesOnly = false }) => {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [shops, setShops] = useState({});
  const [loaded, setLoaded] = useState(false);
  const fav = useFavorites();

  const q = params.get('q') || '';
  const cat = params.get('c') || 'All';
  const sort = params.get('s') || 'new';
  const inStock = params.get('stock') === '1';

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (!v || v === 'All' || v === 'new') next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    (async () => {
      const { data: cur } = await supabase
        .from('curator_data')
        .select('id, slug, business_name, logo_url')
        .eq('status', 'approved')
        .eq('is_published', true);
      const map = Object.fromEntries((cur || []).map((c) => [c.id, c]));
      setShops(map);
      const ids = Object.keys(map);
      if (ids.length) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, curator_id, name, description, price, compare_at_price, image_url, category, tags, stock_status, inventory, is_active, created_at')
          .in('curator_id', ids)
          .order('created_at', { ascending: false })
          .limit(1000);
        setProducts((prods || []).filter((p) => p.is_active !== false));
      }
      setLoaded(true);
    })();
  }, []);

  const categories = useMemo(() => ['All', ...[...new Set(products.map((p) => p.category || 'Collection'))].sort()], [products]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = favoritesOnly ? products.filter((p) => fav.has(p.id)) : products;
    if (cat !== 'All') list = list.filter((p) => (p.category || 'Collection') === cat);
    if (inStock) list = list.filter((p) => p.inventory !== 0 && p.stock_status !== 'out_of_stock');
    if (needle) {
      list = list.filter((p) => [p.name, p.description, p.category, shops[p.curator_id]?.business_name, ...(p.tags || [])]
        .some((f) => f?.toLowerCase().includes(needle)));
    }
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, shops, q, cat, sort, inStock, favoritesOnly, fav]);

  return (
    <div className="shp">
      <PageHeader
        eyebrow={favoritesOnly ? 'Saved for later' : 'The Marketplace'}
        title={favoritesOnly ? 'Your' : 'Shop the'}
        accent={favoritesOnly ? 'favorites' : 'collective'}
        lead={favoritesOnly ? 'Pieces you’ve hearted, from every shop.' : 'Every piece from every P31 curator — handmade, hand-selected, in one place.'}
      >
        <div className="shp__bar">
          <label className="k-search">
            <Search size={18} />
            <input type="search" value={q} onChange={(e) => setParam('q', e.target.value)} placeholder="Search candles, jewelry, skincare…" aria-label="Search products" />
            {q && <button onClick={() => setParam('q', '')} aria-label="Clear search"><X size={16} /></button>}
          </label>
          {!favoritesOnly && (
            <Link to="/favorites" className="shp__favlink" aria-label={`Favorites (${fav.count})`}>
              <Heart size={18} /> {fav.count > 0 && <span>{fav.count}</span>}
            </Link>
          )}
        </div>
      </PageHeader>

      <section className="shp__body">
        <div className="shp__filters">
          <div className="shp__cats" role="tablist" aria-label="Categories">
            {categories.map((c) => (
              <button key={c} role="tab" aria-selected={cat === c} onClick={() => setParam('c', c)}>{c}</button>
            ))}
          </div>
          <div className="shp__tools">
            <label className="shp__sort">
              <SlidersHorizontal size={15} />
              <select value={sort} onChange={(e) => setParam('s', e.target.value)} aria-label="Sort">
                {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="shp__toggle">
              <input type="checkbox" checked={inStock} onChange={(e) => setParam('stock', e.target.checked ? '1' : '')} /> In stock
            </label>
          </div>
        </div>

        {loaded && <p className="shp__count">{shown.length} {shown.length === 1 ? 'piece' : 'pieces'}</p>}

        <div className="shp__grid" data-reveal-group>
          {shown.map((p) => {
            const shop = shops[p.curator_id];
            const sold = p.inventory === 0 || p.stock_status === 'out_of_stock';
            const sale = Number(p.compare_at_price) > Number(p.price);
            return (
              <article className="shp-card" key={p.id}>
                <Link to={`/${shop?.slug || p.curator_id}?p=${p.id}`} className="shp-card__img" aria-label={`${p.name} at ${shop?.business_name || 'shop'}`}>
                  {p.image_url ? <img src={p.image_url} alt="" loading="lazy" decoding="async" /> : <ShoppingBag size={26} />}
                  {sold ? <span className="shp-tag is-dark">Sold out</span> : sale ? <span className="shp-tag is-accent">Sale</span> : null}
                </Link>
                <button className={`shp-heart ${fav.has(p.id) ? 'is-on' : ''}`} onClick={() => fav.toggle(p, shop)} aria-label={fav.has(p.id) ? 'Remove from favorites' : 'Save to favorites'}>
                  <Heart size={17} />
                </button>
                <div className="shp-card__info">
                  <Link to={`/${shop?.slug || p.curator_id}`} className="shp-card__shop"><Store size={12} /> {shop?.business_name}</Link>
                  <h3>{p.name}</h3>
                  <p className="shp-price"><strong>{money(p.price)}</strong>{sale && <s>{money(p.compare_at_price)}</s>}</p>
                </div>
              </article>
            );
          })}
          {!loaded && Array.from({ length: 6 }, (_, i) => <div className="shp-card shp-card--skel k-skel" key={i} aria-hidden="true" />)}
        </div>

        {loaded && shown.length === 0 && (
          <div className="k-empty" data-reveal>
            <span className="k-icon">{favoritesOnly ? <Heart size={26} /> : <ShoppingBag size={26} />}</span>
            <h2>{favoritesOnly ? 'No favorites yet' : products.length ? 'Nothing matches that' : 'The marketplace is opening soon'}</h2>
            <p>{favoritesOnly ? 'Tap the heart on any piece to save it here.' : products.length ? 'Try another word or category.' : 'Curators are stocking their shelves — check back shortly.'}</p>
            <div className="k-actions" style={{ justifyContent: 'center' }}>
              <Link to={favoritesOnly ? '/shop' : '/directory'} className="k-btn k-btn--plum">{favoritesOnly ? 'Browse the marketplace' : 'Meet the curators'}</Link>
              {!favoritesOnly && !products.length && <button type="button" className="k-btn k-btn--ghost" onClick={openJoin}>Notify me at launch</button>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Shop;
