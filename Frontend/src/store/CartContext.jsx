import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { sbay } from '../api/client';

const CartContext = createContext(null);
const CART_KEY = 'sbay.cart';

function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  // How many saved items were dropped because they're no longer for sale.
  const [removedCount, setRemovedCount] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)); }
    catch { /* quota exceeded — ignore */ }
  }, [items]);

  // The cart lives on the device, so a listing can be removed or its seller
  // deleted while it sits here. Drop those once per visit.
  useEffect(() => {
    const saved = loadCart();
    if (!saved.length) return;
    sbay.availableIds(saved.map((i) => i.id)).then((available) => {
      if (!available) return;
      setItems((cur) => {
        const kept = cur.filter((i) => available.has(String(i.id)));
        if (kept.length !== cur.length) setRemovedCount(cur.length - kept.length);
        return kept.length === cur.length ? cur : kept;
      });
    });
  }, []);

  const clamp = (item, qty) => {
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    if (item.stock && Number.isFinite(item.stock)) return Math.min(n, item.stock);
    return n;
  };

  const addItem = (product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: clamp(i, i.qty + qty) } : i
        );
      }
      return [...prev, { ...product, qty: clamp(product, qty) }];
    });
  };

  const updateQty = (id, qty) =>
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, Math.floor(Number(qty) || 0)) } : i))
        .map((i) => (i.stock ? { ...i, qty: Math.min(i.qty, i.stock) } : i))
        .filter((i) => i.qty > 0)
    );

  const removeItem = (id) =>
    setItems((prev) => prev.filter((i) => i.id !== id));

  const clear = () => {
    setItems([]);
    try { localStorage.removeItem(CART_KEY); } catch { /* ignore */ }
  };

  const count    = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.qty * i.price, 0), [items]);

  return (
    <CartContext.Provider value={{
      items, addItem, updateQty, removeItem, clear, count, subtotal,
      removedCount, dismissRemoved: () => setRemovedCount(0),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
};
