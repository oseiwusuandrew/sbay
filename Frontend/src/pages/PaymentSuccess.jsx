import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Home, LayoutDashboard, Receipt, Shield, MessageCircle, Loader } from 'lucide-react';
import { paymentApi } from '../api/client';
import { adaptOrder } from '../api/adapters';
import { useOrders } from '../store/OrdersContext';
import { useCart } from '../store/CartContext';
import { Notice } from '../components/Feedback';
import './pages.css';
import './PaymentSuccess.css';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const { addOrder, reload } = useOrders();
  const { clear } = useCart();

  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const [verifying, setVerifying] = useState(!!reference);
  const [orders, setOrders] = useState(
    Array.isArray(state?.orders) ? state.orders : []
  );
  const [total, setTotal] = useState(
    state?.total ?? (state?.orders || []).reduce((s, o) => s + (o.total || 0), 0)
  );
  const [verifyError, setVerifyError] = useState('');
  const verified = useRef(false);

  useEffect(() => {
    if (!reference || verified.current) return;
    verified.current = true;

    verifyWithPolling(reference)
      .catch(handleVerifyError);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  async function verifyWithPolling(ref, attempt = 1) {
    const data = await paymentApi.verify(ref);
    if (data.pending && attempt < 5) {
      setTimeout(() => {
        verifyWithPolling(ref, attempt + 1).catch(handleVerifyError);
      }, 2500);
      return;
    }
    handleVerifySuccess(data);
  }

  function handleVerifySuccess(data) {
    const rawOrders = data.orders || [];
    const adapted = rawOrders.map((o) => adaptOrder(o));
    if (adapted.length === 0) {
      setVerifying(false);
      setVerifyError('Payment is still being confirmed. Your cart has been kept so you can retry safely.');
      return;
    }
    adapted.forEach((o) => addOrder(o));
    reload?.();
    clear();
    setOrders(adapted);
    setTotal(adapted.reduce((s, o) => s + (o.total || 0), 0));
    setVerifying(false);
  }

  function handleVerifyError(e) {
    // A timeout / network drop / 5xx says nothing about whether the
    // buyer was charged — don't tell them it failed. Offer a retry and
    // keep the cart; the Paystack webhook may complete the order anyway.
    if (!e?.status || e.status >= 500) {
      verified.current = false;
      setVerifying(false);
      setVerifyError("We couldn't confirm your payment yet. If you were charged, your order will appear under My Orders shortly.");
      return;
    }
    if (e.status === 409) {
      // Charged but couldn't be fulfilled (e.g. sold out mid-payment) —
      // the API has flagged it for a full refund. Clear the stale cart.
      clear();
    }
    navigate(`/payment-failed?reason=${encodeURIComponent(e.message || 'Payment verification failed')}`, { replace: true });
  }

  const retryVerify = () => {
    if (!reference) return;
    setVerifyError('');
    setVerifying(true);
    verified.current = true;
    verifyWithPolling(reference).catch(handleVerifyError);
  };

  useEffect(() => {
    if (!reference && !state) navigate('/home', { replace: true });
  }, [reference, state, navigate]);

  if (verifying) {
    return (
      <div className="ps-page kente-bg">
        <motion.div
          className="ps-card"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div className="ps-check" style={{ background: '#0a7e3e' }}>
            <Loader size={36} color="#fff" className="spin" />
          </div>
          <h2>Confirming your payment…</h2>
          <p className="muted">Please wait while we verify your payment with Paystack.</p>
        </motion.div>
      </div>
    );
  }

  const location = state?.location || '';
  const payment = state?.payment;

  if (orders.length === 0 && verifyError) {
    return (
      <div className="ps-page kente-bg">
        <div className="ps-card">
          <div className="ps-check ps-check--wait"><Loader size={34} color="#fff" /></div>
          <h2>Still confirming…</h2>
          <p className="muted">{verifyError}</p>
          <div className="ps-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/profile/orders')}>
              <Receipt size={16} /> My orders
            </button>
            <button className="btn btn-primary" onClick={retryVerify}>
              Check again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ps-page kente-bg">
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.span
          key={i}
          className="confetti"
          style={{
            left: `${(i * 5.5) % 100}%`,
            background: ['#0A7E3E', '#F5A623', '#D32F2F'][i % 3],
          }}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 600, opacity: [0, 1, 1, 0], rotate: 360 }}
          transition={{ duration: 2.5, delay: i * 0.06, ease: 'easeIn' }}
        />
      ))}

      <motion.div
        className="ps-card"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        <motion.div
          className="ps-check"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.2 }}
        >
          <Check size={42} color="#fff" />
        </motion.div>
        <h2>Payment received and held in escrow</h2>
        <p className="muted">
          <Shield size={14} style={{ verticalAlign: 'text-bottom' }} />{' '}
          GH₵ {total.toLocaleString()} is held safely. Funds release to the seller
          only after you confirm receipt from your profile.
        </p>

        {orders.length > 0 && (
          <div className="ps-receipts">
            {orders.map((o) => (
              <div key={o._id || o.id} className="ps-receipt">
                <header>
                  <div>
                    <h4><Receipt size={14} /> Invoice {o.invoiceNumber || o.id}</h4>
                    <p className="muted small">Sold by {o.sellerName}</p>
                  </div>
                  <strong>GH₵ {(o.total || 0).toLocaleString()}</strong>
                </header>
                <ul>
                  {(o.items || []).map((it, i) => (
                    <li key={i}>
                      <span>{it.title} × {it.qty}</span>
                      <span>GH₵ {(it.price * it.qty).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
                <div className="ps-receipt-meta">
                  <span>Subtotal GH₵ {(o.subtotal || 0).toLocaleString()}</span>
                  <span>Service fee ({o.feePct ?? 5}%) GH₵ {(o.fee || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {(location || payment) && (
              <div className="ps-receipt-foot muted small">
                {location && <span>Deliver to: {location}</span>}
                {payment && <span>Paid with {payment.brand} ending {payment.last4}</span>}
              </div>
            )}
          </div>
        )}

        {verifyError && (
          <Notice tone="error" style={{ marginTop: 12 }}>{verifyError}</Notice>
        )}

        <div className="ps-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/home')}>
            <Home size={16} /> Home
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/chats')}>
            <MessageCircle size={16} /> Chat seller
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/profile')}>
            <LayoutDashboard size={16} /> Track order
          </button>
        </div>
      </motion.div>
    </div>
  );
}
