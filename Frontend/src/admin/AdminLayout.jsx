import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, ShoppingBag, CreditCard,
  Settings, FileText, MessageSquare, LogOut, ShieldCheck,
  Menu, X, ChevronDown, Bell, Search, GraduationCap, LifeBuoy,
  UserCog, Store, ShoppingCart, IdCard, Shield,
} from 'lucide-react';
import { useAdmin } from './AdminContext';
import { AdminConfirmProvider } from './AdminConfirmContext';
import { useAuth } from '../store/AuthContext';
import { useNotifications } from './useNotifications';
import './admin.css';

/**
 * Premium admin shell:
 *  - Independently-scrolling sidebar (sticky), main scrolls separately.
 *  - Mobile hamburger drawer with slide-in animation.
 *  - Collapsible nav groups (Users → Buyers/Sellers/Admins, etc.).
 *  - Top header with global search, notifications bell, and admin chip.
 *  - Hidden completely from the public marketplace navigation.
 */

/** Nav model — each entry can be a leaf or a group with children. */
const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },

  { group: 'users', label: 'Users', icon: Users, children: [
    { to: '/admin/users',          label: 'All users',  icon: Users },
    { to: '/admin/users/buyers',   label: 'Buyers',     icon: ShoppingCart },
    { to: '/admin/users/sellers',  label: 'Sellers',    icon: Store },
    { to: '/admin/users/admins',   label: 'Admins',     icon: Shield },
  ]},

  { group: 'catalog', label: 'Catalog', icon: Package, children: [
    { to: '/admin/products', label: 'All products', icon: Package },
    { to: '/admin/plans',    label: 'Plans',        icon: CreditCard },
  ]},

  { group: 'commerce', label: 'Commerce', icon: ShoppingBag, children: [
    { to: '/admin/orders', label: 'Orders & escrow', icon: ShoppingBag },
    { to: '/admin/chats',  label: 'Conversations',   icon: MessageSquare },
  ]},

  { group: 'verification', label: 'Verification', icon: GraduationCap, children: [
    { to: '/admin/verification/students', label: 'Student IDs', icon: IdCard },
    { to: '/admin/verification/sellers',  label: 'Seller apps', icon: UserCog },
  ]},

  { to: '/admin/support', label: 'Support inbox',  icon: LifeBuoy },
  { to: '/admin/audit',   label: 'Audit log',      icon: FileText },
  { to: '/admin/settings', label: 'Settings',      icon: Settings },
];

/** Pretty page title derived from the URL — keeps the header in sync without
 *  requiring every page to set its own title prop. */
function titleFor(pathname) {
  const map = {
    '/admin': 'Dashboard',
    '/admin/users': 'All users',
    '/admin/users/buyers': 'Buyers',
    '/admin/users/sellers': 'Sellers',
    '/admin/users/admins': 'Administrators',
    '/admin/products': 'Products',
    '/admin/plans': 'Subscription plans',
    '/admin/orders': 'Orders & escrow',
    '/admin/chats': 'Conversations',
    '/admin/verification/students': 'Student verification',
    '/admin/verification/sellers':  'Seller verification',
    '/admin/support': 'Support inbox',
    '/admin/audit': 'Audit log',
    '/admin/settings': 'Settings',
  };
  // Try exact match, then fall back to first segment match
  if (map[pathname]) return map[pathname];
  const seller = pathname.match(/^\/admin\/users\/sellers\/[^/]+$/);
  if (seller) return 'Seller deep-dive';
  return 'Admin';
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { admin, booting, logout } = useAdmin();
  const { user } = useAuth();
  const { unread, items: notes, markAllRead, markRead } = useNotifications();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen]     = useState(false);
  const [openGroup, setOpenGroup]   = useState(null);
  // Close the mobile drawer on navigation.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);
  // Close the bell popover on outside click via Escape.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setBellOpen(false); setDrawerOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const title = useMemo(() => titleFor(pathname), [pathname]);

  if (booting) {
    return (
      <div className="admin-boot">
        <ShieldCheck size={32} /> <span>Loading admin panel…</span>
      </div>
    );
  }
  if (!admin) {
    // Signed in but not an admin in the database → show a clear message
    // rather than silently bouncing to /login (which the user reads as
    // "forbidden, even though I'm a super admin").
    if (user) {
      return (
        <div className="admin-boot" style={{ flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
          <ShieldCheck size={32} />
          <h2 style={{ margin: 0 }}>Admin access required</h2>
          <p style={{ maxWidth: 480, color: '#666' }}>
            You are signed in as <strong>{user.email}</strong> ({user.role}), but the admin
            panel is restricted to accounts with the <code>admin</code> role in the database.
            Ask an existing admin to elevate your account, or sign in with an admin account.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
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
    const q = new FormData(e.currentTarget).get('q');
    if (!q) return;
    navigate(`/admin/users?q=${encodeURIComponent(q)}`);
  };

  const NavTree = (
    <nav className="admin-nav" aria-label="Primary">
      {NAV.map((item) => {
        if (item.group) {
          const isOpen = openGroup === item.group;
          const Icon = item.icon;
          const containsActive = item.children.some((c) => pathname === c.to || pathname.startsWith(c.to + '/'));
          return (
            <div key={item.group} className={`admin-group ${isOpen ? 'open' : ''} ${containsActive ? 'has-active' : ''}`}>
              <button
                type="button"
                className="admin-group-h"
                onClick={() => setOpenGroup(isOpen ? null : item.group)}
                aria-expanded={isOpen}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                <ChevronDown size={15} className="chev" />
              </button>
              <div className="admin-group-children">
                <div className="admin-group-inner">
                  {item.children.map((c) => {
                    const CIcon = c.icon;
                    return (
                      <NavLink
                        key={c.to}
                        to={c.to}
                        end
                        className={({ isActive }) => `admin-link sub ${isActive ? 'active' : ''}`}
                      >
                        <CIcon size={15} /> <span>{c.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `admin-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} /> <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <AdminConfirmProvider>
    <div className="admin-shell">
      {/* ---------- Sidebar (desktop sticky / mobile drawer) ---------- */}
      <aside
        className={`admin-side ${drawerOpen ? 'open' : ''}`}
        aria-label="Admin navigation"
      >
        <header className="admin-side-h">
          <div className="admin-brand">
            <ShieldCheck size={22} />
            <div>
              <strong>sBay Admin</strong>
              <p className="muted small">Control center</p>
            </div>
          </div>
          <button
            type="button"
            className="admin-close"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={18} />
          </button>
        </header>

        <div className="admin-side-scroll">
          {NavTree}
          <div className="admin-side-foot">
            <div className="admin-me">
              <div className="admin-me-avatar" aria-hidden="true">
                {admin.name?.[0]?.toUpperCase() || admin.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="admin-me-info">
                <strong>{admin.name || 'Administrator'}</strong>
                <p className="muted small">{admin.email}</p>
              </div>
            </div>
            <button
              className="admin-logout"
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- Drawer backdrop on mobile ---------- */}
      {drawerOpen && <div className="admin-backdrop" onClick={() => setDrawerOpen(false)} />}

      {/* ---------- Main column ---------- */}
      <div className="admin-col">
        <header className="admin-top">
          <button
            type="button"
            className="admin-burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="admin-top-title">
            <h2>{title}</h2>
            <p className="muted small">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>

          <form className="admin-top-search" onSubmit={onSearch} role="search">
            <Search size={16} />
            <input name="q" type="search" placeholder="Search users, products, orders…" />
          </form>

          <div className="admin-top-actions">
            <div className={`admin-bell-wrap ${bellOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="admin-bell"
                aria-label={`Notifications (${unread} unread)`}
                onClick={() => setBellOpen((v) => !v)}
              >
                <Bell size={19} />
                {unread > 0 && <span className="admin-bell-dot">{unread > 9 ? '9+' : unread}</span>}
              </button>
              {bellOpen && (
                <div className="admin-bell-pop" role="menu">
                  <header>
                    <strong>Notifications</strong>
                    {unread > 0 && (
                      <button type="button" className="link" onClick={markAllRead}>Mark all read</button>
                    )}
                  </header>
                  <ul>
                    {notes.length === 0 && (
                      <li className="muted small" style={{ padding: '14px 16px' }}>You're all caught up.</li>
                    )}
                    {notes.map((n) => (
                      <li
                        key={n.id}
                        className={n.read ? '' : 'unread'}
                        onClick={() => { markRead(n.id); setBellOpen(false); if (n.href) navigate(n.href); }}
                      >
                        <div className="n-icon" data-kind={n.kind}>
                          {n.kind === 'order' ? <ShoppingBag size={14} />
                            : n.kind === 'chat' ? <MessageSquare size={14} />
                            : n.kind === 'verification' ? <IdCard size={14} />
                            : n.kind === 'support' ? <LifeBuoy size={14} />
                            : <Bell size={14} />}
                        </div>
                        <div className="n-body">
                          <p>{n.message}</p>
                          <small className="muted">{new Date(n.at).toLocaleString()}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="admin-chip" title={admin.email}>
              <div className="admin-chip-av">
                {admin.name?.[0]?.toUpperCase() || admin.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="admin-chip-name">{admin.name || 'Admin'}</span>
            </div>
          </div>
        </header>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
    </AdminConfirmProvider>
  );
}
