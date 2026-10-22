import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Notice } from '../components/Feedback';

/**
 * Read-only audit trail. Every mutation an admin makes is logged on
 * the backend; this surface is what compliance / your future self
 * uses to reconstruct "who did what" after the fact.
 */
export default function AdminAudit() {
  const [items, setItems] = useState([]);
  const [action, setAction] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const { data } = await adminApi.get('/audit', { params: { action: action || undefined } });
      setItems(data.items);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [action]);

  return (
    <>
      <h1>Audit log</h1>

      <div className="admin-card">
        <div className="admin-toolbar">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Filter:
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Everything</option>
              <option value="admin.login">Admin logins</option>
              <option value="user.verify">Verifications</option>
              <option value="user.restrict">Restrictions</option>
              <option value="escrow.release">Escrow releases</option>
              <option value="escrow.refund">Escrow refunds</option>
              <option value="product.hide">Product hides</option>
              <option value="product.remove">Product removals</option>
              <option value="plan.upsert">Plan changes</option>
              <option value="settings.update">Settings updates</option>
              <option value="admin.create">Admin created</option>
              <option value="admin.remove">Admin removed</option>
            </select>
          </label>
        </div>

        {err && <Notice tone="error">{err}</Notice>}

        <table className="admin-table">
          <thead>
            <tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Meta</th></tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row._id}>
                <td className="muted">{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.actor?.name || row.actor?.email || '—'}</td>
                <td><span className="admin-pill mute">{row.action}</span></td>
                <td className="muted small">
                  {row.target?.kind ? `${row.target.kind} · ${row.target.id || ''}` : '—'}
                </td>
                <td><pre style={{ margin: 0, fontSize: '.75rem', maxWidth: 420, overflowX: 'auto' }}>
                  {row.meta ? JSON.stringify(row.meta, null, 0) : ''}
                </pre></td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                Nothing logged yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
