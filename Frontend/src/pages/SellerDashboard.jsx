import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plus, Package, TrendingUp, Wallet, ShieldAlert, Crown, Settings as SettingsIc, LogOut,
  ChevronRight, Store, Clock, ShoppingBag, MessageCircle, Eye,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Avatar from '../components/Avatar';
import Footer from '../components/Footer';
import { productApi, sbay } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { useConfirm } from '../store/ConfirmContext';
import { useOrders } from '../store/OrdersContext';
import { ghs } from '../utils/money';
import './pages.css';
import './SellerDashboard.css';

/** The plan in force today; a paid plan lapses to Free when its period ends. */
const planCodeOf = (user) => {
  const sub = user?.subscription;
  if (!sub?.plan || sub.plan === 'free' || !sub.renewsAt || new Date(sub.renewsAt) < new Date()) return 'free';
  return sub.plan;
};

function NavRow({ to, icon: Icon, label, desc, badge, tone }) {
  return (
    <Link to={to} className={`sd-nav-row ${tone || ''}`}>
      <span className="sd-nav-ic"><Icon size={19} /></span>
      <span className="sd-nav-body">
        <strong>{label}</strong>
        {desc && <span className="muted small">{desc}</span>}
      </span>
      {badge > 0 && <span className="sd-nav-badge">{badge}</span>}
      <ChevronRight size={18} className="sd-nav-chev" aria-hidden="true" />
    </Link>
  );
}

/** Seller home: what needs doing, how the shop is doing, and links to everything else. */
export default function SellerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const { myOrders: purchases, salesOrders } = useOrders();
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    productApi.myStats().then(setStats).catch(() => setStats({}));
    sbay.getPlans().then(setPlans).catch(() => {});
  }, []);

  const planCode = planCodeOf(user);
  const plan = plans.find((p) => p.code === planCode);
  const active = Number(stats?.activeListings) || 0;
  const views = Number(stats?.views) || 0;
  const earned = useMemo(() => salesOrders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + (Number(o.subtotal ?? (Number(o.total) - Number(o.fee))) || 0), 0), [salesOrders]);
  const toHandle = salesOrders.filter((o) => ['pending', 'processing', 'shipped'].includes(o.status)).length;
  const awaitingBuyer = salesOrders.filter((o) => o.status === 'delivered').length;
  const openPurchases = purchases.filter((p) => !['completed', 'canceled'].includes(p.status)).length;
  const verification = user?.verification?.status || (user?.verified ? 'verified' : 'unverified');
  const storeName = user?.sellerProfile?.storeName || user?.name || 'Your shop';
  const atLimit = plan?.maxListings && active >= plan.maxListings;

  const onLogout = async () => {
    const ok = await confirm({ title: 'Sign out?', body: 'You can sign back in at any time.', confirmLabel: 'Sign out' });
    if (ok) { logout(); navigate('/home'); }
  };

  const tasks = [
    toHandle > 0 && {
      to: '/seller-dashboard/sales', icon: TrendingUp, tone: 'is-warn',
      label: `${toHandle} order${toHandle === 1 ? '' : 's'} to handle`,
      desc: 'Confirm, arrange the hand-over, then mark as delivered',
    },
    awaitingBuyer > 0 && {
      to: '/seller-dashboard/sales', icon: Clock,
      label: `${awaitingBuyer} waiting for the buyer`,
      desc: "You're paid once they confirm they have the item",
    },
    verification === 'rejected' && {
      to: '/seller/verification', icon: ShieldAlert, tone: 'is-bad',
      label: 'Verification not approved', desc: user?.verification?.reason || 'Send your details again',
    },
    verification === 'unverified' && {
      to: '/seller/verification', icon: ShieldAlert,
      label: 'Get verified', desc: 'Verified shops get a badge buyers trust',
    },
    verification === 'pending' && {
      to: '/seller/verification', icon: Clock,
      label: 'Verification under review', desc: "We'll let you know when it's done",
    },
    atLimit && {
      to: '/seller/subscription', icon: Crown, tone: 'is-warn',
      label: `You've used all ${plan.maxListings} listings on ${plan.name}`, desc: 'Upgrade, or mark something as sold to list more',
    },
  ].filter(Boolean);

  return (
    <div className="page">
      <TopBar showSearch={false} title="Seller dashboard" />

      <main className="page-main sd-main">
        <section className="sd-hero">
          <div className="sd-hero-left">
            <Avatar src={user?.avatar} name={storeName} size={52} />
            <div>
              <h1 className="sd-hero-name">{storeName}</h1>
              <Link to={`/seller/${user?.id}`} className="sd-hero-link">View your shop</Link>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/sell')} disabled={atLimit}>
            <Plus size={16} /> New listing
          </button>
        </section>

        <section className="sd-stats" aria-label="Shop at a glance">
          <div className="sd-stat">
            <span className="sd-stat-ic"><Package size={17} /></span>
            <strong>{stats ? active : '–'}{plan?.maxListings ? <small> / {plan.maxListings}</small> : null}</strong>
            <span>Active listings</span>
            {plan?.maxListings ? (
              <span className="sd-meter" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (active / plan.maxListings) * 100)}%` }} />
              </span>
            ) : null}
          </div>
          <div className="sd-stat">
            <span className="sd-stat-ic"><Eye size={17} /></span>
            <strong>{stats ? views.toLocaleString() : '–'}</strong>
            <span>Listing views</span>
          </div>
          <div className="sd-stat">
            <span className="sd-stat-ic"><Wallet size={17} /></span>
            <strong>{ghs(earned)}</strong>
            <span>Earned from completed sales</span>
          </div>
        </section>

        <div className="sd-cols">
          <div className="sd-col">
            {tasks.length > 0 && (
              <section>
                <h2 className="sd-section-label">Needs your attention</h2>
                <div className="sd-nav-list">
                  {tasks.map((t) => <NavRow key={t.label} {...t} />)}
                </div>
              </section>
            )}

            <section>
              <h2 className="sd-section-label">Your shop</h2>
              <div className="sd-nav-list">
                <NavRow to="/seller-dashboard/listings" icon={Package} label="Listings" desc={`${active} active`} />
                <NavRow to="/seller-dashboard/sales" icon={TrendingUp} label="Orders from buyers" desc="Everything you've sold" badge={toHandle} />
                <NavRow to="/chats" icon={MessageCircle} label="Messages" desc="Chats with buyers and sellers" />
              </div>
            </section>
          </div>

          <div className="sd-col">
            <section>
              <h2 className="sd-section-label">Account</h2>
              <div className="sd-nav-list">
                <NavRow
                  to="/seller/subscription"
                  icon={Crown}
                  label="Plan"
                  desc={`${plan?.name || 'Free'}${plan?.feePct != null ? ` · buyers pay ${plan.feePct}% fee` : ''}`}
                />
                <NavRow to="/profile/orders" icon={ShoppingBag} label="My purchases" desc="Things you've bought" badge={openPurchases} />
                <NavRow to="/seller/settings" icon={SettingsIc} label="Shop settings" desc="Shop details, payouts and password" />
                <NavRow to={`/seller/${user?.id}`} icon={Store} label="Your public shop" desc="What buyers see" />
                <button type="button" className="sd-nav-row is-bad" onClick={onLogout}>
                  <span className="sd-nav-ic"><LogOut size={19} /></span>
                  <span className="sd-nav-body"><strong>Sign out</strong></span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
