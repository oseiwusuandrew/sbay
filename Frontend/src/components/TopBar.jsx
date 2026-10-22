import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, ShoppingCart, ArrowLeft, X, UserRound } from 'lucide-react';
import Logo from './Logo';
import Avatar from './Avatar';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useUserNotifications } from '../hooks/useUserNotifications';
import './TopBar.css';

/**
 * Sticky app top bar.
 *
 * Props
 *  - showBack: render a back arrow instead of the logo
 *  - title:    optional title shown when showBack is true
 *  - showSearch (default true): render the search input
 *  - searchValue / onSearchChange: when provided, render an actual <input>
 *    so typing filters the current page in-place. Otherwise the search is a
 *    button that navigates to the dedicated search page.
 *  - searchPlaceholder: placeholder text inside the search box
 *  - hideActions: hide the bell / cart / avatar cluster (used on Home where
 *    the search bar should fill the available width)
 */
export default function TopBar({
  showBack = false,
  title,
  showSearch = true,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  hideActions = true, // Default: unified appearance with the Home navbar.
}) {
  const navigate = useNavigate();
  const { count } = useCart();
  const { user } = useAuth();
  const { unread } = useUserNotifications();
  const isLive = typeof onSearchChange === 'function';

  return (
    <header className={`topbar ${showBack ? 'has-back' : ''} ${hideActions ? 'no-actions' : ''}`}>
      {showBack ? (
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
      ) : (
        <Link to="/home" className="topbar-brand"><Logo size="md" /></Link>
      )}

      {title && <h2 className="topbar-title">{title}</h2>}

      {showSearch && (
        isLive ? (
          <div className="search-wrap is-live">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search"
            />
            {searchValue && (
              <button
                className="search-clear"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="search-wrap"
            onClick={() => navigate('/search')}
          >
            <Search size={18} className="search-icon" />
            <span className="search-input">{searchPlaceholder}</span>
          </button>
        )
      )}

      {!hideActions && (
        <div className="topbar-actions">
          <button
            className="icon-btn"
            aria-label="Notifications"
            onClick={() => navigate('/notifications')}
          >
            <Bell size={20} />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>
          <button
            className="icon-btn"
            aria-label="Cart"
            onClick={() => navigate('/cart')}
          >
            <ShoppingCart size={20} />
            {count > 0 && <span className="badge">{count}</span>}
          </button>
          <button
            className="avatar"
            onClick={() => navigate(user ? (user.role === 'seller' ? '/seller-dashboard' : '/profile') : '/login')}
            aria-label={user ? (user.role === 'seller' ? 'Seller dashboard' : 'Profile') : 'Sign in'}
          >
            {user ? <Avatar src={user.avatar} name={user.name} size={36} /> : <UserRound size={20} />}
          </button>
        </div>
      )}
    </header>
  );
}
