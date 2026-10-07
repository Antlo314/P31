import { useCallback, useEffect, useState } from 'react';

// Saved products ("hearts"), kept in this browser — no account needed.
const KEY = 'p31_favorites_v1';
const EVT = 'p31:favorites';

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};

export const useFavorites = () => {
  const [list, setList] = useState(read);

  useEffect(() => {
    const sync = () => setList(read());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const save = (next) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
    setList(next);
    window.dispatchEvent(new Event(EVT));
  };

  const has = useCallback((id) => list.some((f) => f.id === id), [list]);

  const toggle = (product, shop) => {
    if (has(product.id)) return save(list.filter((f) => f.id !== product.id));
    save([{
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image_url || null,
      shopName: shop?.business_name || product.shopName || '',
      shopSlug: shop ? (shop.slug || shop.id) : product.shopSlug || '',
      savedAt: Date.now(),
    }, ...list].slice(0, 200));
  };

  return { list, has, toggle, count: list.length };
};
