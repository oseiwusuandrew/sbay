import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { sbay } from '../api/client';
import { SkeletonList } from '../components/Skeleton';
import './pages.css';
import './ChatList.css';

/**
 * All conversations, buying and selling alike. Each row names the other
 * person and the item the chat is about.
 */
export default function ChatList() {
  const navigate = useNavigate();
  const [chats, setChats] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    sbay.getChats().then(setChats).catch(() => setChats([]));
  }, []);

  const loading = chats === null;
  const needle = q.trim().toLowerCase();
  const filtered = (chats || []).filter((c) =>
    !needle
    || c.name.toLowerCase().includes(needle)
    || (c.productTitle || '').toLowerCase().includes(needle));

  return (
    <div className="page">
      <TopBar title="Messages" showSearch={false} />
      <main className="page-main">
        {!loading && chats.length > 0 && (
          <label className="chat-search">
            <Search size={16} aria-hidden="true" />
            <input
              placeholder="Search by name or item"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search conversations"
            />
          </label>
        )}

        {loading && <SkeletonList count={5} />}

        {!loading && filtered.length === 0 && (
          <div className="empty">
            <span className="empty-ic"><MessageCircle size={26} /></span>
            <h3>{q ? 'No matching conversations' : 'No messages yet'}</h3>
            <p className="muted">
              {q
                ? 'Try a different name or item.'
                : 'A chat opens with the seller once you place an order, so you can arrange pickup or delivery.'}
            </p>
            {!q && <button className="btn btn-primary" onClick={() => navigate('/home')}>Browse listings</button>}
          </div>
        )}

        <div className="chat-list">
          {filtered.map((c) => (
            <button key={c.id} className="chat-row" onClick={() => navigate(`/chat/${c.id}`)}>
              <div className="chat-avatar" style={c.avatar ? { backgroundImage: `url(${c.avatar})` } : undefined}>
                {!c.avatar && c.name.charAt(0).toUpperCase()}
              </div>
              <div className="chat-info">
                <div className="chat-row-top">
                  <h4>{c.name}</h4>
                  <span className="muted">{c.time}</span>
                </div>
                {c.productTitle && (
                  <p className="chat-item">
                    <span className="chat-role">{c.viewerRole === 'seller' ? 'Selling' : 'Buying'}</span>
                    {c.productTitle}
                  </p>
                )}
                <p className="muted last">{c.last}</p>
              </div>
              {c.unread > 0 && <span className="unread-pulse">{c.unread}</span>}
            </button>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
