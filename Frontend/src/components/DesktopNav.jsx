import { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, ShoppingCart, Plus, LayoutGrid, Home as HomeIc, TrendingUp, Heart } from 'lucide-react';
import { useWishlist } from '../store/WishlistContext';
import Logo from './Logo';
import Avatar from './Avatar';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useUserNotifications } from '../hooks/useUserNotifications';
import './DesktopNav.css';

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

const LINKS = [
  { to: '/home',       label: 'Home',       icon: HomeIc },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/trending',   label: 'Trending',   icon: TrendingUp },
];

export default function DesktopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { count } = useCart();
  const { user } = useAuth();
  const { unread } = useUserNotifications();
  const { count: saved } = useWishlist();

  const [searchQ, setSearchQ] = useState('');

  // Admin SPA has its own shell, and the auth screens are focused flows
  // with their own brand panel — no marketplace nav on either.
  if (pathname.startsWith('/admin') || AUTH_ROUTES.includes(pathname)) return null;

  const goSell = () => {
    if (!user) navigate('/login?mode=seller&next=' + encodeURIComponent('/become-seller'));
    else if (user.role !== 'seller') navigate('/become-seller');
    else navigate('/sell');
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const q = searchQ.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  return (
    <header className="dnav">
      <div className="dnav-inner">
        <Link to="/home" className="dnav-brand" aria-label="sBay home">
          <Logo size="md" />
        </Link>

        <nav className="dnav-links">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `dnav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <form className="dnav-search-form" onSubmit={submitSearch} role="search">
          <Search size={16} className="dnav-search-ic" />
          <input
            type="search"
            className="dnav-search-input"
            placeholder="Search textbooks, phones, fashion…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            aria-label="Search"
          />
        </form>

        <div className="dnav-actions">
          <button className="dnav-sell" onClick={goSell}>
            <Plus size={16} /> <span>Sell</span>
          </button>
          {user && (
            <button className="icon-btn" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} title="Notifications" onClick={() => navigate('/notifications')}>
              <Bell size={20} />
              {unread > 0 && <span className="badge">{unread}</span>}
            </button>
          )}
          <button className="icon-btn" aria-label={`Saved items (${saved})`} title="Saved" onClick={() => navigate('/profile/wishlist')}>
            <Heart size={20} />
            {saved > 0 && <span className="badge badge--muted">{saved}</span>}
          </button>
          <button className="icon-btn" aria-label={`Cart (${count} items)`} title="Cart" onClick={() => navigate('/cart')}>
            <ShoppingCart size={20} />
            {count > 0 && <span className="badge">{count}</span>}
          </button>
          {user ? (
            <button
              className="avatar"
              onClick={() => navigate(user.role === 'seller' ? '/seller-dashboard' : '/profile')}
              aria-label={user.role === 'seller' ? 'Seller dashboard' : 'Profile'}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <Avatar src={user.avatar} name={user.name || user.email} size={36} />
            </button>
          ) : (
            <button className="dnav-signin" onClick={() => navigate('/login')}>
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
