import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';
import { Notice } from '../components/Feedback';

const blank = {
  code: '', name: '', tag: '',
  price: 0, feePct: 5,
  features: '',
  highlight: false, active: true, sortOrder: 0,
};

/**
 * Subscription plans + commission editor.
 *
 * Each plan is a (code, monthly price, fee %, features list). The
 * commission is the most important field — it's what the backend
 * uses to compute every order's service fee on checkout.
 */
export default function AdminPlans() {
  const { confirm } = useAdminConfirm();
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
        features: String(draft.features).split('\n').map((s) => s.trim()).filter(Boolean),
        highlight: !!draft.highlight,
        active: !!draft.active,
        sortOrder: Number(draft.sortOrder) || 0,
      });
      setDraft(blank);
      load();
    } catch (ex) { setErr(ex.message); }
  };

  const remove = async (id, name) => {
    if (!(await confirm(`Delete plan "${name}"? Existing subscribers stay on it until renewal.`))) return;
    await adminApi.delete(`/plans/${id}`);
    load();
  };

  return (
    <>
      <h1>Subscription Plans</h1>
      <p className="muted">Tier pricing and per-sale commission. Sellers see this list on /seller/subscription.</p>

      <div className="admin-card">
        <h2>Current plans</h2>
        <table className="admin-table">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Price</th><th>Fee %</th><th>Active</th><th>Highlight</th><th></th></tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p._id}>
                <td><strong>{p.code}</strong></td>
                <td>{p.name}<div className="muted small">{p.tag}</div></td>
                <td>GH₵ {Number(p.price).toLocaleString()} /mo</td>
                <td>{p.feePct}%</td>
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
            <label>Price (GH₵/mo) <input type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></label>
            <label>Commission % <input type="number" min="0" max="100" step="0.1" value={draft.feePct} onChange={(e) => setDraft({ ...draft, feePct: e.target.value })} /></label>
            <label style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active
            </label>
            <label style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input type="checkbox" checked={draft.highlight} onChange={(e) => setDraft({ ...draft, highlight: e.target.checked })} /> Highlight
            </label>
          </div>
          <label>Features (one per line)
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
