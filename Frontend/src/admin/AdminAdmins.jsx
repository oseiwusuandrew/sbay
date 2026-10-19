import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { ShieldCheck, ShieldOff, UserPlus, Mail } from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';

/**
 * Admin team management. The currently signed-in admin is always
 * the "super admin" w.r.t. their own account; the backend layer
 * still validates that the requester has role === 'admin' before
 * permitting any of these mutations.
 *
 * Add: invite an existing user by email and elevate their role.
 * Remove: revoke admin access (revert to their previous role).
 */
export default function AdminAdmins() {
  const { confirm, alert } = useAdminConfirm();
  const [admins, setAdmins] = useState([]);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');
  const [email, setEmail]   = useState('');
  const [adding, setAdding] = useState(false);

  const meEmail = JSON.parse(localStorage.getItem('sbay.user') || 'null')?.email;

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await adminApi.get('/admins');
      // Newest first
      const sorted = [...(data.admins || [])].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setAdmins(sorted);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true); setErr('');
    try {
      await adminApi.post('/admins', { email: email.trim() });
      setEmail('');
      await load();
    } catch (e) { setErr(e.message || 'Could not add admin.'); }
    finally { setAdding(false); }
  };

  const remove = async (a) => {
    if (a.email === meEmail) {
      await alert('You cannot remove your own admin access from this surface.');
      return;
    }
    if (!(await confirm(`Revoke admin access for ${a.email}?`))) return;
    try {
      await adminApi.delete(`/admins/${a._id}`);
      load();
    } catch (e) { await alert(e.message || 'Could not remove admin.'); }
  };

  return (
    <>
      <h1>Administrators</h1>
      <p className="muted">
        Anyone listed here has full read/write access to this control center,
        including order moderation and verification. Add admins sparingly.
      </p>

      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Invite an admin</h2>
        <form className="admin-toolbar" onSubmit={add}>
          <Mail size={16} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email of an existing user to elevate…"
            required
          />
          <button className="btn btn-primary" disabled={adding}>
            <UserPlus size={14} /> {adding ? 'Adding…' : 'Make admin'}
          </button>
        </form>
        {err && <p className="muted" style={{ color: '#a4302a' }}>{err}</p>}
      </div>

      <div className="admin-card">
        <h2 style={{ marginTop: 0 }}>Current admin team</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Status</th>
              <th>Added</th>
              <th style={{ width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a._id}>
                <td>
                  <div>
                    <strong>{a.name || '(no name)'}</strong>
                    {a.email === meEmail && <span className="admin-pill info" style={{ marginLeft: 8 }}>You</span>}
                  </div>
                  <div className="muted small">{a.email}</div>
                </td>
                <td>
                  {a.restricted
                    ? <span className="admin-pill bad">Restricted</span>
                    : <span className="admin-pill"><ShieldCheck size={12} style={{ verticalAlign: 'middle' }} /> Active</span>}
                </td>
                <td>
                  <div className="admin-date">
                    <strong>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}</strong>
                    {a.createdAt && new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td>
                  <div className="admin-actions">
                    {a.email !== meEmail && (
                      <button className="btn btn-danger" onClick={() => remove(a)}>
                        <ShieldOff size={14} /> Revoke admin
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!admins.length && !busy && (
              <tr><td colSpan={4}>
                <div className="admin-empty">
                  <ShieldCheck size={32} />
                  <h3>No admins yet</h3>
                  <p>Add the first admin using the form above.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
