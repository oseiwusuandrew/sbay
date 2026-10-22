import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check, Store, Star, Truck, MessageCircle, Package, ShieldCheck, X, MapPin, Receipt,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { SkeletonList } from '../components/Skeleton';
import { useConfirm } from '../store/ConfirmContext';
import { useToast } from '../components/Feedback';
import { useOrders, ORDER_STATUSES } from '../store/OrdersContext';
import { sbay } from '../api/client';
import { ghs } from '../utils/money';
import './pages.css';
import './Profile.css';
import './ProfileOrders.css';

const STATUS_LABEL = ORDER_STATUSES.reduce((m, s) => ({ ...m, [s.id]: s.label }), {});
const STEPS = [
  { key: 'pending', label: 'Placed', icon: Receipt },
  { key: 'processing', label: 'Preparing', icon: Store },
  { key: 'shipped', label: 'On the way', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Package },
  { key: 'completed', label: 'Completed', icon: Check },
];
const STEP_INDEX = { pending: 0, processing: 1, shipped: 2, delivered: 3, completed: 4 };
const TABS = [
  { id: 'active', label: 'Active', match: (o) => !['completed', 'canceled'].includes(o.status) },
  { id: 'completed', label: 'Completed', match: (o) => o.status === 'completed' },
  { id: 'canceled', label: 'Canceled', match: (o) => o.status === 'canceled' },
  { id: 'all', label: 'All', match: () => true },
];
const REVIEWED_KEY = 'sbay.reviewedOrders';

function readReviewed() {
  try { return new Set(JSON.parse(localStorage.getItem(REVIEWED_KEY)) || []); } catch { return new Set(); }
}

export default function ProfileOrders() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { myOrders, loading, confirmReceipt, cancel } = useOrders();
  const [tab, setTab] = useState('active');
  const [detail, setDetail] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [draft, setDraft] = useState({ rating: 5, text: '' });
  const [busy, setBusy] = useState('');
  const [reviewed, setReviewed] = useState(readReviewed);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.id, myOrders.filter(t.match).length])),
    [myOrders],
  );
  // Open on "All" when nothing is in flight, so the page is never blank.
  const activeTab = tab === 'active' && counts.active === 0 && myOrders.length > 0 ? 'all' : tab;
  const visible = myOrders.filter(TABS.find((t) => t.id === activeTab).match);

  const run = async (key, fn, okText) => {
    setBusy(key);
    try {
      await fn();
      if (okText) toast.success(okText);
    } catch (e) {
      toast.error(e.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const onConfirmReceipt = async (o) => {
    const ok = await confirm({
      title: 'Did you receive your item?',
      body: `Confirming releases ${ghs(o.subtotal ?? o.total)} from escrow to ${o.sellerName}. Only confirm once you have the item and you're happy with it.`,
      confirmLabel: 'Yes, release payment',
    });
    if (ok) run(`confirm-${o._id}`, () => confirmReceipt(o._id), 'Thanks! Payment released to the seller.');
  };

  const onCancel = async (o) => {
    const ok = await confirm({
      title: 'Cancel this order?',
      body: 'The order is canceled and your payment is refunded from escrow. This cannot be undone.',
      confirmLabel: 'Cancel order',
      danger: true,
    });
    if (ok) run(`cancel-${o._id}`, () => cancel(o._id, 'Canceled by buyer'), 'Order canceled. Your refund is on its way.');
  };

  const messageSeller = (o) => run(`chat-${o._id}`, async () => {
    const chat = await sbay.startChat(o.sellerId);
    navigate(`/chat/${chat._id}`);
  });

  const submitReview = () => {
    if (!draft.text.trim() || !reviewing) return;
    const o = reviewing;
    run(`review-${o._id}`, async () => {
      await sbay.submitReview(o.sellerId, { rating: draft.rating, text: draft.text.trim() });
      const next = new Set(reviewed).add(o._id);
      setReviewed(next);
      try { localStorage.setItem(REVIEWED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      setReviewing(null);
      setDraft({ rating: 5, text: '' });
    }, 'Review posted. Thanks for helping other students!');
  };

  return (
    <div className="page">
      <TopBar showBack showSearch={false} title="My orders" />
      <main className="page-main orders-page">
        <div className="order-tabs" role="tablist" aria-label="Filter orders">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`chip ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}{counts[t.id] > 0 && <span className="chip-count">{counts[t.id]}</span>}
            </button>
          ))}
        </div>

        {loading && myOrders.length === 0 ? (
          <SkeletonList count={3} />
        ) : myOrders.length === 0 ? (
          <div className="empty">
            <span className="empty-ic"><Package size={26} /></span>
            <h3>No orders yet</h3>
            <p>When you buy something, you can track it and chat with the seller here.</p>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>Start shopping</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty"><h3>No {activeTab} orders</h3></div>
        ) : (
          <div className="olist">
            {visible.map((o) => {
              const step = STEP_INDEX[o.status] ?? -1;
              const extra = (o.items?.length || 1) - 1;
              const canConfirm = ['shipped', 'delivered'].includes(o.status) && o.escrow?.status === 'held';
              const canCancel = ['pending', 'processing'].includes(o.status);
              const canReview = o.status === 'completed' && !reviewed.has(o._id);
              return (
                <article key={o._id} className={`ocard ${o.status}`}>
                  <header className="ocard-head">
                    <div>
                      <span className="ocard-inv">{o.invoiceNumber || o.id}</span>
                      <span className="muted small"> · {new Date(o.placedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <span className={`status ${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span>
                  </header>

                  <div className="ocard-body">
                    <img className="ocard-thumb" src={o.image} alt="" loading="lazy" />
                    <div className="ocard-info">
                      <h3>{o.title}{extra > 0 && <span className="muted"> + {extra} more</span>}</h3>
                      <span className="muted small">Sold by {o.sellerName}</span>
                      <span className="ocard-eta">{o.eta}</span>
                    </div>
                    <div className="ocard-total">
                      <strong>{ghs(o.total)}</strong>
                      <span className="muted small">{o.escrow?.status === 'held' ? 'Held in escrow' : o.escrow?.status === 'released' ? 'Paid to seller' : o.escrow?.status === 'refunded' ? 'Refunded' : ''}</span>
                    </div>
                  </div>

                  {o.status !== 'canceled' && (
                    <ol className="ostepper" aria-label="Order progress">
                      {STEPS.map((s, i) => (
                        <li key={s.key} className={i <= step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
                          <span className="dot" />
                          <span className="lbl">{s.label}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <footer className="ocard-actions">
                    {canConfirm && (
                      <button className="btn btn-primary btn-sm" disabled={busy === `confirm-${o._id}`} onClick={() => onConfirmReceipt(o)}>
                        <ShieldCheck size={15} /> I received it
                      </button>
                    )}
                    {canReview && (
                      <button className="btn btn-soft btn-sm" onClick={() => setReviewing(o)}>
                        <Star size={15} /> Rate seller
                      </button>
                    )}
                    {o.status !== 'canceled' && (
                      <button className="btn btn-ghost btn-sm" disabled={busy === `chat-${o._id}`} onClick={() => messageSeller(o)}>
                        <MessageCircle size={15} /> Message seller
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => setDetail(o)}>Details</button>
                    {canCancel && (
                      <button className="btn btn-danger btn-sm ocard-cancel" disabled={busy === `cancel-${o._id}`} onClick={() => onCancel(o)}>
                        Cancel
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Order details */}
      {detail && (
        <div className="sheet-overlay" onClick={() => setDetail(null)}>
          <motion.div
            className="sheet osheet"
            role="dialog"
            aria-label={`Order ${detail.invoiceNumber}`}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="osheet-head">
              <div>
                <h3>Order {detail.invoiceNumber}</h3>
                <span className={`status ${detail.status}`}>{STATUS_LABEL[detail.status]}</span>
              </div>
              <button className="round-btn" onClick={() => setDetail(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <ul className="osheet-items">
              {(detail.items || []).map((it, i) => (
                <li key={i}>
                  <Link to={`/product/${it.product}`} onClick={() => setDetail(null)}>{it.title}</Link>
                  <span className="muted">× {it.qty}</span>
                  <strong>{ghs(it.price * it.qty)}</strong>
                </li>
              ))}
            </ul>
            <div className="osheet-sum">
              <div><span>Subtotal</span><span>{ghs(detail.subtotal)}</span></div>
              <div><span>Service fee{detail.feePct != null ? ` (${detail.feePct}%)` : ''}</span><span>{ghs(detail.fee)}</span></div>
              <div className="tot"><span>Total paid</span><strong>{ghs(detail.total)}</strong></div>
            </div>
            {detail.deliveryLocation && (
              <p className="osheet-loc"><MapPin size={14} /> {detail.deliveryLocation}</p>
            )}
            {Array.isArray(detail.timeline) && detail.timeline.length > 0 && (
              <ul className="timeline">
                {[...detail.timeline].reverse().map((t, i) => (
                  <li key={i} className="timeline-step done">
                    <span className="timeline-icon"><Check size={14} /></span>
                    <span>
                      {t.detail}
                      <small className="muted"> · {new Date(t.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>
      )}

      {/* Review */}
      {reviewing && (
        <div className="sheet-overlay" onClick={() => setReviewing(null)}>
          <motion.div
            className="sheet"
            role="dialog"
            aria-label={`Review ${reviewing.sellerName}`}
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>How was {reviewing.sellerName}?</h3>
            <p className="muted small">For: {reviewing.title}</p>
            <div className="star-picker" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="star-btn"
                  role="radio"
                  aria-checked={draft.rating === n}
                  onClick={() => setDraft({ ...draft, rating: n })}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                >
                  <Star size={30} fill={n <= draft.rating ? 'var(--secondary)' : 'transparent'} color="var(--secondary)" />
                </button>
              ))}
            </div>
            <textarea
              placeholder="Was the item as described? How was meeting up?"
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              rows={4}
              maxLength={2000}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setReviewing(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submitReview}
                disabled={!draft.text.trim() || busy === `review-${reviewing._id}`}
              >
                Post review
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
