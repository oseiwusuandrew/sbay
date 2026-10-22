import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../api/client';
import { IdCard, Check, X as XIcon, Eye, Search } from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';
import { Notice, useToast } from '../components/Feedback';

/**
 * Student-ID verification queue.
 *
 * Sellers who claim student status upload an ID card during onboarding;
 * this page surfaces the queue (newest first) and lets admins approve
 * or reject each submission with a reason. Approval flips the
 * `verified` flag on the user document.
 */
export default function AdminStudentVerification() {
  const { prompt } = useAdminConfirm();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');
  const [filter, setFilter] = useState('pending');
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await adminApi.get('/verification/students', { params: { status: filter || undefined } });
      const sorted = [...(data.items || [])].sort(
        (a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0)
      );
      setItems(sorted);
    } catch (e) {
      // Endpoint will be added in Phase 2 — keep the UI graceful for now.
      setErr(e.message || 'Could not load verification queue.');
      setItems([]);
    } finally { setBusy(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision) => {
    let reason;
    if (decision === 'rejected') {
      reason = await prompt('Why is this ID being rejected? (sent to the student)', { title: 'Reject ID', placeholder: 'Enter reason…' });
      if (reason === null) return;
    }
    try {
      await adminApi.post(`/verification/students/${id}/decide`, { decision, reason });
      load();
    } catch (e) { toast.error(e.message || 'Could not update verification.'); }
  };

  const isNew = (date) => date && Date.now() - new Date(date).getTime() < 24 * 3600 * 1000;

  return (
    <>
      <h1>Student verification</h1>
      <p className="muted">
        Review uploaded student ID cards and approve or reject each
        submission. Approved students get the verified badge across the
        marketplace.
      </p>

      <div className="admin-card">
        <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Search size={16} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </select>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</button>
        </form>

        {err && <Notice tone="error">{err}</Notice>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>University</th>
              <th>ID image</th>
              <th>Status</th>
              <th>Submitted</th>
              <th style={{ width: 240 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v._id}>
                <td>
                  <div>
                    <strong>{v.user?.name || v.name}</strong>
                    {isNew(v.submittedAt) && <span className="admin-new-badge">NEW</span>}
                  </div>
                  <div className="muted small">{v.user?.email || v.email}</div>
                </td>
                <td>{v.university || '—'}</td>
                <td>
                  {v.idCardUrl ? (
                    <button className="btn btn-ghost" onClick={() => setPreview(v.idCardUrl)}>
                      <Eye size={14} /> Preview
                    </button>
                  ) : <span className="muted small">No image</span>}
                </td>
                <td>
                  <span className={`admin-pill ${v.status === 'rejected' ? 'bad' : v.status === 'approved' ? '' : 'warn'}`}>
                    {v.status || 'pending'}
                  </span>
                </td>
                <td>
                  <div className="admin-date">
                    <strong>{v.submittedAt ? new Date(v.submittedAt).toLocaleDateString() : '—'}</strong>
                    {v.submittedAt && new Date(v.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td>
                  <div className="admin-actions">
                    {(v.status || 'pending') === 'pending' && (
                      <>
                        <button className="btn btn-primary" onClick={() => decide(v._id, 'approved')}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="btn btn-danger" onClick={() => decide(v._id, 'rejected')}>
                          <XIcon size={14} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && !busy && (
              <tr><td colSpan={6}>
                <div className="admin-empty">
                  <IdCard size={32} />
                  <h3>Nothing to review</h3>
                  <p>{err ? 'The verification endpoint is not live yet.' : 'New student ID submissions will appear here.'}</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Lightbox preview */}
      {preview && (
        <div className="admin-backdrop" onClick={() => setPreview(null)} style={{ display: 'block', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#fff', padding: 12, borderRadius: 14, maxWidth: '90vw', maxHeight: '90vh',
          }} onClick={(e) => e.stopPropagation()}>
            <img src={preview} alt="Student ID" style={{ maxWidth: '88vw', maxHeight: '82vh', display: 'block', borderRadius: 10 }} />
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={() => setPreview(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
