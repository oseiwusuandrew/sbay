import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ghs } from '../utils/money';
import { motion } from 'framer-motion';
import { MessageCircle, Package, Truck } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { useOrders, ORDER_STATUSES } from '../store/OrdersContext';
import { useConfirm } from '../store/ConfirmContext';
import { sbay } from '../api/client';
import { Notice } from '../components/Feedback';
import './pages.css';
import './SellerDashboard.css';

// Orders only move forward; the API rejects backwards steps.
const FLOW = ['pending', 'processing', 'shipped', 'delivered'];
const STATUS_LABEL = ORDER_STATUSES.reduce((m, s) => ({ ...m, [s.id]: s.label }), {});

export default function SellerSales() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { salesOrders, setStatus, cancel } = useOrders();
  const [err, setErr] = useState('');

  const act = async (fn) => {
    setErr('');
    try { await fn(); } catch (e) { setErr(e.message || 'Could not update the order.'); }
  };

  const onDecline = async (o) => {
    const ok = await confirm({
      title: 'Decline this order?',
      body: 'The order is canceled, the buyer is refunded from escrow and the item goes back on sale.',
      confirmLabel: 'Decline order',
      danger: true,
    });
    if (ok) act(() => cancel(o._id, 'Declined by seller'));
  };

  const pending = salesOrders.filter(
    (o) => !['delivered', 'completed', 'canceled'].includes(o.status)
  ).length;

  const messageBuyer = async (order) => {
    const otherId = order.buyerId;
    if (!otherId || otherId === 'me') return;
    act(async () => {
      const chat = await sbay.startChat(otherId);
      navigate(`/chat/${chat._id}`);
    });
  };

  const onMarkDelivered = async (id) => {
    const ok = await confirm({
      title: 'Mark as delivered?',
      body: "Confirm you handed the item to the buyer. They'll be asked to confirm receipt to release the funds.",
      confirmLabel: 'Yes, delivered',
    });
    if (ok) act(() => setStatus(id, 'delivered'));
  };

  return (
    <div className="page">
      <TopBar showBack title="Incoming orders" showSearch={false} />
      <main className="page-main">
        <div className="sd-chats-help">
          <Package size={16} />
          <div>
            <strong>Orders you've received</strong>
            <p className="muted small">
              Update order status as you process it. Mark "Delivered" once the buyer has the item.
              {pending > 0 && <> · <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>{pending} pending</span></>}
            </p>
          </div>
        </div>

        {err && <Notice tone="error">{err}</Notice>}

        {salesOrders.length === 0 && (
          <div className="empty">
            <Package size={48} color="#C9D4BD" />
            <h3>No incoming orders</h3>
            <p>New buyer orders will appear here so you can fulfil them.</p>
          </div>
        )}

        {salesOrders.map((o) => (
          <motion.article
            key={o.id}
            className="order-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="thumb" style={{ backgroundImage: `url(${o.image})` }} />
            <div className="order-meta">
              <h4>{o.title}</h4>
              <p className="muted small">
                {o.invoiceNumber || `#${o.id}`} · {o.buyerName} · Escrow
              </p>
              <p className="muted small">📍 {o.buyerLocation || o.deliveryLocation || '—'}</p>
              <span className="price">You earn {ghs(o.subtotal ?? o.price * o.qty)}</span>
            </div>
            <div className="order-side">
              <span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
              {FLOW.includes(o.status) && o.status !== 'delivered' && (
                <select
                  className="status-select"
                  value={o.status}
                  aria-label="Update order status"
                  onChange={(e) => act(() => setStatus(o._id, e.target.value))}
                >
                  {FLOW.slice(FLOW.indexOf(o.status)).map((s) => (
                    <option key={s} value={s} disabled={s === o.status}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              )}
              {o.status !== 'canceled' && (
                <button className="btn btn-ghost small" onClick={() => messageBuyer(o)}>
                  <MessageCircle size={14} /> Message buyer
                </button>
              )}
              {!['delivered', 'completed', 'canceled'].includes(o.status) && (
                <button className="btn btn-primary btn-sm" onClick={() => onMarkDelivered(o._id)}>
                  <Truck size={14} /> Mark delivered
                </button>
              )}
              {['pending', 'processing'].includes(o.status) && (
                <button className="btn btn-danger btn-sm" onClick={() => onDecline(o)}>Decline</button>
              )}
            </div>
          </motion.article>
        ))}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
