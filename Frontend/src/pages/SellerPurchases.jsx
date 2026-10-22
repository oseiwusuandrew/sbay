import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, ShoppingBag, Truck, Check, Star } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { useOrders, ORDER_STATUSES } from '../store/OrdersContext';
import { useConfirm } from '../store/ConfirmContext';
import { useToast } from '../components/Feedback';
import { sbay } from '../api/client';
import './pages.css';
import './SellerDashboard.css';

const STATUS_LABEL = ORDER_STATUSES.reduce((m, s) => (m[s.id] = s.label, m), {});

export default function SellerPurchases() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { myOrders: purchases, confirmReceipt } = useOrders();

  const messageSeller = async (order) => {
    const otherId = order.sellerId;
    if (!otherId || otherId === 'me') return;
    try {
      const chat = await sbay.startChat(otherId);
      navigate(`/chat/${chat._id}`);
    } catch (e) { toast.error(e.message || 'Could not open this chat.'); }
  };

  const onConfirmReceipt = async (id) => {
    const ok = await confirm({
      title: 'Confirm receipt?',
      body: 'This releases the escrow funds to the seller. Only do this once you have received your item in good condition.',
      confirmLabel: 'Yes, release funds',
    });
    if (!ok) return;
    try {
      await confirmReceipt(id);
      toast.success('Payment released to the seller');
    } catch (e) { toast.error(e.message || 'Could not confirm receipt.'); }
  };

  return (
    <div className="page">
      <TopBar showBack title="My purchases" showSearch={false} />
      <main className="page-main">
        <p className="muted small" style={{ marginBottom: 12 }}>
          Orders you've placed as a buyer. Track delivery, message sellers and confirm receipt here.
        </p>

        {purchases.length === 0 && (
          <div className="empty">
            <ShoppingBag size={48} color="#C9D4BD" />
            <h3>No purchases yet</h3>
            <p>Items you buy on sBay will show up here.</p>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>
              Browse marketplace
            </button>
          </div>
        )}

        {purchases.map((o) => (
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
                {o.invoiceNumber || `#${o.id}`} · {o.sellerName} · Escrow
              </p>
              <span className="price">GH₵ {o.price.toLocaleString()}</span>
            </div>
            <div className="order-side">
              <span className={`status ${o.status}`}>{STATUS_LABEL[o.status]}</span>
              <p className="muted small">{o.eta}</p>
              <button className="btn btn-ghost small" onClick={() => messageSeller(o)}>
                <MessageCircle size={14} /> Message seller
              </button>
              {o.status === 'delivered' && (
                <button className="btn btn-primary" onClick={() => onConfirmReceipt(o.id)}>
                  <Check size={14} /> I received it
                </button>
              )}
              {o.status === 'shipped' && (
                <span className="muted small"><Truck size={12} /> On the way</span>
              )}
              {o.status === 'completed' && (
                <button className="btn btn-ghost small" onClick={() => navigate(`/product/${o.id}`)}>
                  <Star size={14} /> Rate seller
                </button>
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
