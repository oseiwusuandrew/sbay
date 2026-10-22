import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, ShoppingBag, CreditCard,
  Settings, FileText, MessageSquare, LogOut, ShieldCheck,
  Menu, X, Bell, Search, LifeBuoy, BadgeCheck,
} from 'lucide-react';
import { useAdmin } from './AdminContext';
import { AdminConfirmProvider } from './AdminConfirmContext';
import { useAuth } from '../store/AuthContext';
import { useNotifications } from './useNotifications';
import './admin.css';

/**
 * Admin shell: a flat, always-visible sidebar and a slim top bar.
 *
 * Related pages share one nav entry and switch with tabs above the page
 * (Users → All / Buyers / Sellers / Admins, Verification → Sellers /
 * Students), so the sidebar stays short and nothing hides in a dropdown.
 */

const NAV = [
  { items: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  ]},
  { label: 'Review', items: [
    { to: '/admin/verification/sellers', match: '/admin/verification', label: 'Verification', icon: BadgeCheck },
    { to: '/admin/support', label: 'Support', icon: LifeBuoy },
  ]},
  { label: 'Manage', items: [
    { to: '/admin/users', match: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/products', label: 'Products', icon: Package },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
    { to: '/admin/chats', label: 'Conversations', icon: MessageSquare },
  ]},
  { label: 'Setup', items: [
    { to: '/admin/plans', label: 'Plans', icon: CreditCard },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
    { to: '/admin/audit', label: 'Audit log', icon: FileText },
  ]},
];

// Tab rows for sections that span several routes. Detail pages
// (/admin/users/:id, /admin/users/sellers/:id) show no tabs.
const TABS = [
  { base: '/admin/users', tabs: [
    { to: '/admin/users', label: 'All' },
    { to: '/admin/users/buyers', label: 'Buyers' },
    { to: '/admin/users/sellers', label: 'Sellers' },
    { to: '/admin/users/admins', label: 'Admins' },
  ]},
  { base: '/admin/verification', tabs: [
    { to: '/admin/verification/sellers', label: 'Sellers' },
    { to: '/admin/verification/students', label: 'Students' },
  ]},
];

function tabsFor(pathname) {
  const section = TABS.find((s) => pathname === s.base || pathname.startsWith(s.base + '/'));
  return section?.tabs.some((t) => t.to === pathname) ? section.tabs : null;
}

const initial = (a) => (a.name?.[0] || a.email?.[0] || 'A').toUpperCase();

export default function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { admin, booting, logout } = useAdmin();
  const { user } = useAuth();
  const { unread, items: notes, markAllRead, markRead } = useNotifications();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen]     = useState(false);
  const bellRef = useRef(null);

  // Close the drawer and the bell on Escape or a click elsewhere; nav
  // links close the drawer themselves.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setBellOpen(false); setDrawerOpen(false); } };
    const onDown = (e) => { if (!bellRef.current?.contains(e.target)) setBellOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, []);

  if (booting) {
    return (
      <div className="admin-boot">
        <ShieldCheck size={28} /> <span>Loading admin panel…</span>
      </div>
    );
  }
  if (!admin) {
    // Signed in but not an admin in the database → say so plainly rather
    // than silently bouncing to /login.
    if (user) {
      return (
        <div className="admin-boot admin-denied">
          <ShieldCheck size={28} />
          <h2>Admin access required</h2>
          <p>
            You are signed in as <strong>{user.email}</strong> ({user.role}). The admin
            panel is only for accounts with the <code>admin</code> role.
          </p>
          <div className="admin-denied-actions">
            <button className="btn btn-ghost" onClick={() => { logout(); navigate('/login', { replace: true }); }}>
              Sign out
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/home', { replace: true })}>
              Back to sBay
            </button>
          </div>
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  const onSearch = (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q')?.toString().trim();
    if (q) navigate(`/admin/users?q=${encodeURIComponent(q)}`);
  };

  const signOut = () => { logout(); navigate('/login', { replace: true }); };
  const tabs = tabsFor(pathname);

  return (
    <AdminConfirmProvider>
    <div className="admin-shell">
      <aside className={`admin-side ${drawerOpen ? 'open' : ''}`} aria-label="Admin navigation">
        <div className="admin-side-h">
          <NavLink to="/admin" className="admin-brand" onClick={() => setDrawerOpen(false)}>
            <span className="admin-brand-mark">s</span>
            <strong>sBay Admin</strong>
          </NavLink>
          <button type="button" className="admin-icon-btn admin-close" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="admin-nav" aria-label="Primary">
          {NAV.map((section, i) => (
            <div className="admin-nav-section" key={section.label || i}>
              {section.label && <p className="admin-nav-label">{section.label}</p>}
              {section.items.map(({ to, match, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) =>
                    `admin-link ${isActive || (match && pathname.startsWith(match)) ? 'active' : ''}`}
                >
                  <Icon size={17} /> <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-side-foot">
          <div className="admin-me">
            <span className="admin-avatar" aria-hidden="true">{initial(admin)}</span>
            <div className="admin-me-info">
              <strong>{admin.name || 'Administrator'}</strong>
              <span>{admin.email}</span>
            </div>
          </div>
          <button type="button" className="admin-icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {drawerOpen && <div className="admin-backdrop" onClick={() => setDrawerOpen(false)} />}

      <div className="admin-col">
        <header className="admin-top">
          <button type="button" className="admin-icon-btn admin-burger" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>

          <form className="admin-top-search" onSubmit={onSearch} role="search">
            <Search size={16} />
            <input name="q" type="search" placeholder="Find a user by name or email" aria-label="Find a user" />
          </form>

          <div className="admin-bell-wrap" ref={bellRef}>
            <button
              type="button"
              className="admin-icon-btn"
              aria-label={`Notifications (${unread} unread)`}
              aria-expanded={bellOpen}
              onClick={() => setBellOpen((v) => !v)}
            >
              <Bell size={18} />
              {unread > 0 && <span className="admin-bell-dot">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {bellOpen && (
              <div className="admin-bell-pop" role="menu">
                <header>
                  <strong>Notifications</strong>
                  {unread > 0 && <button type="button" className="admin-link-btn" onClick={markAllRead}>Mark all read</button>}
                </header>
                <ul>
                  {notes.length === 0 && <li className="admin-bell-empty">You're all caught up.</li>}
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className={n.read ? '' : 'unread'}
                      onClick={() => { markRead(n.id); setBellOpen(false); if (n.href) navigate(n.href); }}
                    >
                      <p>{n.message}</p>
                      <small>{new Date(n.at).toLocaleString()}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </header>

        <main className="admin-main">
          {tabs && (
            <nav className="admin-tabs admin-section-tabs" aria-label="Section">
              {tabs.map((t) => (
                <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
                  {t.label}
                </NavLink>
              ))}
            </nav>
          )}
          <Outlet />
        </main>
      </div>
    </div>
    </AdminConfirmProvider>
  );
}
