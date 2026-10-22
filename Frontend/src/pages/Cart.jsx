import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, ShieldCheck, ArrowRight } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useConfirm } from '../store/ConfirmContext';
import { paymentApi } from '../api/client';
import { ghs } from '../utils/money';
import { Notice } from '../components/Feedback';
import './pages.css';
import './Cart.css';

export default function Cart() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { items, updateQty, removeItem, clear, subtotal, count } = useCart();

  // Signed-in buyers get the exact server quote (fees vary by seller plan);
  // guests see the fee once they sign in at checkout.
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState('');
  const cartKey = items.map((it) => `${it.id}:${it.qty}`).join(',');
  useEffect(() => {
    if (!user || items.length === 0) { setQuote(null); setQuoteErr(''); return; }
    let alive = true;
    paymentApi.quote(items.map((it) => ({ productId: it._id || it.id, qty: it.qty })))
      .then((q) => { if (alive) { setQuote(q); setQuoteErr(''); } })
      .catch((e) => { if (alive) { setQuote(null); setQuoteErr(e.message); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, user?.id]);

  const onClear = async () => {
    const ok = await confirm({
      title: 'Empty your cart?',
      body: `This removes all ${count} item${count === 1 ? '' : 's'} from your cart.`,
      confirmLabel: 'Empty cart',
      danger: true,
    });
    if (ok) clear();
  };

  const onCheckout = () => navigate(user ? '/checkout' : `/login?next=${encodeURIComponent('/checkout')}`);

  return (
    <div className="page cart-page">
      <TopBar showBack title="Cart" showSearch={false} />

      <main className="page-main">
        {items.length === 0 ? (
          <div className="empty">
            <span className="empty-ic"><ShoppingBag size={26} /></span>
            <h3>Your cart is empty</h3>
            <p>Find something you like and it'll wait for you here.</p>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>Start shopping</button>
          </div>
        ) : (
          <>
            <section className="cart-items">
              <div className="cart-head">
                <h2 className="page-h2">{count} item{count === 1 ? '' : 's'}</h2>
                <button className="btn btn-sm btn-danger" onClick={onClear}><Trash2 size={14} /> Empty cart</button>
              </div>
              {quoteErr && <Notice tone="error">{quoteErr}</Notice>}
              <div className="cart-list">
                <AnimatePresence initial={false}>
                  {items.map((it) => (
                    <motion.article
                      key={it.id}
                      className="cart-row"
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                    >
                      <Link to={`/product/${it.id}`} className="cart-thumb" aria-label={it.title}>
                        <img src={it.image} alt="" loading="lazy" />
                      </Link>
                      <div className="cart-info">
                        <Link to={`/product/${it.id}`} className="cart-title">{it.title}</Link>
                        {it.sellerName && <span className="muted small">Sold by {it.sellerName}</span>}
                        <span className="cart-unit muted small">{ghs(it.price)} each</span>
                      </div>
                      <div className="cart-controls">
                        <div className="qty" role="group" aria-label={`Quantity for ${it.title}`}>
                          <button onClick={() => updateQty(it.id, it.qty - 1)} disabled={it.qty <= 1} aria-label="Decrease"><Minus size={14} /></button>
                          <span>{it.qty}</span>
                          <button
                            onClick={() => updateQty(it.id, it.qty + 1)}
                            disabled={!!it.stock && it.qty >= it.stock}
                            aria-label="Increase"
                            title={it.stock && it.qty >= it.stock ? `Only ${it.stock} in stock` : undefined}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <strong className="cart-line">{ghs(it.price * it.qty)}</strong>
                        <button className="cart-remove" onClick={() => removeItem(it.id)} aria-label={`Remove ${it.title}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            </section>

            <aside className="cart-summary card">
              <h2 className="page-h2">Order summary</h2>
              <div className="row"><span>Subtotal ({count} item{count === 1 ? '' : 's'})</span><strong>{ghs(quote?.subtotal ?? subtotal)}</strong></div>
              <div className="row">
                <span>Service fee</span>
                <strong>{quote ? ghs(quote.fee) : <span className="muted small">At checkout</span>}</strong>
              </div>
              <div className="divider" />
              <div className="row total">
                <span>{quote ? 'Total' : 'Estimated total'}</span>
                <strong>{ghs(quote?.total ?? subtotal)}</strong>
              </div>
              <button className="btn btn-primary btn-lg btn-block" onClick={onCheckout} disabled={!!quoteErr}>
                {user ? 'Checkout' : 'Sign in to checkout'} <ArrowRight size={16} />
              </button>
              <p className="cart-escrow">
                <ShieldCheck size={16} aria-hidden />
                Your payment is held in escrow until you confirm you received your items.
              </p>
            </aside>
          </>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
