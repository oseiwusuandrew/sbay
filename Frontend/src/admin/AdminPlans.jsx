import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';
import { Notice, useToast } from '../components/Feedback';

const blank = {
  code: '', name: '', tag: '',
  price: 0, feePct: 5, maxListings: '',
  features: '',
  highlight: false, active: true, sortOrder: 0,
};

/**
 * Seller plans: price for 30 days, the service fee buyers pay on that
 * seller's items, and how many active listings the seller may have.
 * The fee and limit are enforced by the API and shown on the plan card
 * automatically; "features" is only for extra, real benefits.
 */
export default function AdminPlans() {
  const { confirm } = useAdminConfirm();
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [draft, setDraft] = useState(blank);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const { data } = await adminApi.get('/plans');
      setPlans(data.plans);
    } catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);

  const edit = (p) => setDraft({
    ...p,
    maxListings: p.maxListings || '',
    features: (p.features || []).join('\n'),
  });

  const save = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await adminApi.post('/plans', {
        code: draft.code.trim().toLowerCase(),
        name: draft.name.trim(),
        tag: draft.tag.trim() || undefined,
        price: Number(draft.price),
        feePct: Number(draft.feePct),
        maxListings: Number(draft.maxListings) || null,
        features: String(draft.features).split('\n').map((s) => s.trim()).filter(Boolean),
        highlight: !!draft.highlight,
        active: !!draft.active,
        sortOrder: Number(draft.sortOrder) || 0,
      });
      toast.success(`${draft.name.trim()} plan saved`);
      setDraft(blank);
      load();
    } catch (ex) { setErr(ex.message); }
  };

  const remove = async (id, name) => {
    if (!(await confirm(`Delete plan "${name}"? Sellers on it move to the Free plan's fee and limit when their paid period ends.`))) return;
    try {
      await adminApi.delete(`/plans/${id}`);
      toast.success(`${name} plan deleted`);
      load();
    } catch (ex) { toast.error(ex.message || 'Could not delete the plan.'); }
  };

  return (
    <>
      <h1>Seller plans</h1>
      <p className="muted">What sellers pay for 30 days, the fee their buyers pay, and how many listings they can have.</p>

      <div className="admin-card">
        <h2>Current plans</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Price</th><th>Buyer fee</th><th>Listings</th><th>Active</th><th>Highlight</th><th></th></tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id}>
                <td><strong>{p.code}</strong></td>
                <td>{p.name}<div className="muted small">{p.tag}</div></td>
                <td>{Number(p.price) > 0 ? `GH₵ ${Number(p.price).toLocaleString()} / 30 days` : 'Free'}</td>
                <td>{p.feePct}%</td>
                <td>{p.maxListings || 'No limit'}</td>
                <td>{p.active ? 'Yes' : 'No'}</td>
                <td>{p.highlight ? 'Yes' : 'No'}</td>
                <td>
                  <div className="admin-actions">
                    <button className="btn btn-ghost" onClick={() => edit(p)}>Edit</button>
                    <button className="btn btn-ghost" onClick={() => remove(p._id, p.name)}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-card">
        <h2>{draft.code ? `Edit "${draft.code}"` : <><Plus size={14} /> New plan</>}</h2>
        {err && <Notice tone="error">{err}</Notice>}
        <form onSubmit={save} className="admin-form" style={{ maxWidth: 720 }}>
          <div className="plan-row">
            <label>Code <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} required /></label>
            <label>Name <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
            <label>Tag <input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} /></label>
            <label>Sort order <input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></label>
          </div>
          <div className="plan-row">
            <label>Price (GH₵ / 30 days) <input type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></label>
            <label>Buyer fee % <input type="number" min="0" max="100" step="0.1" value={draft.feePct} onChange={(e) => setDraft({ ...draft, feePct: e.target.value })} /></label>
            <label>Max active listings <input type="number" min="1" placeholder="No limit" value={draft.maxListings} onChange={(e) => setDraft({ ...draft, maxListings: e.target.value })} /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input type="checkbox" checked={draft.highlight} onChange={(e) => setDraft({ ...draft, highlight: e.target.checked })} /> Highlight
            </label>
          </div>
          <label>Extra benefits (one per line; the fee and listing limit are shown automatically)
            <textarea rows={4} value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="submit">
              <Save size={14} /> Save plan
            </button>
            {draft.code && (
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(blank)}>Cancel</button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
