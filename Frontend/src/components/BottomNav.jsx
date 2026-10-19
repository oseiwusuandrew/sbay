import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, User, Plus, Store, ShoppingBag, MessageCircle } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import './BottomNav.css';

/**
 * Mobile bottom navigation: Home · Categories · [Sell CTA] · Orders · Profile.
 * The Sell button stays a distinct CTA; Orders and Profile now have separate
 * routes and active states.
 */
const BUYER_ITEMS = [
  { id: 'home',       label: 'Home',       path: '/home',       icon: Home },
  { id: 'categories', label: 'Categories', path: '/categories', icon: LayoutGrid },
  { id: 'sell',       label: 'Sell',       path: '/sell',       icon: Plus, center: true },
  { id: 'orders',     label: 'Orders',     path: '/profile/orders', icon: ShoppingBag },
  { id: 'profile',    label: 'Profile',    path: '/profile',    icon: User },
];

// Sellers don't need the Sell CTA — they manage everything from their dashboard.
const SELLER_ITEMS = [
  { id: 'home',       label: 'Home',       path: '/home',            icon: Home },
  { id: 'categories', label: 'Categories', path: '/categories',      icon: LayoutGrid },
  { id: 'sell',       label: 'Sell',       path: '/sell',            icon: Plus, center: true },
  { id: 'messages',   label: 'Messages',   path: '/chats',           icon: MessageCircle },
  { id: 'dashboard',  label: 'Dashboard',  path: '/seller-dashboard', icon: Store },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const items = user?.role === 'seller' ? SELLER_ITEMS : BUYER_ITEMS;

  const handleClick = (item) => {
    if (item.id === 'sell') {
      if (!user) navigate('/login?mode=seller&next=' + encodeURIComponent('/become-seller'));
      else if (user.role !== 'seller') navigate('/become-seller');
      else navigate('/sell');
      return;
    }
    navigate(item.path);
  };

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const { id, label, path, icon: Icon, center } = item;
        const active = !center && (
          pathname === path ||
          (path === '/categories' && pathname.startsWith('/category')) ||
          (path === '/chats' && pathname.startsWith('/chat')) ||
          (path === '/profile' && pathname.startsWith('/profile') && !pathname.startsWith('/profile/orders')) ||
          (path === '/seller-dashboard' && (pathname.startsWith('/seller-dashboard') || pathname.startsWith('/seller/')))
        );
        return (
          <button
            key={id}
            type="button"
            className={`nav-item ${active ? 'active' : ''} ${center ? 'center' : ''}`}
            onClick={() => handleClick(item)}
            aria-current={active ? 'page' : undefined}
          >
            <span className="nav-icon"><Icon size={center ? 24 : 20} /></span>
            <span className="nav-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
