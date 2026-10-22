import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/client';
import {
  Search, ShieldOff, ShieldCheck, BadgeCheck, BadgeX, Trash2,
} from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';

/**
 * Shared user-list table. Used by:
 *   - /admin/users         (no role filter, shows everyone)
 *   - /admin/users/buyers  (forces role=buyer)
 *   - /admin/users/sellers (forces role=seller, rows link to seller deep-dive)
 *   - /admin/users/admins  (forces role=admin, super-admin can remove others)
 *
 * Newest accounts always sort to the top so admins immediately see
 * recently-registered users. A small "NEW" badge marks rows created
 * within the last 24h.
 */
export default function AdminUserList({
  fixedRole = '',
  title,
  description,
  showRoleFilter = true,
  verificationStatus = '',   // e.g. 'pending' for the verification queue
  initialRestricted = '',    // honours dashboard deep links (?restricted=true)
  allowDelete = false,
  initialQuery = '',
}) {
  const navigate = useNavigate();
  const { confirm, prompt, alert } = useAdminConfirm();
  const [items, setItems]           = useState([]);
  const [me, setMe]                 = useState(null);
  const [q, setQ]                   = useState(initialQuery);
  const [role, setRole]             = useState('');
  const [verified, setVerified]     = useState('');
  const [restricted, setRestricted] = useState(initialRestricted);
  const [busy, setBusy]             = useState(false);
  const [err, setErr]               = useState('');

  const effectiveRole = fixedRole || role;

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const params = {};
      if (q.trim())   params.q = q.trim();
      if (effectiveRole) params.role = effectiveRole;
      if (verified)   params.verified = verified;
      if (restricted) params.restricted = restricted;
      if (verificationStatus) params.verification = verificationStatus;
      const { data } = await adminApi.get('/users', { params });
      // Newest first
      const sorted = [...(data.items || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setItems(sorted);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }, [q, effectiveRole, verified, restricted, verificationStatus]);

  useEffect(() => { load(); }, [load]);

  // Best-effort lookup of "me" so the admin list can flag the
  // current user and protect them from self-actions.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await adminApi.get('/admins');
        if (!alive) return;
        // /admins is the canonical admin list — pluck whoever
        // is in the local AuthContext via cached email.
        const cachedEmail = JSON.parse(localStorage.getItem('sbay.user') || 'null')?.email;
        setMe((data.admins || []).find((a) => a.email === cachedEmail) || null);
      } catch { /* ok — surface won't show super-admin actions */ }
    })();
    return () => { alive = false; };
  }, []);

  const verify = async (id, decision) => {
    let reason;
    if (decision === 'rejected') {
      reason = await prompt('Why are you rejecting this verification?', { title: 'Reject Verification', placeholder: 'Enter reason…' });
      if (reason === null) return;
    }
    await adminApi.post(`/users/${id}/verify`, { decision, reason });
    load();
  };

  const restrict = async (u) => {
    if (u.restricted) {
      if (!(await confirm(`Lift restriction on ${u.email}?`))) return;
      await adminApi.post(`/users/${u._id}/restrict`, { restricted: false });
    } else {
      const reason = await prompt(`Why are you restricting ${u.email}?`, { title: 'Restrict Account', placeholder: 'Enter reason…' });
      if (!reason) return;
      await adminApi.post(`/users/${u._id}/restrict`, { restricted: true, reason });
    }
    load();
  };

  const remove = async (u) => {
    if (!(await confirm(`Permanently delete ${u.email}? This cannot be undone.`))) return;
    try {
      await adminApi.delete(`/users/${u._id}`);
      load();
    } catch (e) {
      await alert(e.message || 'Could not delete user.');
    }
  };

  const isNew = (date) => {
    const ms = Date.now() - new Date(date).getTime();
    return ms < 24 * 3600 * 1000;
  };

  return (
    <>
      <h1>{title}</h1>
      {description && <p className="muted">{description}</p>}
      <p className="muted small">{items.length} matching {fixedRole || 'user'}{items.length === 1 ? '' : 's'}.</p>

      <div className="admin-card">
        <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Search size={16} />
          <input
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {showRoleFilter && (
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              <option value="buyer">Buyers</option>
              <option value="seller">Sellers</option>
              <option value="admin">Admins</option>
            </select>
          )}
          <select value={verified} onChange={(e) => setVerified(e.target.value)}>
            <option value="">Any verification</option>
            <option value="true">Verified</option>
            <option value="false">Not verified</option>
          </select>
          <select value={restricted} onChange={(e) => setRestricted(e.target.value)}>
            <option value="">Any access</option>
            <option value="false">Active</option>
            <option value="true">Restricted</option>
          </select>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Loading…' : 'Apply'}</button>
        </form>

        {err && <p className="muted" style={{ color: '#a4302a' }}>{err}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              // Sellers keep their dedicated deep-dive URL; everyone else
              // uses the generic admin user detail page so admins can
              // click any row and see that user's activity at a glance.
              const go = () => navigate(
                u.role === 'seller'
                  ? `/admin/users/sellers/${u._id}`
                  : `/admin/users/${u._id}`
              );
              return (
                <tr
                  key={u._id}
                  className="row-link"
                  onClick={(e) => {
                    if (e.target.closest('button, a')) return;
                    go();
                  }}
                >
                  <td>
                    <div>
                      <strong>{u.name}</strong>
                      {isNew(u.createdAt) && <span className="admin-new-badge">NEW</span>}
                    </div>
                    <div className="muted small">{u.email}</div>
                  </td>
                  <td><span className="admin-pill mute">{u.role}</span></td>
                  <td>
                    {u.restricted
                      ? <span className="admin-pill bad">Restricted</span>
                      : u.verified
                        ? <span className="admin-pill">Verified</span>
                        : u.verification?.status === 'pending'
                          ? <span className="admin-pill warn">Pending review</span>
                          : <span className="admin-pill mute">Unverified</span>}
                  </td>
                  <td>
                    <span className="admin-date">{new Date(u.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      {u.verification?.status === 'pending' && (
                        <>
                          <button className="btn btn-primary" onClick={() => verify(u._id, 'approved')}>
                            <BadgeCheck size={14} /> Approve
                          </button>
                          <button className="btn btn-ghost" onClick={() => verify(u._id, 'rejected')}>
                            <BadgeX size={14} /> Reject
                          </button>
                        </>
                      )}
                      {(!u.verification?.status || u.verification?.status !== 'pending') && (
                        u.verified ? (
                          <button className="btn btn-ghost" onClick={() => verify(u._id, 'rejected')}>
                            <BadgeX size={14} /> Revoke
                          </button>
                        ) : (
                          u.role !== 'buyer' && (
                            <button className="btn btn-ghost" onClick={() => verify(u._id, 'approved')}>
                              <BadgeCheck size={14} /> Verify
                            </button>
                          )
                        )
                      )}
                      <button className="btn btn-ghost" onClick={() => restrict(u)}>
                        {u.restricted
                          ? <><ShieldCheck size={14} /> Unrestrict</>
                          : <><ShieldOff size={14} /> Restrict</>}
                      </button>
                      {allowDelete && me?._id !== u._id && (
                        <button className="btn btn-danger" onClick={() => remove(u)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length && !busy && (
              <tr><td colSpan={5}>
                <div className="admin-empty">
                  <Search size={32} />
                  <h3>No matches</h3>
                  <p>Try a different search or adjust the filters.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
