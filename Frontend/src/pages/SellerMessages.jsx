import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { sbay } from '../api/client';
import './pages.css';
import './SellerDashboard.css';

export default function SellerMessages() {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sbay.getSellerChats()
      .then(setChats)
      .catch(() => setChats([]))
      .finally(() => setLoading(false));
  }, []);

  const totalUnread = chats.reduce((s, c) => s + (c.unread || 0), 0);

  return (
    <div className="page">
      <TopBar showBack title="Buyer messages" showSearch={false} />
      <main className="page-main">
        <div className="sd-chats-help">
          <MessageCircle size={16} />
          <div>
            <strong>Messages from buyers</strong>
            <p className="muted small">
              Tap a conversation to reply.
              {totalUnread > 0 && <> · <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>{totalUnread} unread</span></>}
            </p>
          </div>
        </div>

        {!loading && chats.length === 0 && (
          <div className="empty">
            <MessageCircle size={48} color="#C9D4BD" />
            <h3>No buyer messages yet</h3>
            <p>When buyers message you about your listings, they'll appear here.</p>
          </div>
        )}

        <div className="sd-chats">
          {chats.map((c) => (
            <button
              key={c.id}
              className="sd-chat-row"
              onClick={() => navigate(`/chat/${c.id}`)}
            >
              <div className="sd-chat-avatar" style={{ backgroundImage: `url(${c.avatar})` }} />
              <div className="sd-chat-body">
                <div className="sd-chat-top">
                  <h4>{c.buyerName || c.name}</h4>
                  <span className="muted small">{c.time}</span>
                </div>
                {c.buyerLocation && (
                  <p className="sd-chat-loc muted small">📍 {c.buyerLocation}</p>
                )}
                {c.productTitle && (
                  <div className="sd-chat-item">
                    {c.productImage && (
                      <span
                        className="sd-chat-item-img"
                        style={{ backgroundImage: `url(${c.productImage})` }}
                      />
                    )}
                    <span className="sd-chat-item-title">Re: {c.productTitle}</span>
                  </div>
                )}
                <p className="sd-chat-last">{c.last}</p>
              </div>
              {c.unread > 0 && <span className="unread-pulse">{c.unread}</span>}
            </button>
          ))}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
