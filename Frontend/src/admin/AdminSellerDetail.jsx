import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../api/client';
import {
  ArrowLeft, BadgeCheck, ShieldOff, ShieldCheck, Trash2, Mail, MapPin,
  Package, ShoppingBag, MessageSquare, BarChart3,
} from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';
import { Notice, useToast } from '../components/Feedback';

/**
 * Seller deep-dive — everything an admin needs to know about a single seller:
 *   - profile (verification, account state, store info)
 *   - listings (newest first, with status/price/stock)
 *   - sales (every order they fulfilled, with the buyer's identity)
 *   - conversations (read-only chat list)
 *   - quick actions (verify/restrict/remove)
 *
 * Phase 1 wires everything against existing endpoints; Phase 2 adds
 * any missing aggregation routes.
 */
export default function AdminSellerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm, prompt } = useAdminConfirm();
  const toast = useToast();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [chats, setChats] = useState([]);
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  const meEmail = JSON.parse(localStorage.getItem('sbay.user') || 'null')?.email;

  const load = async () => {
    setBusy(true); setErr('');
    try {
      // Pull everything in parallel.
      const [{ data: u }, { data: p }, { data: o }, { data: c }] = await Promise.all([
        adminApi.get(`/users/${id}`).catch(() => ({ data: { user: null } })),
        adminApi.get('/products', { params: { sellerId: id } }).catch(() => ({ data: { items: [] } })),
        adminApi.get('/orders',   { params: { sellerId: id } }).catch(() => ({ data: { items: [] } })),
        adminApi.get('/chats',    { params: { sellerId: id } }).catch(() => ({ data: { items: [] } })),
      ]);
      setSeller(u.user || u);
      setProducts([...(p.items || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setOrders([...(o.items || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setChats([...(c.items || [])].sort((a, b) =>
        new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)
      ));
    } catch (e) { setErr(e.message || 'Could not load seller.'); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Derived stats — runs each time data changes.
  const stats = useMemo(() => {
    const completed = orders.filter((o) => o.status === 'completed' || o.escrow?.status === 'released');
    const gmv = completed.reduce((n, o) => n + Number(o.total || 0), 0);
    const fees = completed.reduce((n, o) => n + Number(o.platformFee || o.escrow?.fee || 0), 0);
    const buyers = new Set(completed.map((o) => o.buyer?._id || o.buyer?.email).filter(Boolean));
    return {
      listingsCount: products.length,
      activeListings: products.filter((p) => p.status === 'active').length,
      ordersCount: orders.length,
      gmv,
      fees,
      uniqueBuyers: buyers.size,
    };
  }, [products, orders]);

  if (busy && !seller) return <p className="muted">Loading seller…</p>;
  if (err && !seller) return <Notice tone="error">{err}</Notice>;
  if (!seller) return <p className="muted">Seller not found.</p>;

  // ---------- Actions ----------

  const verify = async (decision) => {
    let reason;
    if (decision === 'rejected') {
      reason = await prompt('Why are you rejecting verification?', { title: 'Reject Verification', placeholder: 'Enter reason…' });
      if (reason === null) return;
    }
    await adminApi.post(`/users/${seller._id}/verify`, { decision, reason });
    load();
  };
  const restrict = async () => {
    if (seller.restricted) {
      if (!(await confirm(`Lift restriction on ${seller.email}?`))) return;
      await adminApi.post(`/users/${seller._id}/restrict`, { restricted: false });
    } else {
      const reason = await prompt(`Why are you restricting ${seller.email}?`, { title: 'Restrict Seller', placeholder: 'Enter reason…' });
      if (!reason) return;
      await adminApi.post(`/users/${seller._id}/restrict`, { restricted: true, reason });
    }
    load();
  };
  const remove = async () => {
    if (!(await confirm(`Permanently delete ${seller.email}? All their listings and history will also be archived.`))) return;
    try {
      await adminApi.delete(`/users/${seller._id}`);
      navigate('/admin/users/sellers', { replace: true });
    } catch (e) { toast.error(e.message || 'Could not delete seller.'); }
  };

  return (
    <>
      <div className="admin-detail-h">
        <button className="back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="avatar" aria-hidden="true">
          {seller.name?.[0]?.toUpperCase() || 'S'}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0 }}>
            {seller.name}
            {seller.verified && <BadgeCheck size={20} color="var(--a-primary)" style={{ verticalAlign: 'middle', marginLeft: 8 }} />}
          </h1>
          <div className="muted small" style={{ marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span><Mail size={12} style={{ verticalAlign: 'middle' }} /> {seller.email}</span>
            {seller.location && <span><MapPin size={12} style={{ verticalAlign: 'middle' }} /> {seller.location}</span>}
            <span>Joined {new Date(seller.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="admin-actions">
          {!seller.verified
            ? <button className="btn btn-primary" onClick={() => verify('approved')}><BadgeCheck size={14} /> Verify</button>
            : <button className="btn btn-ghost"   onClick={() => verify('rejected')}><BadgeCheck size={14} /> Revoke verify</button>}
          <button className="btn btn-ghost" onClick={restrict}>
            {seller.restricted ? <><ShieldCheck size={14} /> Unrestrict</> : <><ShieldOff size={14} /> Restrict</>}
          </button>
          {seller.email !== meEmail && (
            <button className="btn btn-danger" onClick={remove}><Trash2 size={14} /> Delete</button>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div className="admin-stat-grid">
        <div className="admin-stat"><span>Listings</span><h3>{stats.listingsCount}</h3><small>{stats.activeListings} active</small></div>
        <div className="admin-stat"><span>Orders</span><h3>{stats.ordersCount}</h3><small>across all statuses</small></div>
        <div className="admin-stat"><span>GMV (released)</span><h3>GH₵ {Math.round(stats.gmv).toLocaleString()}</h3><small>fees: GH₵ {Math.round(stats.fees).toLocaleString()}</small></div>
        <div className="admin-stat"><span>Unique buyers</span><h3>{stats.uniqueBuyers}</h3><small>completed sales</small></div>
      </div>

      <div className="admin-tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Overview</button>
        <button className={tab === 'listings' ? 'active' : ''} onClick={() => setTab('listings')}><Package size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Listings ({products.length})</button>
        <button className={tab === 'sales'    ? 'active' : ''} onClick={() => setTab('sales')}><ShoppingBag size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Sales ({orders.length})</button>
        <button className={tab === 'chats'    ? 'active' : ''} onClick={() => setTab('chats')}><MessageSquare size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Conversations ({chats.length})</button>
      </div>

      {tab === 'overview' && (
        <div className="admin-card">
          <h2 style={{ marginTop: 0 }}>Store information</h2>
          <table className="admin-table">
            <tbody>
              <tr><th>Store name</th><td>{seller.sellerProfile?.storeName || seller.storeName || '—'}</td></tr>
              <tr><th>Bio</th><td style={{ whiteSpace: 'pre-wrap' }}>{seller.sellerProfile?.bio || seller.bio || '—'}</td></tr>
              <tr><th>Phone</th><td>{seller.phone || '—'}</td></tr>
              <tr><th>Subscription</th><td>{seller.subscription?.plan || 'free'} · {seller.subscription?.status || 'inactive'}</td></tr>
              <tr><th>Verification</th><td>{seller.verification?.status || (seller.verified ? 'approved' : 'unverified')}</td></tr>
              <tr><th>Status</th><td>{seller.restricted ? <span className="admin-pill bad">Restricted</span> : <span className="admin-pill">Active</span>}</td></tr>
              <tr><th>Joined</th><td>{new Date(seller.createdAt).toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'listings' && (
        <div className="admin-card">
          <table className="admin-table">
            <thead><tr><th>Title</th><th>Price</th><th>Stock</th><th>Status</th><th>Listed</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td><strong>{p.title}</strong><div className="muted small">{p.category}</div></td>
                  <td>GH₵ {Number(p.price).toLocaleString()}</td>
                  <td>{p.stock}</td>
                  <td><span className={`admin-pill ${p.status === 'removed' ? 'bad' : p.status === 'hidden' ? 'warn' : 'mute'}`}>{p.status}</span></td>
                  <td><div className="admin-date"><strong>{new Date(p.createdAt).toLocaleDateString()}</strong>{new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></td>
                </tr>
              ))}
              {!products.length && <tr><td colSpan={5}><div className="admin-empty"><Package size={28} /><h3>No listings</h3></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sales' && (
        <div className="admin-card">
          <table className="admin-table">
            <thead><tr><th>Invoice</th><th>Buyer</th><th>Total</th><th>Status</th><th>Escrow</th><th>Date</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id}>
                  <td><strong>{o.invoiceNumber || o._id}</strong></td>
                  <td>{o.buyer?.name}<div className="muted small">{o.buyer?.email}</div></td>
                  <td>GH₵ {Number(o.total).toLocaleString()}</td>
                  <td><span className="admin-pill mute">{o.status}</span></td>
                  <td><span className={`admin-pill ${o.escrow?.status === 'refunded' ? 'bad' : o.escrow?.status === 'released' ? '' : 'warn'}`}>{o.escrow?.status || '—'}</span></td>
                  <td><div className="admin-date"><strong>{new Date(o.createdAt).toLocaleDateString()}</strong>{new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={6}><div className="admin-empty"><ShoppingBag size={28} /><h3>No sales yet</h3></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'chats' && (
        <div className="admin-card">
          <table className="admin-table">
            <thead><tr><th>Buyer</th><th>Product</th><th>Last message</th><th>Updated</th></tr></thead>
            <tbody>
              {chats.map((c) => (
                <tr key={c._id} className="row-link" onClick={() => navigate(`/admin/chats?id=${c._id}`)}>
                  <td>{c.buyer?.name || '—'}<div className="muted small">{c.buyer?.email}</div></td>
                  <td>{c.product?.title || '—'}</td>
                  <td className="muted small" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage || '—'}</td>
                  <td><div className="admin-date"><strong>{new Date(c.lastMessageAt || c.createdAt).toLocaleDateString()}</strong>{new Date(c.lastMessageAt || c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></td>
                </tr>
              ))}
              {!chats.length && <tr><td colSpan={4}><div className="admin-empty"><MessageSquare size={28} /><h3>No conversations</h3></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
