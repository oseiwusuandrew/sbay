import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Crown, Loader2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { Notice, useToast } from '../components/Feedback';
import { useAuth } from '../store/AuthContext';
import { sbay, paymentApi } from '../api/client';
import { ghs } from '../utils/money';
import './pages.css';
import './SellerSubscription.css';

const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** The plan in force today: a paid plan only counts until its period ends. */
function currentPlanOf(user) {
  const sub = user?.subscription;
  if (!sub?.plan || sub.plan === 'free' || sub.status === 'expired') return { code: 'free' };
  if (!sub.renewsAt || new Date(sub.renewsAt) < new Date()) return { code: 'free', lapsed: sub.plan };
  return { code: sub.plan, until: sub.renewsAt };
}

/**
 * Seller plans. A paid plan is a single Paystack payment that covers 30
 * days; paying again adds another 30. Nothing renews automatically, and
 * when a period ends the seller is back on Free.
 */
export default function SellerSubscription() {
  const [params] = useSearchParams();
  const { user, refreshMe } = useAuth();
  const toast = useToast();

  const [plans, setPlans] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [verifying, setVerifying] = useState(() => Boolean(params.get('sub_ref')));

  useEffect(() => {
    sbay.getPlans()
      .then((rows) => setPlans([...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.price - b.price)))
      .catch((e) => { setLoadErr(e.message || 'Could not load the plans.'); setPlans([]); });
  }, []);

  // Back from Paystack.
  useEffect(() => {
    const ref = params.get('sub_ref');
    if (!ref) return;
    paymentApi.verifyPlan(ref)
      .then(() => refreshMe())
      .then(() => {
        window.history.replaceState({}, '', '/seller/subscription');
        toast.success('Payment received. Your plan is active.');
      })
      .catch((e) => setErr(e.message || 'We could not confirm that payment. If you were charged, contact support.'))
      .finally(() => setVerifying(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = currentPlanOf(user);

  const pay = async (plan) => {
    setErr('');
    setBusy(plan.code);
    try {
      const { authorization_url: url } = await paymentApi.initializePlan(plan.code);
      window.location.assign(url);
    } catch (e) {
      setErr(e.message || 'Could not start the payment. Please try again.');
      setBusy('');
    }
  };

  const currentName = plans?.find((p) => p.code === current.code)?.name || 'Free';

  return (
    <div className="page">
      <TopBar showBack showSearch={false} title="Seller plans" />

      <main className="page-main">
        <section className="sub-summary">
          <span className="sub-summary-ic"><Crown size={20} /></span>
          <div>
            <strong>You're on the {currentName} plan</strong>
            <p className="muted small">
              {verifying ? 'Confirming your payment…'
                : current.until ? `Paid until ${fmtDate(current.until)}. Pay again any time to add 30 days.`
                  : current.lapsed ? 'Your last paid plan has ended. Choose a plan to get its benefits back.'
                    : 'Upgrade for a lower buyer fee and room for more listings.'}
            </p>
          </div>
          {verifying && <Loader2 size={18} className="spin" aria-hidden="true" />}
        </section>

        {err && <Notice tone="error">{err}</Notice>}
        {loadErr && <Notice tone="error">{loadErr}</Notice>}

        {plans === null ? (
          <div className="plans-grid" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="plan-card plan-card--loading" />)}
          </div>
        ) : (
          <section className="plans-grid">
            {plans.map((p) => {
              const isCurrent = p.code === current.code;
              const paid = p.price > 0;
              return (
                <article key={p.code} className={`plan-card ${p.highlight ? 'highlight' : ''} ${isCurrent ? 'current' : ''}`}>
                  {isCurrent ? <span className="plan-tag plan-tag--current">Your plan</span>
                    : p.highlight ? <span className="plan-tag">Popular</span> : null}
                  <h3>{p.name}</h3>
                  {p.tag && <p className="muted small">{p.tag}</p>}
                  <div className="plan-price">
                    {paid ? <><strong>{ghs(p.price)}</strong><span className="per">for 30 days</span></> : <strong>Free</strong>}
                  </div>
                  <ul className="plan-features">
                    <li><Check size={15} aria-hidden="true" /> {p.maxListings ? `Up to ${p.maxListings} active listings` : 'Unlimited listings'}</li>
                    <li><Check size={15} aria-hidden="true" /> Buyers pay a {p.feePct}% service fee</li>
                    {(p.features || []).map((f) => <li key={f}><Check size={15} aria-hidden="true" /> {f}</li>)}
                  </ul>
                  {!paid ? (
                    <p className="plan-note muted small">
                      {isCurrent ? 'No payment needed.' : 'You return to Free when a paid plan ends.'}
                    </p>
                  ) : (
                    <button
                      className={`btn ${isCurrent ? 'btn-ghost' : 'btn-primary'}`}
                      onClick={() => pay(p)}
                      disabled={!!busy || verifying}
                    >
                      {busy === p.code ? <><Loader2 size={16} className="spin" /> Opening Paystack…</>
                        : isCurrent ? `Add 30 days · ${ghs(p.price)}` : `Get ${p.name}`}
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        )}

        <p className="muted small sub-foot">
          Paid securely through Paystack with MoMo or card. Plans don't renew automatically.
          Switching to a different paid plan starts a new 30-day period today.
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
