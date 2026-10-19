import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, MapPin, Check, Lock, Edit3, ChevronDown, ChevronUp,
  AlertTriangle, Loader, CreditCard,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { paymentApi } from '../api/client';
import RegionSelector from '../components/RegionSelector';
import { ghs } from '../utils/money';
import './pages.css';
import './Checkout.css';

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal } = useCart();
  const { user, updateUser } = useAuth();

  // Start from the buyer's saved location so returning buyers can pay in one tap.
  const savedLocation = user?.location?.includes(',') ? user.location : '';
  const [location, setLocation] = useState(savedLocation);
  const [editingLoc, setEditingLoc] = useState(!savedLocation);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // The server prices the cart exactly as it will charge it — fees can
  // differ per seller plan, so a client-side estimate would drift.
  const [quote, setQuote] = useState(null);
  const [quoteErr, setQuoteErr] = useState('');
  const cartKey = items.map((it) => `${it._id || it.id}:${it.qty}`).join(',');
  useEffect(() => {
    if (!items.length) return;
    let alive = true;
    paymentApi.quote(items.map((it) => ({ productId: it._id || it.id, qty: it.qty })))
      .then((q) => { if (alive) { setQuote(q); setQuoteErr(''); } })
      .catch((e) => { if (alive) setQuoteErr(e.message || 'Could not price your cart.'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  const fee = quote?.fee ?? null;
  const total = quote?.total ?? subtotal;
  const feePcts = [...new Set((quote?.groups || []).map((g) => g.feePct))];
  const feeLabel = feePcts.length === 1 ? `Service fee (${feePcts[0]}%)` : 'Service fee';

  const saveLocation = () => {
    const v = location.trim();
    if (!v || !v.includes(',')) { setError('Please choose a region and enter your city.'); return false; }
    setError('');
    updateUser?.({ location: v }).catch(() => {});
    setEditingLoc(false);
    return true;
  };

  const handlePay = async () => {
    if (editingLoc && !saveLocation()) return;
    if (!location.trim()) {
      setError('Please set a delivery / pickup location first.');
      setEditingLoc(true);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { authorization_url } = await paymentApi.initialize({
        items: items.map((it) => ({ productId: it._id || it.id, qty: it.qty })),
        deliveryLocation: location.trim(),
      });

      window.location.href = authorization_url;
    } catch (e) {
      setError(e.message || 'Could not start payment. Please try again.');
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="page">
        <TopBar showBack title="Checkout" showSearch={false} />
        <main className="page-main">
          <div className="empty">
            <h3>Your cart is empty</h3>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>Browse</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page checkout-page">
      <TopBar showBack title="Checkout" showSearch={false} />

      <main className="page-main">
        <div className="co-details-col">
          <section className="card">
            <h3 className="page-h2">Your items</h3>
            <div className="co-items">
              {items.map((it) => (
                <div key={it.id} className="co-item">
                  <div className="thumb" style={{ backgroundImage: `url(${it.image})` }} />
                  <div style={{ flex: 1 }}>
                    <h4>{it.title}</h4>
                    <p className="muted small">Qty {it.qty}</p>
                  </div>
                  <span className="price">{ghs(it.qty * it.price)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card co-location">
            <div className="co-loc-head">
              <h3 className="page-h2"><MapPin size={16} /> Delivery or pickup location</h3>
              {!editingLoc && location && (
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingLoc(true)}>
                  <Edit3 size={14} /> Change
                </button>
              )}
            </div>
            {editingLoc ? (
              <div className="co-loc-edit">
                <p className="muted small">
                  Select your region first, then enter your city or town.
                </p>
                <RegionSelector
                  value={location}
                  onChange={setLocation}
                  label="Pickup location"
                  required
                />
                <button className="btn btn-primary btn-sm" onClick={saveLocation}>
                  <Check size={14} /> Save location
                </button>
              </div>
            ) : (
              <p className="co-loc-value"><MapPin size={14} /> {location}</p>
            )}
          </section>

          <section className="co-note-card co-escrow-card">
            <div className="co-escrow-head">
              <span className="m-icon"><Lock size={22} /></span>
              <div>
                <h4>Escrow protection</h4>
                <p className="muted small">Funds stay held until you confirm delivery.</p>
              </div>
            </div>
            <p className="co-escrow-copy">You pay now. sBay holds the money until you confirm you received the item.</p>
          </section>

          <section className="co-note-card co-paystack-card">
            <div className="co-escrow-head">
              <span className="m-icon" style={{ background: '#0a7e3e' }}><CreditCard size={22} /></span>
              <div>
                <h4>Pay with Paystack</h4>
                <p className="muted small">Card, Mobile Money and bank transfer supported.</p>
              </div>
            </div>
          </section>
        </div>
        <section className="card co-totals co-summary-col">
          <div className="row"><span>Subtotal</span><strong>{ghs(quote?.subtotal ?? subtotal)}</strong></div>
          <div className="row">
            <span>{feeLabel}</span>
            <strong>{fee === null ? (quoteErr ? '—' : 'Calculating…') : ghs(fee)}</strong>
          </div>
          <div className="divider" />
          <div className="row total"><span>Total</span><strong>{quote ? ghs(total) : '—'}</strong></div>
          {quoteErr && (
            <div className="co-error" role="alert">
              <AlertTriangle size={16} /> {quoteErr}{' '}
              <button type="button" className="link-btn" onClick={() => navigate('/cart')}>Review cart</button>
            </div>
          )}

          <button type="button" className="co-review-toggle" onClick={() => setReviewOpen((v) => !v)}>
            {reviewOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Review order & shipping location before paying
          </button>

          {reviewOpen && (
            <div className="co-review">
              <h4>Your items</h4>
              <ul className="co-review-list">
                {items.map((it) => (
                  <li key={it.id}>
                    <span>{it.title} × {it.qty}</span>
                    <strong>{ghs(it.qty * it.price)}</strong>
                  </li>
                ))}
              </ul>
              <div className="co-review-loc">
                <div>
                  <p className="muted small">Shipping to</p>
                  <p><MapPin size={14} /> {location || 'Not set yet'}</p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingLoc(true)}>
                  <Edit3 size={14} /> Change location
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="co-error" role="alert">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <motion.button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 14 }}
            onClick={handlePay}
            disabled={submitting || !quote}
            whileTap={{ scale: 0.97 }}
          >
            {submitting
              ? <><Loader size={16} className="spin" /> Redirecting to Paystack…</>
              : <><Shield size={16} /> {quote ? `Pay ${ghs(total)} securely` : 'Pricing your cart…'}</>}
          </motion.button>
          <p className="muted small" style={{ textAlign: 'center', marginTop: 8 }}>
            Secured by Paystack · Funds held in escrow by sBay
          </p>
        </section>
      </main>
    </div>
  );
}
