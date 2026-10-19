import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Package, Lock } from 'lucide-react';
import { api } from '../api/client';
import { adaptChat, adaptMessage } from '../api/adapters';
import { useAuth } from '../store/AuthContext';
import { useSocket } from '../hooks/useSocket';
import './pages.css';
import './IndividualChat.css';

/**
 * A real chat thread — purchase-gated by the backend.
 *
 *   - `GET  /chats/:id` returns the thread + every message + the orders
 *     it covers.
 *   - `POST /chats/:id/messages` posts a message. If the buyer has no
 *     order with the seller (or every order is fully confirmed and the
 *     chat is closed) the backend returns 403/409 and we show the
 *     reason inline.
 */
export default function IndividualChat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chat, setChat] = useState(null);
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const isSeller = chat ? chat.viewerRole === 'seller' : user?.role === 'seller';

  const load = async () => {
    try {
      const { data } = await api.get(`/chats/${id}`);
      const adapted = adaptChat(data.chat, isSeller ? 'seller' : 'buyer');
      setChat(adapted);
      setMessages(data.messages.map((m) => adaptMessage(m, user?.id)));
      const populatedOrders = (data.chat.orders || []).filter((o) => typeof o === 'object');
      setOrder(populatedOrders[0] || null);
    } catch (e) {
      setError(e.message || 'Could not load this chat.');
    }
  };

  useEffect(() => { if (id && user) load(); /* eslint-disable-next-line */ }, [id, user?.id]);

  // Live updates: the API emits `message:new` to the recipient.
  const { on, off, connected } = useSocket();
  useEffect(() => {
    if (!connected) return;
    const handler = (evt) => { if (String(evt?.chatId) === String(id)) load(); };
    on('message:new', handler);
    return () => off('message:new', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, id, on, off]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const draft = text.trim();
    setText('');
    // Optimistic insert
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, from: 'me', text: draft, time: 'sending…' }]);
    try {
      await api.post(`/chats/${id}/messages`, { text: draft });
      // Refetch for the canonical message id + server timestamp
      await load();
    } catch (err) {
      setError(err.message || 'Could not send your message.');
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setText(draft);
    } finally {
      setSending(false);
    }
  };

  if (!chat) {
    return (
      <div className="page chat-page">
        <header className="chat-top">
          <button className="round-btn" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <h4 style={{ flex: 1 }}>Chat</h4>
        </header>
        <main className="page-main">
          <p className="muted">{error || 'Loading conversation…'}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page chat-page">
      <header className="chat-top">
        <button className="round-btn" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div className="chat-avatar sm" style={{ backgroundImage: `url(${chat.avatar || ''})` }} />
        <div style={{ flex: 1 }}>
          <h4>{chat.name}</h4>
          <p className="muted" style={{ fontSize: '.78rem' }}>
            {chat.closed ? 'Conversation closed' : isSeller ? 'Buyer' : 'Seller'}
          </p>
        </div>
      </header>

      {order && (
        <div className="order-banner">
          <Package size={16} />
          <span>
            Order {order.invoiceNumber || order._id} · {order.items?.[0]?.title}
          </span>
          <strong>GH₵ {(order.total || 0).toLocaleString()}</strong>
        </div>
      )}

      <main className="chat-stream">
        {messages.map((m) => (
          <motion.div
            key={m.id}
            className={`bubble ${m.from === 'me' ? 'me' : 'them'}`}
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            {m.text}
            <span className="t">{m.time}</span>
          </motion.div>
        ))}
        <div ref={endRef} />
      </main>

      {chat.closed ? (
        <div className="chat-closed">
          <Lock size={14} /> This chat has been closed because every order between
          you was confirmed received. A new order will re-open the chat.
        </div>
      ) : (
        <>
          <form className="chat-input" onSubmit={send}>
            <input
              placeholder="Type a message…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={sending}
            />
            <button type="submit" className="send" aria-label="Send" disabled={sending || !text.trim()}>
              <Send size={18} />
            </button>
          </form>
          {error && <p className="muted small" style={{ color: '#c0392b', padding: '0 14px 10px' }}>{error}</p>}
        </>
      )}
    </div>
  );
}
