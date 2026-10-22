import { Navigate, useNavigate } from 'react-router-dom';
import { Settings, LogOut, ChevronRight, Store, Package, Heart, User, MessageCircle, LifeBuoy } from 'lucide-react';
import TopBar from '../components/TopBar';
import Avatar from '../components/Avatar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { useAuth } from '../store/AuthContext';
import { useConfirm } from '../store/ConfirmContext';
import { useOrders } from '../store/OrdersContext';
import { useWishlist } from '../store/WishlistContext';
import './pages.css';
import './Profile.css';

const PROFILE_NAV = [
  { id: 'orders',        label: 'My orders',     to: '/profile/orders',   icon: Package,       desc: 'Track, confirm and review orders' },
  { id: 'messages',      label: 'Messages',      to: '/chats',            icon: MessageCircle, desc: 'Chats with sellers' },
  { id: 'wishlist',      label: 'Saved items',   to: '/profile/wishlist', icon: Heart,         desc: 'Listings you saved for later' },
  { id: 'settings',      label: 'Settings',      to: '/profile/settings', icon: Settings,      desc: 'Profile, password and account' },
  { id: 'help',          label: 'Help',          to: '/help',             icon: LifeBuoy,      desc: 'How sBay works and contacting us' },
  { id: 'become-seller', label: 'Start selling', to: '/become-seller',    icon: Store,         desc: 'Open a shop and list your first item', action: true },
];

export default function Profile() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user, logout } = useAuth();
  const { myOrders: orders } = useOrders();

  const isGuest = !user;

  const { count: wishlistCount } = useWishlist();

  // Sellers go straight to their dashboard (declaratively — calling
  // navigate() during render triggers React warnings).
  if (user?.role === 'seller') {
    return <Navigate to="/seller-dashboard" replace />;
  }

  const onLogout = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      body: 'You will need to sign in again to chat or checkout.',
      confirmLabel: 'Sign out',
      danger: true,
    });
    if (ok) {
      logout();
      navigate('/home');
    }
  };

  if (isGuest) {
    return (
      <div className="page">
        <TopBar showSearch={false} title="Profile" />
        <main className="page-main">
          <div className="profile-guest-card">
            <div className="profile-guest-icon">
              <User size={40} />
            </div>
            <h2>You're browsing as a guest</h2>
            <p>Sign in to track orders, save items, chat, and check out.</p>
            <div className="profile-guest-actions">
              <button className="btn btn-primary" onClick={() => navigate('/login')}>Sign in</button>
              <button className="btn btn-ghost" onClick={() => navigate('/signup')}>Create account</button>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => !['completed', 'canceled'].includes(o.status)).length;

  return (
    <div className="page">
      <TopBar showSearch={false} title="My account" />

      {/* Hero section */}
      <section className="profile-hero">
        <div className="profile-hero-bg" />
        <div className="profile-hero-content">
          <Avatar src={user.avatar} name={user.name} size={80} className="profile-avatar-lg" />
          <div className="profile-hero-info">
            <h1 className="profile-name">{user.name}</h1>
            <p className="profile-email">{user.email}</p>
            <span className="profile-role-badge">Buyer</span>
          </div>
        </div>
        {/* Stats row */}
        <div className="profile-stats">
          <div className="profile-stat">
            <strong>{orders.length}</strong>
            <span>Orders</span>
          </div>
          <div className="profile-stat">
            <strong>{pendingOrders}</strong>
            <span>Pending</span>
          </div>
          <div className="profile-stat">
            <strong>{wishlistCount}</strong>
            <span>Saved</span>
          </div>
        </div>
      </section>

      <main className="page-main profile-main">
        <section className="profile-section">
          
          <div className="profile-nav-list">
            {PROFILE_NAV.map((item) => (
              <button
                key={item.id}
                className={`profile-nav-row ${item.action ? 'action' : ''}`}
                onClick={() => navigate(item.to)}
                type="button"
              >
                <span className="profile-nav-icon">
                  <item.icon size={20} />
                </span>
                <div className="profile-nav-body">
                  <span className="profile-nav-label">{item.label}</span>
                  <span className="profile-nav-desc">{item.desc}</span>
                </div>
                {item.id === 'orders' && pendingOrders > 0 && (
                  <span className="profile-nav-badge">{pendingOrders}</span>
                )}
                <ChevronRight size={18} className="profile-nav-chev" />
              </button>
            ))}
          </div>
        </section>

        {/* Sign out */}
        <section className="profile-section">
          <button
            className="profile-nav-row danger"
            onClick={onLogout}
            type="button"
          >
            <span className="profile-nav-icon danger">
              <LogOut size={20} />
            </span>
            <div className="profile-nav-body">
              <span className="profile-nav-label">Sign out</span>
              <span className="profile-nav-desc">End this session on this device</span>
            </div>
            <ChevronRight size={18} className="profile-nav-chev" />
          </button>
        </section>

        <Footer />
      </main>

      <BottomNav />
    </div>
  );
}
