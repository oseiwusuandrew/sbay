import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminApi, sbay } from '../api/client';
import {
  ArrowLeft, BadgeCheck, ShieldOff, ShieldCheck, Trash2, Mail, MapPin, Phone,
  Package, ShoppingBag, MessageSquare, BarChart3, IdCard, User as UserIcon,
} from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';
import { Notice, useToast } from '../components/Feedback';

const PAYOUT_LABEL = {
  'mtn-momo': 'MTN MoMo',
  'vodafone-cash': 'Telecel Cash',
  'airteltigo-money': 'AirtelTigo Money',
  bank: 'Bank transfer',
};

/**
 * Generic user deep-dive — works for any role (buyer / seller / admin).
 *
 * Loads the user's profile, listings (if seller), orders (as buyer),
 * sales (as seller), and conversations. The same endpoints serve every
 * role; tabs that have no data simply render an empty state.
 *
 * URL: /admin/users/:id
 */
export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { confirm, prompt } = useAdminConfirm();
  const toast = useToast();

  const [user, setUser]         = useState(null);
  const [listings, setListings] = useState([]);
  const [buys, setBuys]         = useState([]); // orders as buyer
  const [sales, setSales]       = useState([]); // orders as seller
  const [chats, setChats]       = useState([]);
  const [tab, setTab]           = useState('overview');
  const [busy, setBusy]         = useState(true);
  const [err, setErr]           = useState('');

  const meEmail = JSON.parse(localStorage.getItem('sbay.user') || 'null')?.email;

  const load = async () => {
    setBusy(true); setErr('');
    try {
      // `/users/:id` already returns user + listings + orders (as buyer) + sales
      const { data } = await adminApi.get(`/users/${id}`);
      setUser(data.user || data);
      setListings(data.listings || []);
      setBuys(data.orders || []);
      setSales(data.sales || []);

      // Pull chats separately (combined buyer+seller side).
      try {
        const [b, s] = await Promise.all([
          adminApi.get('/chats', { params: { buyerId: id } }).catch(() => ({ data: { items: [] } })),
          adminApi.get('/chats', { params: { sellerId: id } }).catch(() => ({ data: { items: [] } })),
        ]);
        const merged = [...(b.data.items || []), ...(s.data.items || [])];
        const dedup = Array.from(new Map(merged.map((c) => [c._id, c])).values());
        setChats(dedup.sort((a, b2) =>
          new Date(b2.lastMessageAt || b2.createdAt) - new Date(a.lastMessageAt || a.createdAt)
        ));
      } catch { /* chats are optional */ }
    } catch (e) {
      setErr(e.message || 'Could not load user.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Derived stats
  const stats = useMemo(() => {
    const completedSales = sales.filter((o) => o.status === 'completed' || o.escrow?.status === 'released');
    const gmv = completedSales.reduce((n, o) => n + Number(o.total || 0), 0);
    const spent = buys
      .filter((o) => o.status !== 'canceled')
      .reduce((n, o) => n + Number(o.total || 0), 0);
    return {
      listingsCount: listings.length,
      activeListings: listings.filter((p) => p.status === 'active').length,
      buysCount: buys.length,
      salesCount: sales.length,
      gmv,
      spent,
    };
  }, [listings, sales, buys]);

  if (busy && !user) return <p className="muted">Loading user…</p>;
  if (err && !user)  return <Notice tone="error">{err}</Notice>;
  if (!user)         return <p className="muted">User not found.</p>;

  const isSelf = user.email === meEmail;

  /* ---------- Actions ---------- */

  const verify = async (decision) => {
    let reason;
    if (decision === 'rejected') {
      reason = await prompt('Why are you rejecting verification?', { title: 'Reject Verification', placeholder: 'Enter reason…' });
      if (reason === null) return;
    }
    try {
      await adminApi.post(`/users/${user._id}/verify`, { decision, reason });
      toast.success(decision === 'approved' ? 'Verified' : 'Verification rejected');
      load();
    } catch (e) { toast.error(e.message || 'Could not update verification.'); }
  };

  const restrict = async () => {
    try {
      if (user.restricted) {
        if (!(await confirm(`Lift restriction on ${user.email}? Their listings will be visible again.`))) return;
        await adminApi.post(`/users/${user._id}/restrict`, { restricted: false });
        toast.success(`${user.email} can use sBay again`);
      } else {
        const reason = await prompt(`Why are you restricting ${user.email}? Their listings will be hidden until you lift it.`, { title: 'Restrict Account', placeholder: 'Enter reason…' });
        if (!reason) return;
        await adminApi.post(`/users/${user._id}/restrict`, { restricted: true, reason });
        toast.success(`${user.email} restricted and their listings hidden`);
      }
      sbay.clearListingCache();
      load();
    } catch (e) { toast.error(e.message || 'Could not change restriction.'); }
  };

  const remove = async () => {
    if (!(await confirm(`Permanently delete ${user.email}? Their listings, orders, chats and reviews are deleted too. This cannot be undone.`))) return;
    try {
      await adminApi.delete(`/users/${user._id}`);
      sbay.clearListingCache();
      toast.success(`${user.email} and their listings were deleted`);
      navigate('/admin/users', { replace: true });
    } catch (e) { toast.error(e.message || 'Could not delete user.'); }
  };

  const fmtMoney = (n) => `GH₵ ${Math.round(Number(n || 0)).toLocaleString()}`;
  const fmtDate  = (d) => d
    ? <div className="admin-date">
        <strong>{new Date(d).toLocaleDateString()}</strong>
        {new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    : '—';

  /* ---------- Render ---------- */
  return (
    <>
      <div className="admin-detail-h">
        <button className="back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="avatar" aria-hidden="true">
          {user.name?.[0]?.toUpperCase() || <UserIcon size={20} />}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0 }}>
            {user.name}
            {user.verified && (
              <BadgeCheck
                size={20}
                color="var(--a-primary)"
                style={{ verticalAlign: 'middle', marginLeft: 8 }}
              />
            )}
          </h1>
          <div className="muted small" style={{ marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span><Mail   size={12} style={{ verticalAlign: 'middle' }} /> {user.email}</span>
            {user.phone    && <span><Phone  size={12} style={{ verticalAlign: 'middle' }} /> {user.phone}</span>}
            {user.location && <span><MapPin size={12} style={{ verticalAlign: 'middle' }} /> {user.location}</span>}
            <span className="admin-pill mute" style={{ textTransform: 'capitalize' }}>{user.role}</span>
            {user.restricted && <span className="admin-pill bad">Restricted</span>}
            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="admin-actions">
          {user.verification?.status === 'pending' && (
            <button className="btn btn-primary" onClick={() => verify('approved')}>
              <BadgeCheck size={14} /> Approve verification
            </button>
          )}
          {user.role !== 'buyer' && !user.verified && user.verification?.status !== 'pending' && (
            <button className="btn btn-primary" onClick={() => verify('approved')}>
              <BadgeCheck size={14} /> Verify
            </button>
          )}
          {user.verified && (
            <button className="btn btn-ghost" onClick={() => verify('rejected')}>
              <BadgeCheck size={14} /> Revoke verification
            </button>
          )}
          {!isSelf && (
            <button className="btn btn-ghost" onClick={restrict}>
              {user.restricted
                ? <><ShieldCheck size={14} /> Unrestrict</>
                : <><ShieldOff   size={14} /> Restrict</>}
            </button>
          )}
          {!isSelf && (
            <button className="btn btn-danger" onClick={remove}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Stat strip — adapts to role */}
      <div className="admin-stat-grid">
        {user.role === 'seller' && (
          <>
            <div className="admin-stat"><span>Listings</span><h3>{stats.listingsCount}</h3><small>{stats.activeListings} active</small></div>
            <div className="admin-stat"><span>Sales</span><h3>{stats.salesCount}</h3><small>GMV {fmtMoney(stats.gmv)}</small></div>
          </>
        )}
        <div className="admin-stat"><span>Purchases</span><h3>{stats.buysCount}</h3><small>Spent {fmtMoney(stats.spent)}</small></div>
        <div className="admin-stat"><span>Conversations</span><h3>{chats.length}</h3><small>buyer + seller</small></div>
      </div>

      <div className="admin-tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
          <BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Overview
        </button>
        {user.role === 'seller' && (
          <button className={tab === 'listings' ? 'active' : ''} onClick={() => setTab('listings')}>
            <Package size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Listings ({listings.length})
          </button>
        )}
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
          <ShoppingBag size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Orders ({buys.length}{user.role === 'seller' ? ` / sales: ${sales.length}` : ''})
        </button>
        <button className={tab === 'chats' ? 'active' : ''} onClick={() => setTab('chats')}>
          <MessageSquare size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Conversations ({chats.length})
        </button>
        {user.verification?.idCardUrl && (
          <button className={tab === 'idcard' ? 'active' : ''} onClick={() => setTab('idcard')}>
            <IdCard size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Student ID
          </button>
        )}
      </div>

      {tab === 'overview' && (
        <div className="admin-card">
          <h2 style={{ marginTop: 0 }}>Profile</h2>
          <table className="admin-table">
            <tbody>
              <tr><th>Role</th><td style={{ textTransform: 'capitalize' }}>{user.role}</td></tr>
              <tr><th>Email</th><td>{user.email}</td></tr>
              <tr><th>Phone</th><td>{user.phone || '—'}</td></tr>
              <tr><th>Location</th><td>{user.location || '—'}</td></tr>
              {user.role === 'seller' && (
                <>
                  <tr><th>Store name</th><td>{user.sellerProfile?.storeName || '—'}</td></tr>
                  <tr><th>Bio</th><td style={{ whiteSpace: 'pre-wrap' }}>{user.sellerProfile?.bio || '—'}</td></tr>
                  <tr><th>Subscription</th><td>{user.subscription?.plan || 'free'} · {user.subscription?.status || 'inactive'}</td></tr>
                </>
              )}
              {user.role === 'seller' && (
                <>
                  <tr><th>Payout method</th><td>{PAYOUT_LABEL[user.payout?.method] || user.payout?.method || 'Not set'}</td></tr>
                  <tr><th>Payout number</th><td>{user.payout?.account || 'not set'}</td></tr>
                  <tr><th>Payout name</th><td>{user.payout?.accountName || 'not set'}</td></tr>
                </>
              )}
              <tr><th>Verification</th><td>{user.verification?.status || (user.verified ? 'approved' : 'unverified')}</td></tr>
              <tr><th>Student?</th><td>{user.verification?.isStudent ? `Yes (${user.verification?.university || '—'})` : 'No'}</td></tr>
              <tr><th>Status</th><td>{user.restricted ? <span className="admin-pill bad">Restricted: {user.restrictReason || '—'}</span> : <span className="admin-pill">Active</span>}</td></tr>
              <tr><th>Joined</th><td>{new Date(user.createdAt).toLocaleString()}</td></tr>
              <tr><th>Last login</th><td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—'}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === 'listings' && (
        <div className="admin-card">
          <table className="admin-table">
            <thead><tr><th>Title</th><th>Price</th><th>Stock</th><th>Status</th><th>Listed</th></tr></thead>
            <tbody>
              {listings.map((p) => (
                <tr key={p._id} className="row-link" onClick={() => navigate(`/admin/products?id=${p._id}`)}>
                  <td><strong>{p.title}</strong><div className="muted small">{p.category}</div></td>
                  <td>{fmtMoney(p.price)}</td>
                  <td>{p.stock}</td>
                  <td><span className={`admin-pill ${p.status === 'removed' ? 'bad' : p.status === 'hidden' ? 'warn' : 'mute'}`}>{p.status}</span></td>
                  <td>{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
              {!listings.length && (
                <tr><td colSpan={5}>
                  <div className="admin-empty"><Package size={28} /><h3>No listings</h3></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'orders' && (
        <div className="admin-card">
          <h3 style={{ margin: '0 0 10px' }}>Purchases (as buyer)</h3>
          <table className="admin-table">
            <thead><tr><th>Invoice</th><th>Seller</th><th>Total</th><th>Status</th><th>Escrow</th><th>Date</th></tr></thead>
            <tbody>
              {buys.map((o) => (
                <tr key={o._id}>
                  <td><strong>{o.invoiceNumber || o._id?.slice(-8)}</strong></td>
                  <td>{o.seller?.name}<div className="muted small">{o.seller?.email}</div></td>
                  <td>{fmtMoney(o.total)}</td>
                  <td><span className="admin-pill mute">{o.status}</span></td>
                  <td><span className={`admin-pill ${o.escrow?.status === 'refunded' ? 'bad' : o.escrow?.status === 'released' ? '' : 'warn'}`}>{o.escrow?.status || '—'}</span></td>
                  <td>{fmtDate(o.createdAt)}</td>
                </tr>
              ))}
              {!buys.length && (
                <tr><td colSpan={6}>
                  <div className="admin-empty"><ShoppingBag size={28} /><h3>No purchases</h3></div>
                </td></tr>
              )}
            </tbody>
          </table>

          {user.role === 'seller' && (
            <>
              <h3 style={{ margin: '20px 0 10px' }}>Sales (as seller)</h3>
              <table className="admin-table">
                <thead><tr><th>Invoice</th><th>Buyer</th><th>Total</th><th>Status</th><th>Escrow</th><th>Date</th></tr></thead>
                <tbody>
                  {sales.map((o) => (
                    <tr key={o._id}>
                      <td><strong>{o.invoiceNumber || o._id?.slice(-8)}</strong></td>
                      <td>{o.buyer?.name}<div className="muted small">{o.buyer?.email}</div></td>
                      <td>{fmtMoney(o.total)}</td>
                      <td><span className="admin-pill mute">{o.status}</span></td>
                      <td><span className={`admin-pill ${o.escrow?.status === 'refunded' ? 'bad' : o.escrow?.status === 'released' ? '' : 'warn'}`}>{o.escrow?.status || '—'}</span></td>
                      <td>{fmtDate(o.createdAt)}</td>
                    </tr>
                  ))}
                  {!sales.length && (
                    <tr><td colSpan={6}>
                      <div className="admin-empty"><ShoppingBag size={28} /><h3>No sales yet</h3></div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tab === 'chats' && (
        <div className="admin-card">
          <table className="admin-table">
            <thead><tr><th>Counterparty</th><th>Product</th><th>Last message</th><th>Updated</th></tr></thead>
            <tbody>
              {chats.map((c) => {
                const isBuyerSide = c.buyer?._id === user._id || c.buyer === user._id;
                const counter = isBuyerSide ? c.seller : c.buyer;
                return (
                  <tr key={c._id} className="row-link" onClick={() => navigate(`/admin/chats?id=${c._id}`)}>
                    <td>{counter?.name || '—'}<div className="muted small">{counter?.email}</div></td>
                    <td>{c.product?.title || '—'}</td>
                    <td className="muted small" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.lastMessage || '—'}
                    </td>
                    <td>{fmtDate(c.lastMessageAt || c.createdAt)}</td>
                  </tr>
                );
              })}
              {!chats.length && (
                <tr><td colSpan={4}>
                  <div className="admin-empty"><MessageSquare size={28} /><h3>No conversations</h3></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'idcard' && user.verification?.idCardUrl && (
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Student ID card</h3>
          <p className="muted small">
            University: <strong>{user.verification?.university || '—'}</strong>
            {user.verification?.idCardUploadedAt && (
              <> · Uploaded {new Date(user.verification.idCardUploadedAt).toLocaleString()}</>
            )}
          </p>
          <img
            src={user.verification.idCardUrl}
            alt="Student ID"
            style={{ maxWidth: '100%', maxHeight: 520, borderRadius: 8, border: '1px solid #ddd' }}
          />
        </div>
      )}
    </>
  );
}
