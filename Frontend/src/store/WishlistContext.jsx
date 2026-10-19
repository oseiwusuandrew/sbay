import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const WishlistContext = createContext(null);
const KEY = 'sbay.wishlist';

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

/**
 * Saved items ("hearts"). Kept on-device: hearts used to be per-page
 * component state that vanished on navigation, and the Wishlist page
 * was hard-coded empty. We store a small snapshot of each product so the
 * list renders instantly, then the detail page shows live data.
 */
export function WishlistProvider({ children }) {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full/blocked */ }
  }, [items]);

  const has = useCallback((id) => items.some((i) => i.id === id), [items]);

  const toggle = useCallback((p) => {
    setItems((cur) => (cur.some((i) => i.id === p.id)
      ? cur.filter((i) => i.id !== p.id)
      : [{
        id: p.id,
        title: p.title,
        price: p.price,
        discountPrice: p.discountPrice,
        image: p.image,
        school: p.school,
        city: p.city,
        condition: p.condition,
        savedAt: Date.now(),
      }, ...cur]));
  }, []);

  const remove = useCallback((id) => setItems((cur) => cur.filter((i) => i.id !== id)), []);

  const value = useMemo(() => ({ items, has, toggle, remove, count: items.length }), [items, has, toggle, remove]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within <WishlistProvider>');
  return ctx;
};
