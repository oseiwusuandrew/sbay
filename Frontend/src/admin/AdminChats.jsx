import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Lock, Eye } from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';
import { Notice } from '../components/Feedback';

/**
 * Read-only chat moderation. Admins can list every conversation and
 * open one to read the full transcript — useful for dispute review.
 * Closing a chat prevents further messages without deleting history.
 */
export default function AdminChats() {
  const { prompt } = useAdminConfirm();
  const [items, setItems] = useState([]);
  const [closed, setClosed] = useState('');
  const [open, setOpen] = useState(null);
  const [thread, setThread] = useState(null);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const { data } = await adminApi.get('/chats', { params: { closed: closed || undefined } });
      setItems(data.items);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [closed]);

  const view = async (id) => {
    setOpen(id);
    const { data } = await adminApi.get(`/chats/${id}`);
    setThread(data);
  };
  const close = async (id) => {
    const reason = await prompt('Reason for closing this chat?', { title: 'Close Chat', placeholder: 'Enter reason…' });
    if (!reason) return;
    await adminApi.post(`/chats/${id}/close`, { reason });
    load();
    if (open === id) view(id);
  };

  return (
    <>
      <h1>Chats</h1>

      <div className="admin-card">
        <div className="admin-toolbar">
          <select value={closed} onChange={(e) => setClosed(e.target.value)}>
            <option value="">All chats</option>
            <option value="false">Open</option>
            <option value="true">Closed</option>
          </select>
        </div>

        {err && <Notice tone="error">{err}</Notice>}

        <table className="admin-table">
          <thead><tr><th>Buyer</th><th>Seller</th><th>Last message</th><th>State</th><th></th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c._id}>
                <td>{c.buyer?.name}<div className="muted small">{c.buyer?.email}</div></td>
                <td>{c.seller?.name}<div className="muted small">{c.seller?.email}</div></td>
                <td className="muted">{c.lastMessagePreview || '—'}</td>
                <td><span className={`admin-pill ${c.closed ? 'mute' : ''}`}>{c.closed ? 'closed' : 'open'}</span></td>
                <td>
                  <div className="admin-actions">
                    <button className="btn btn-ghost" onClick={() => view(c._id)}><Eye size={14} /> View</button>
                    {!c.closed && (
                      <button className="btn btn-ghost" onClick={() => close(c._id)}><Lock size={14} /> Close</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {thread && (
        <div className="admin-card">
          <h2>Conversation</h2>
          <p className="muted small">
            Between {thread.chat.buyer?.name} and {thread.chat.seller?.name}
          </p>
          <div style={{ maxHeight: 360, overflowY: 'auto', borderTop: '1px solid #ecefe7', paddingTop: 10 }}>
            {thread.messages.map((m) => (
              <div key={m._id} style={{ marginBottom: 8 }}>
                <strong>{m.sender?.name}</strong>{' '}
                <span className="muted small">· {new Date(m.createdAt).toLocaleString()}</span>
                <div>{m.text}</div>
              </div>
            ))}
            {!thread.messages.length && <p className="muted">No messages.</p>}
          </div>
        </div>
      )}
    </>
  );
}
