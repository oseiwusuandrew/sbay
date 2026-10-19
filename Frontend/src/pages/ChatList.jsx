import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MessageCircle } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { sbay } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { SkeletonList } from '../components/Skeleton';
import './pages.css';
import './ChatList.css';

export default function ChatList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chats, setChats] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    // Backend returns the same /chats payload either way; we only pick
    // a different adapter so the row shows the *other* party's name.
    const fetcher = user?.role === 'seller' ? sbay.getSellerChats : sbay.getChats;
    fetcher.call(sbay).then(setChats).catch(() => setChats([]));
  }, [user?.role]);

  const loading = chats === null;
  const filtered = (chats || []).filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="page">
      <TopBar title="Messages" showSearch={false} />
      <main className="page-main">
        <div className="chat-search">
          <Search size={16} />
          <input placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading && <SkeletonList count={5} />}

        {!loading && filtered.length === 0 && (
          <div className="empty">
            <span className="empty-ic"><MessageCircle size={26} /></span>
            <h3>{q ? 'No matching conversations' : 'No messages yet'}</h3>
            <p className="muted">
              {q
                ? 'Try a different name.'
                : 'Chats unlock once you place an order, so you can arrange pickup or delivery with the seller.'}
            </p>
            {!q && <button className="btn btn-primary" onClick={() => navigate('/home')}>Browse listings</button>}
          </div>
        )}

        <div className="chat-list">
          {filtered.map((c) => (
            <button key={c.id} className="chat-row" onClick={() => navigate(`/chat/${c.id}`)}>
              <div className="chat-avatar" style={{ backgroundImage: `url(${c.avatar})` }} />
              <div className="chat-info">
                <div className="chat-row-top">
                  <h4>{c.name}</h4>
                  <span className="muted">{c.time}</span>
                </div>
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
