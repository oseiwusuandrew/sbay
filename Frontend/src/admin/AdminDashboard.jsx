import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api/client';

// Clickable stat tile that deep-links into the relevant list page.
// Defined at module level: declaring it inside the component remounted
// every tile on each render.
function Tile({ label, value, sub, onClick }) {
  return (
    <div
      className="admin-stat"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
    >
      <span>{label}</span>
      <h3>{value}</h3>
      {sub && <small>{sub}</small>}
    </div>
  );
}

/**
 * Single-screen overview of the platform.
 *
 * Every tile in the stat grid is clickable and deep-links to the
 * filtered list view that the number summarises (Users → /users,
 * Pending verifications → seller verification queue, etc.).
 */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr]   = useState('');

  useEffect(() => {
    adminApi.get('/dashboard')
      .then((r) => setData(r.data))
      .catch((e) => setErr(e.message || 'Failed to load dashboard.'));
  }, []);

  if (err) return <p className="muted" style={{ color: '#a4302a' }}>{err}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { users, products, orders, revenue, escrow, pendingVerifications, salesByDay } = data;
  const peakDay = (salesByDay || []).reduce((acc, d) => (d.gmv > (acc?.gmv || 0) ? d : acc), null);

  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted">A live snapshot of activity across sBay.</p>

      <div className="admin-stat-grid">
        <Tile
          label="Users"
          value={users.total.toLocaleString()}
          sub={`${users.buyers} buyers · ${users.sellers} sellers · ${users.admins} admins`}
          onClick={() => navigate('/admin/users')}
        />
        <Tile
          label="Products live"
          value={products.active.toLocaleString()}
          sub={`${products.total.toLocaleString()} total listings`}
          onClick={() => navigate('/admin/products')}
        />
        <Tile
          label="Orders"
          value={orders.total.toLocaleString()}
          sub={`${orders.completed.toLocaleString()} completed`}
          onClick={() => navigate('/admin/orders')}
        />
        <Tile
          label="Lifetime GMV"
          value={`GH₵ ${Math.round(revenue.revenue).toLocaleString()}`}
          sub={`Fees earned: GH₵ ${Math.round(revenue.fees).toLocaleString()}`}
          onClick={() => navigate('/admin/orders')}
        />
        <Tile
          label="Escrow held"
          value={`GH₵ ${Math.round(escrow.held).toLocaleString()}`}
          sub={`${escrow.count} orders awaiting release`}
          onClick={() => navigate('/admin/orders?escrow=held')}
        />
        <Tile
          label="Pending verifications"
          value={pendingVerifications}
          sub="Sellers awaiting review"
          onClick={() => navigate('/admin/verification/sellers')}
        />
        <Tile
          label="Restricted users"
          value={users.restricted}
          sub="Cannot transact"
          onClick={() => navigate('/admin/users?restricted=true')}
        />
        {peakDay && (
          <Tile
            label="Best 30-day day"
            value={`GH₵ ${Math.round(peakDay.gmv).toLocaleString()}`}
            sub={`${peakDay._id} · ${peakDay.orders} orders`}
            onClick={() => navigate('/admin/orders')}
          />
        )}
      </div>

      <div className="admin-card">
        <h2>30-day sales</h2>
        {salesByDay?.length ? (
          <table className="admin-table">
            <thead><tr><th>Date</th><th>Orders</th><th>GMV</th></tr></thead>
            <tbody>
              {salesByDay.slice(-14).reverse().map((d) => (
                <tr key={d._id}>
                  <td>{d._id}</td>
                  <td>{d.orders}</td>
                  <td>GH₵ {Math.round(d.gmv).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">No sales yet.</p>}
      </div>
    </>
  );
}
