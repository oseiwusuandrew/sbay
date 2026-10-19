import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Crown, X, ArrowLeft as Back } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../store/AuthContext';
import { useConfirm } from '../store/ConfirmContext';
import { sbay, api } from '../api/client';
import './pages.css';
import './Auth.css';
import './ProductDetail.css';
import './Sell.css';
import './SellerSubscription.css';

const FALLBACK_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    tag: 'Get started',
    features: [
      'Up to 5 active listings',
      'Basic in-app chat with buyers',
      'Standard placement in search',
      'Community support',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    price: 29,
    tag: 'Most popular',
    features: [
      'Up to 50 active listings',
      'Verified seller badge after KYC',
      'Boost 3 listings per month',
      'Priority placement in your campus',
      'Email support',
    ],
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    tag: 'For power sellers',
    features: [
      'Unlimited listings',
      'Featured store on home page',
      'Boost 15 listings per month',
      'Sales analytics & buyer insights',
      'Priority support (24h response)',
      'Custom store URL',
    ],
  },
];

const PAYMENT_METHODS = [
  { id: 'momo',  label: 'MTN MoMo' },
  { id: 'card',  label: 'Visa / Mastercard' },
  { id: 'bank',  label: 'Bank transfer' },
];

export default function SellerSubscription() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const currentPlan = user?.subscription?.plan || 'free';
  const status = currentPlan === 'free' ? 'free' : (user?.subscription?.status || 'active');

  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [method, setMethod] = useState('momo');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Plans are admin-managed; fall back to the canonical list only
    // if the API is unreachable so the page is never empty.
    sbay.getPlans().then((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return;
      setPlans(rows.map((p) => ({
        id: p.code,
        name: p.name,
        price: p.price,
        tag: p.tag || (p.feePct ? `${p.feePct}% per sale` : ''),
        features: p.features || [],
        highlight: !!p.highlight,
      })));
    }).catch(() => { /* keep fallback */ });
  }, []);

  const choosePlan = (planId) => {
    if (planId === currentPlan) return;
    if (planId === 'free') {
      onCancel();
      return;
    }
    setPendingPlan(planId);
    setErr('');
  };

  const closeCheckout = () => { setPendingPlan(null); setBusy(false); setErr(''); };

  /**
   * Paid plans are activated by the sBay team for now (there is no
   * recurring-billing integration yet). Instead of a fake "Pay" button
   * that changed nothing server-side, we file the request in the admin
   * support inbox, and the team follows up with payment details.
   */
  const requestPlan = async (planId, note) => {
    const plan = plans.find((p) => p.id === planId);
    await api.post('/support/tickets', {
      name: user?.name,
      email: user?.email,
      phone: user?.phone || user?.payout?.account || 'n/a',
      message: `[Plan request] ${user?.sellerProfile?.storeName || user?.name} wants the ${plan?.name || planId} plan `
        + `(GH₵ ${Number(plan?.price || 0).toLocaleString()}/month). Preferred payment: ${PAYMENT_METHODS.find((m) => m.id === method)?.label || method}.`
        + (note ? ` ${note}` : ''),
    });
  };

  const confirmSubscribe = async () => {
    setErr(''); setBusy(true);
    try {
      await requestPlan(pendingPlan);
      setDone(true);
      setTimeout(() => { setDone(false); setPendingPlan(null); }, 2200);
    } catch (e) { setErr(e.message || 'Could not send your request.'); }
    finally { setBusy(false); }
  };

  const onCancel = async () => {
    const ok = await confirm({
      title: 'Move to the Free plan?',
      body: 'We will ask the sBay team to switch you to Free at the end of your current billing period.',
      confirmLabel: 'Request downgrade',
      danger: true,
    });
    if (!ok) return;
    try {
      await requestPlan('free', 'Please downgrade at the end of the current period.');
      setDone(true);
      setTimeout(() => setDone(false), 2200);
    } catch (e) { setErr(e.message || 'Could not send your request.'); }
  };

  const renewsAt = user?.subscription?.renewsAt || user?.subscription?.renewsOn;
  const renewsOn = renewsAt ? new Date(renewsAt).toLocaleDateString() : null;

  const pendingDetails = plans.find((p) => p.id === pendingPlan);

  return (
    <div className="page">
      <TopBar showBack showSearch={false} title="Subscription" />

      <main className="page-main">
        <section className="sub-summary">
          <div className="sub-summary-ic"><Crown size={20} /></div>
          <div style={{ flex: 1 }}>
            <strong>
              You're on the {plans.find((p) => p.id === currentPlan)?.name || 'Free'} plan
            </strong>
            <p className="muted small">
              {status === 'active' && (renewsOn ? `Renews on ${renewsOn}.` : 'Your plan is active.')}
              {status === 'canceled' && (renewsOn ? `Ends on ${renewsOn}. You will move to Free.` : 'Your plan has been canceled.')}
              {status === 'free' && 'Upgrade any time to unlock more listings, boosts and analytics.'}
            </p>
          </div>
        </section>

        <section className="plans-grid">
          {plans.map((p) => {
            const isCurrent = p.id === currentPlan;
            return (
              <article key={p.id} className={`plan-card ${p.highlight ? 'highlight' : ''} ${isCurrent ? 'current' : ''}`}>
                {p.highlight && <span className="plan-tag">Most popular</span>}
                <h3>{p.name}</h3>
                <div className="plan-price">
                  <span className="cur">GH₵</span>
                  <strong>{p.price.toLocaleString()}</strong>
                  <span className="per">{p.price === 0 ? 'forever' : '/month'}</span>
                </div>
                <p className="muted small">{p.tag}</p>
                <ul className="plan-features">
                  {p.features.map((f) => (
                    <li key={f}><Check size={14} color="#0A7E3E" /> {f}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <button className="btn btn-ghost" disabled>Current plan</button>
                ) : p.id === 'free' ? (
                  <button className="btn btn-ghost" onClick={() => choosePlan(p.id)}>Downgrade to Free</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => choosePlan(p.id)}>
                    {currentPlan === 'free' ? 'Subscribe' : (currentPlan === 'pro' ? 'Switch plan' : 'Upgrade')}
                  </button>
                )}
              </article>
            );
          })}
        </section>

        {status === 'active' && currentPlan !== 'free' && (
          <button className="btn btn-ghost danger-text" onClick={onCancel}>
            Downgrade to Free
          </button>
        )}
      </main>

      {/* Checkout sheet */}
      <AnimatePresence>
        {pendingPlan && (
          <>
            <motion.div
              className="share-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCheckout}
            />
            <motion.div
              className="share-sheet sub-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <header className="share-head">
                <h3>Upgrade to {pendingDetails?.name}</h3>
                <button onClick={closeCheckout} aria-label="Close"><X size={20} /></button>
              </header>

              <div className="sub-receipt">
                <div className="row"><span>Plan</span><strong>{pendingDetails?.name}</strong></div>
                <div className="row"><span>Billing</span><strong>Monthly</strong></div>
                <div className="row total"><span>Price</span><strong>GH₵ {Number(pendingDetails?.price || 0).toLocaleString()}/month</strong></div>
              </div>
              <p className="muted small" style={{ marginTop: 10 }}>
                You won't be charged now. The sBay team will confirm your upgrade and send payment
                details to {user?.email || 'your email'}. Your plan switches on once payment is received.
              </p>

              <h4 className="page-h2" style={{ marginTop: 16 }}>Preferred payment method</h4>
              <div className="pay-methods">
                {PAYMENT_METHODS.map((m) => (
                  <label key={m.id} className={`pay-method ${method === m.id ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="pay"
                      value={m.id}
                      checked={method === m.id}
                      onChange={() => setMethod(m.id)}
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>

              {err && <div className="auth-error">{err}</div>}

              <div className="sub-actions">
                <button className="btn btn-ghost" onClick={closeCheckout} disabled={busy}>
                  <Back size={16} /> Back
                </button>
                <button className="btn btn-primary" onClick={confirmSubscribe} disabled={busy}>
                  {busy ? 'Sending…' : 'Request upgrade'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {done && (
          <motion.div
            className="success-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="success-card"
              initial={{ scale: 0.6 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            >
              <div className="checkmark"><Check size={36} color="#fff" /></div>
              <h3>Request sent</h3>
              <p className="muted">We'll email you within one business day to finish setting up your plan.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
