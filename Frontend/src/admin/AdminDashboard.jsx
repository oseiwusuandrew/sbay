import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, CircleCheck } from 'lucide-react';
import { adminApi } from '../api/client';
import { Notice } from '../components/Feedback';

const ghs = (n) => `GH₵ ${Math.round(n || 0).toLocaleString()}`;

// Clickable stat tile that deep-links into the list it summarises.
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

// Last 30 days as one bar per day, including days with no sales, so
// gaps read as gaps instead of the bars silently closing up.
function SalesChart({ salesByDay, now }) {
  const byDate = new Map((salesByDay || []).map((d) => [d._id, d]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 864e5);
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), ...(byDate.get(key) || { orders: 0, gmv: 0 }) };
  });
  const max = Math.max(...days.map((d) => d.gmv), 1);
  const total = days.reduce((s, d) => s + d.gmv, 0);
  const orders = days.reduce((s, d) => s + d.orders, 0);

  return (
    <div className="admin-card">
      <div className="admin-chart-h">
        <h2>Orders, last 30 days</h2>
        <span>{ghs(total)} · {orders} order{orders === 1 ? '' : 's'}</span>
      </div>
      <div className="admin-chart" role="img" aria-label={`Sales over the last 30 days: ${ghs(total)} from ${orders} orders`}>
        {days.map((d) => (
          <div
            key={d.key}
            className={`admin-chart-bar ${d.gmv ? '' : 'empty'}`}
            style={{ height: d.gmv ? `${Math.max((d.gmv / max) * 100, 4)}%` : '2px' }}
            title={`${d.label}: ${ghs(d.gmv)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`}
          />
        ))}
      </div>
      <div className="admin-chart-axis"><span>{days[0].label}</span><span>Today</span></div>
    </div>
  );
}

/**
 * Overview: what needs a decision first, then the few numbers that
 * describe the marketplace, then recent sales.
 */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [todo, setTodo] = useState(null);
  const [err, setErr]   = useState('');
  const [now] = useState(() => Date.now());

  useEffect(() => {
    adminApi.get('/dashboard')
      .then((r) => setData(r.data))
      .catch((e) => setErr(e.message || 'Failed to load dashboard.'));

    // The review queues are optional extras: if one fails, show the rest.
    const count = (p, pick) => p.then((r) => pick(r.data)).catch(() => 0);
    Promise.all([
      count(adminApi.get('/users', { params: { role: 'seller', verification: 'pending', limit: 1 } }), (d) => d.total || 0),
      count(adminApi.get('/verification/students', { params: { status: 'pending' } }), (d) => d.items?.length || 0),
      count(adminApi.get('/support/tickets', { params: { status: 'open' } }), (d) => d.items?.length || 0),
    ]).then(([sellers, students, tickets]) => setTodo({ sellers, students, tickets }));
  }, []);

  if (err) return <Notice tone="error">{err}</Notice>;
  if (!data) return <p className="muted">Loading…</p>;

  const { users, products, orders, revenue, escrow, salesByDay } = data;

  const tasks = [
    todo?.sellers && { n: todo.sellers, to: '/admin/verification/sellers', title: 'Seller applications', sub: 'Approve or reject sellers waiting for the verified badge' },
    todo?.students && { n: todo.students, to: '/admin/verification/students', title: 'Student IDs', sub: 'Check uploaded student ID cards' },
    todo?.tickets && { n: todo.tickets, to: '/admin/support', title: 'Support tickets', sub: 'Open conversations waiting for a reply' },
    escrow.count && { n: escrow.count, to: '/admin/orders?escrow=held', title: 'Orders in escrow', sub: `${ghs(escrow.held)} held until buyers confirm receipt` },
  ].filter(Boolean);

  return (
    <>
      <h1>Dashboard</h1>

      <div className="admin-stat-grid">
        <Tile
          label="Users"
          value={users.total.toLocaleString()}
          sub={`${users.sellers} sellers · ${users.buyers} buyers`}
          onClick={() => navigate('/admin/users')}
        />
        <Tile
          label="Live listings"
          value={products.active.toLocaleString()}
          sub={`${products.total.toLocaleString()} in total`}
          onClick={() => navigate('/admin/products')}
        />
        <Tile
          label="Orders"
          value={orders.total.toLocaleString()}
          sub={`${orders.completed.toLocaleString()} completed`}
          onClick={() => navigate('/admin/orders')}
        />
        <Tile
          label="Completed sales"
          value={ghs(revenue.revenue)}
          sub={`${ghs(revenue.fees)} in fees`}
          onClick={() => navigate('/admin/orders')}
        />
      </div>

      <div className="admin-card">
        <h2>To review</h2>
        {!todo ? (
          <p className="muted small" style={{ margin: 0 }}>Checking queues…</p>
        ) : tasks.length ? (
          <ul className="admin-todo">
            {tasks.map((t) => (
              <li key={t.to}>
                <Link to={t.to}>
                  <span className="admin-todo-count">{t.n}</span>
                  <span className="admin-todo-text">
                    <strong>{t.title}</strong>
                    <span>{t.sub}</span>
                  </span>
                  <ChevronRight size={16} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-allclear"><CircleCheck size={18} /> Nothing waiting. You're all caught up.</p>
        )}
      </div>

      <SalesChart salesByDay={salesByDay} now={now} />

      {users.restricted > 0 && (
        <p className="muted small">
          {users.restricted} restricted user{users.restricted === 1 ? '' : 's'} ·{' '}
          <Link to="/admin/users?restricted=true">Review</Link>
        </p>
      )}
    </>
  );
}
