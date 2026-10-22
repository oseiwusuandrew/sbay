import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { isNew } from './format';
import { Search, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';
import { Notice } from '../components/Feedback';

/**
 * Moderation surface for every product on the platform. Hide takes
 * the listing offline (reversible). Remove is a soft-delete with a
 * documented reason that's stored on the document for compliance.
 */
export default function AdminProducts() {
  const { prompt } = useAdminConfirm();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await adminApi.get('/products', { params: { q: q.trim() || undefined, status: status || undefined } });
      const sorted = [...(data.items || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setItems(sorted);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }, [q, status]);


  useEffect(() => { load(); }, [load]);

  const act = async (id, action) => {
    let reason;
    if (action === 'remove') {
      reason = await prompt('Reason for removing this listing (visible to the seller):', { title: 'Remove Listing', placeholder: 'Enter reason…' });
      if (!reason) return;
    }
    await adminApi.post(`/products/${id}/moderate`, { action, reason });
    load();
  };

  return (
    <>
      <h1>Products</h1>
      <p className="muted">{items.length} listings.</p>

      <div className="admin-card">
        <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Search size={16} />
          <input placeholder="Title contains…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All states</option>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
            <option value="sold_out">Sold out</option>
            <option value="removed">Removed</option>
          </select>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Loading…' : 'Apply'}</button>
        </form>

        {err && <Notice tone="error">{err}</Notice>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Seller</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Listed</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p._id}>
                <td>
                  <div>
                    <strong>{p.title}</strong>
                    {isNew(p.createdAt) && <span className="admin-new-badge">NEW</span>}
                  </div>
                  <div className="muted small">{p.category} · {p.condition || '—'}</div>
                </td>
                <td>
                  <div>{p.seller?.name}</div>
                  <div className="muted small">{p.seller?.email}</div>
                </td>
                <td>GH₵ {Number(p.price).toLocaleString()}</td>
                <td>{p.stock}</td>
                <td>
                  <span className={`admin-pill ${p.status === 'removed' ? 'bad' : p.status === 'hidden' ? 'warn' : 'mute'}`}>
                    {p.status}
                  </span>
                </td>
                <td>
                  <div className="admin-date">
                    <strong>{new Date(p.createdAt).toLocaleDateString()}</strong>
                    {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td>
                  <div className="admin-actions">
                    {p.status === 'hidden'
                      ? <button className="btn btn-primary" onClick={() => act(p._id, 'unhide')}><Eye size={14} /> Unhide</button>
                      : <button className="btn btn-ghost" onClick={() => act(p._id, 'hide')}><EyeOff size={14} /> Hide</button>}
                    {p.status !== 'removed' && (
                      <button className="btn btn-ghost" onClick={() => act(p._id, 'remove')}>
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !busy && (
              <tr><td colSpan={7}>
                <div className="admin-empty">
                  <Search size={32} />
                  <h3>No listings match these filters.</h3>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
