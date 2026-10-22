import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Package, MapPin, Loader2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Feedback';
import { useOrders } from '../store/OrdersContext';
import { useConfirm } from '../store/ConfirmContext';
import { sbay } from '../api/client';
import { ghs } from '../utils/money';
import { shortTime } from '../api/adapters';
import './pages.css';
import './SellerDashboard.css';

const TABS = [
  ['todo', 'To handle', (o) => ['pending', 'processing', 'shipped'].includes(o.status)],
  ['waiting', 'Waiting for buyer', (o) => o.status === 'delivered'],
  ['done', 'Completed', (o) => o.status === 'completed'],
  ['canceled', 'Canceled', (o) => o.status === 'canceled'],
];

// The single next step for each status, in the seller's words.
const NEXT = {
  pending: { to: 'processing', label: 'Accept order', done: 'Order accepted. Agree a hand-over with the buyer.' },
  processing: { to: 'shipped', label: 'Ready for hand-over', done: 'Buyer told the item is on its way.' },
  shipped: { to: 'delivered', label: 'Mark as delivered', done: "Marked delivered. You're paid when the buyer confirms." },
};
const STATUS_TEXT = {
  pending: 'New order',
  processing: 'Accepted',
  shipped: 'On its way',
  delivered: 'Delivered, waiting for buyer',
  completed: 'Completed, payment released',
  canceled: 'Canceled',
};

/** Orders other people placed with this seller, and the next step on each. */
export default function SellerSales() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { salesOrders, loading, setStatus, cancel } = useOrders();
  const [tab, setTab] = useState('todo');
  const [busy, setBusy] = useState('');

  const counts = useMemo(() => Object.fromEntries(TABS.map(([id, , match]) => [id, salesOrders.filter(match).length])), [salesOrders]);
  const visible = salesOrders.filter(TABS.find(([id]) => id === tab)[2]);

  const run = async (key, fn, okText) => {
    setBusy(key);
    try {
      await fn();
      if (okText) toast.success(okText);
    } catch (e) {
      toast.error(e.message || 'Could not update the order.');
    } finally {
      setBusy('');
    }
  };

  const advance = async (o) => {
    const step = NEXT[o.status];
    if (step.to === 'delivered') {
      const ok = await confirm({
        title: 'Mark as delivered?',
        body: 'Only do this once the buyer has the item. They will be asked to confirm, which releases your payment.',
        confirmLabel: 'Yes, delivered',
      });
      if (!ok) return;
    }
    run(`step-${o._id}`, () => setStatus(o._id, step.to), step.done);
  };

  const decline = async (o) => {
    const ok = await confirm({
      title: 'Decline this order?',
      body: 'The order is canceled, the buyer is refunded and the item goes back on sale.',
      confirmLabel: 'Decline order',
      danger: true,
    });
    if (ok) run(`cancel-${o._id}`, () => cancel(o._id, 'Declined by seller'), 'Order declined. The buyer will be refunded.');
  };

  const messageBuyer = (o) => run(`chat-${o._id}`, async () => {
    const chat = await sbay.startChat(o.buyerId);
    navigate(`/chat/${chat._id}`);
  });

  return (
    <div className="page">
      <TopBar showBack title="Orders from buyers" showSearch={false} />
      <main className="page-main sd-sub">
        <div className="sd-tabs" role="tablist" aria-label="Filter orders">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {label}{counts[id] > 0 && <span className="chip-count">{counts[id]}</span>}
            </button>
          ))}
        </div>

        {loading && salesOrders.length === 0 ? <SkeletonList count={3} /> : visible.length === 0 ? (
          <div className="empty">
            <span className="empty-ic"><Package size={26} /></span>
            <h3>{tab === 'todo' ? 'Nothing to handle right now' : 'Nothing here yet'}</h3>
            {tab === 'todo' && <p>When someone buys from you, the order appears here with the next step to take.</p>}
          </div>
        ) : (
          <ul className="sd-items">
            {visible.map((o) => {
              const step = NEXT[o.status];
              const where = o.deliveryLocation || o.buyerLocation;
              return (
                <li key={o._id} className="sd-item sd-order">
                  <div className="sd-item-thumb"><img src={o.image} alt="" loading="lazy" /></div>
                  <div className="sd-item-body">
                    <span className="sd-item-title">{o.title}{o.qty > 1 ? ` × ${o.qty}` : ''}</span>
                    <div className="sd-item-meta">
                      <strong>{ghs(o.subtotal ?? o.price * o.qty)}</strong>
                      <span className={`sd-status sd-status--${o.status}`}>{STATUS_TEXT[o.status]}</span>
                    </div>
                    <p className="sd-order-who">
                      {o.buyerName} · {o.invoiceNumber} · {shortTime(o.placedAt)}
                      {where && <><br /><MapPin size={13} aria-hidden="true" /> {where}</>}
                    </p>
                  </div>
                  <div className="sd-item-actions">
                    {o.status !== 'canceled' && (
                      <button className="icon-action" onClick={() => messageBuyer(o)} disabled={busy === `chat-${o._id}`} aria-label={`Message ${o.buyerName}`}>
                        <MessageCircle size={16} />
                      </button>
                    )}
                    {['pending', 'processing'].includes(o.status) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => decline(o)} disabled={!!busy}>Decline</button>
                    )}
                    {step && (
                      <button className="btn btn-primary btn-sm" onClick={() => advance(o)} disabled={!!busy}>
                        {busy === `step-${o._id}` && <Loader2 size={14} className="spin" />} {step.label}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="muted small sd-foot">
          Payments are held by sBay until the buyer confirms they have the item. <Link to="/help#selling">How selling works</Link>
        </p>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
