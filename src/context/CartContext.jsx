import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Shopping bag shared across the whole site. Lives in this browser only
// (localStorage) — no account needed. Each shop checks out separately.
const KEY = 'p31_bag_v1';
const CartContext = createContext(null);

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};

const lineKey = (productId, options = {}) =>
  `${productId}|${Object.keys(options).sort().map((k) => `${k}=${options[k]}`).join('&')}`;

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(load);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode */ }
  }, [items]);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setItems(load()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((product, shop, quantity = 1, options = {}) => {
    const key = lineKey(product.id, options);
    setItems((list) => {
      const found = list.find((l) => l.key === key);
      const max = product.inventory ?? 20;
      if (found) return list.map((l) => (l.key === key ? { ...l, quantity: Math.min(l.quantity + quantity, max) } : l));
      return [...list, {
        key,
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        image: product.image_url || null,
        options,
        quantity: Math.min(quantity, max),
        max,
        curatorId: shop.id,
        shopName: shop.business_name,
        shopSlug: shop.slug || shop.id,
      }];
    });
  }, []);

  const setQty = useCallback((key, quantity) => {
    setItems((list) => (quantity <= 0
      ? list.filter((l) => l.key !== key)
      : list.map((l) => (l.key === key ? { ...l, quantity: Math.min(quantity, l.max || 20) } : l))));
  }, []);

  const remove = useCallback((key) => setItems((list) => list.filter((l) => l.key !== key)), []);
  const clearShop = useCallback((curatorId) => setItems((list) => list.filter((l) => l.curatorId !== curatorId)), []);

  const value = useMemo(() => {
    const groups = [];
    items.forEach((l) => {
      let g = groups.find((x) => x.curatorId === l.curatorId);
      if (!g) { g = { curatorId: l.curatorId, shopName: l.shopName, shopSlug: l.shopSlug, items: [] }; groups.push(g); }
      g.items.push(l);
    });
    groups.forEach((g) => { g.subtotal = g.items.reduce((s, l) => s + l.price * l.quantity, 0); });
    return {
      items, groups, count: items.reduce((s, l) => s + l.quantity, 0),
      add, setQty, remove, clearShop,
      open, openCart: () => setOpen(true), closeCart: () => setOpen(false),
    };
  }, [items, open, add, setQty, remove, clearShop]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext);
