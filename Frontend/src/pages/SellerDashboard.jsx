import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Package, TrendingUp, Wallet,
  ShieldAlert, Crown, Settings as SettingsIc, LogOut, ChevronRight, Store, Clock,
  ShoppingBag, MessageCircle, BarChart2,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Avatar from '../components/Avatar';
import Footer from '../components/Footer';
import { productApi } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { useConfirm } from '../store/ConfirmContext';
import { useOrders } from '../store/OrdersContext';
import './pages.css';
import './SellerDashboard.css';

const PLAN_LABEL = { free: 'Free', plus: 'Plus', pro: 'Pro' };

export default function SellerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const [listings, setListings] = useState([]);
  const [listingStats, setListingStats] = useState({ listings: 0, activeListings: 0, views: 0, sold: 0 });
  const { myOrders: purchases, salesOrders } = useOrders();

  useEffect(() => {
    let alive = true;
    Promise.allSettled([productApi.mine(), productApi.myStats()])
      .then(([listingsRes, statsRes]) => {
        if (!alive) return;
        const nextListings = listingsRes.status === 'fulfilled' ? listingsRes.value : [];
        setListings(nextListings);
        setListingStats(statsRes.status === 'fulfilled'
          ? statsRes.value
          : {
            listings: nextListings.length,
            activeListings: nextListings.filter((item) => item.status === 'active').length,
            views: nextListings.reduce((sum, item) => sum + (Number(item.views) || 0), 0),
            sold: nextListings.reduce((sum, item) => sum + (Number(item.sold) || 0), 0),
          });
      });
    return () => { alive = false; };
  }, []);

  const onLogout = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      body: 'You will need to sign in again to access your seller dashboard.',
      confirmLabel: 'Sign out',
      danger: true,
    });
    if (ok) { logout(); navigate('/'); }
  };

  const totalEarnings = salesOrders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + (Number(o.total) || 0) - (Number(o.fee) || 0), 0);
  const activeListingCount = Number(listingStats.activeListings ?? listings.length) || 0;
  const profileViews = Number(listingStats.views) || 0;
  const pendingSales = salesOrders.filter(
    (o) => !['delivered', 'completed', 'canceled'].includes(o.status)
  ).length;
  const pendingPurchases = purchases.filter((p) => p.status !== 'completed').length;
  const verificationStatus = user?.verification?.status || (user?.verified ? 'verified' : 'unverified');
  const planId = user?.subscription?.plan || 'free';
  const storeName = user?.sellerProfile?.storeName || user?.name || 'Seller';

  const MANAGE_ITEMS = [
    {
      path: '/seller-dashboard/listings',
      icon: Package,
      label: 'My listings',
      desc: `${activeListingCount} active listing${activeListingCount !== 1 ? 's' : ''}`,
      badge: 0,
    },
    {
      path: '/seller-dashboard/sales',
      icon: TrendingUp,
      label: 'Incoming orders',
      desc: 'Manage & fulfil buyer orders',
      badge: pendingSales,
    },
    {
      path: '/seller-dashboard/purchases',
      icon: ShoppingBag,
      label: 'My purchases',
      desc: 'Track items you bought',
      badge: pendingPurchases,
    },
    {
      path: '/seller-dashboard/messages',
      icon: MessageCircle,
      label: 'Buyer messages',
      desc: 'Chat with your buyers',
      badge: 0,
    },
  ];

  const ACCOUNT_ITEMS = [
    {
      path: '/seller/subscription',
      icon: Crown,
      label: 'Subscription',
      desc: `Current plan: ${PLAN_LABEL[planId]}${user?.subscription?.status === 'canceled' ? ' · canceling' : ''}`,
    },
    {
      path: `/seller/${user?.id || 's1'}`,
      icon: Store,
      label: 'View public store',
      desc: 'See what buyers see',
    },
    {
      path: '/seller/settings',
      icon: SettingsIc,
      label: 'Settings',
      desc: 'Store, payouts, password & more',
    },
  ];

  return (
    <div className="page">
      <TopBar showSearch={false} title="Seller dashboard" />

      <main className="page-main sd-page-main">
        {/* Hero */}
        <section className="sd-hero">
          <div className="sd-hero-left">
            <Avatar src={user?.avatar} name={storeName} size={52} />
            <div>
              <p className="sd-hero-welcome">Welcome back,</p>
              <h2 className="sd-hero-name">{storeName}</h2>
            </div>
          </div>
          <button className="btn btn-primary sd-new-listing-btn" onClick={() => navigate('/sell')}>
            <Plus size={16} /> New listing
          </button>
        </section>

        {/* Stats */}
        <section className="sd-stats">
          {[
            { icon: Package,   label: 'Listings',      value: activeListingCount },
            { icon: BarChart2, label: 'Listing views',  value: profileViews.toLocaleString() },
            { icon: Wallet,    label: 'Earnings',       value: `GH₵ ${totalEarnings.toLocaleString()}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="stat">
              <span className="ic"><Icon size={18} /></span>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        {/* Verification banner */}
        {verificationStatus !== 'verified' && (
          <div className={`sd-verify-banner ${verificationStatus === 'pending' ? 'is-pending' : 'is-warn'}`}>
            <span className="sd-verify-ic">
              {verificationStatus === 'pending' ? <Clock size={18} /> : <ShieldAlert size={18} />}
            </span>
            <div>
              <strong>
                {verificationStatus === 'pending' && 'Verification pending'}
                {verificationStatus === 'rejected' && 'Verification rejected'}
                {verificationStatus === 'unverified' && 'Not verified yet'}
              </strong>
              <p className="muted small">
                {verificationStatus === 'pending' && "Our admins are reviewing your application. You'll see a Verified badge once approved."}
                {verificationStatus === 'rejected' && (user?.verification?.reason || 'Please contact support to update your details.')}
                {verificationStatus === 'unverified' && 'Complete your seller registration so admins can review your account.'}
              </p>
            </div>
          </div>
        )}

        {/* Manage — list rows */}
        <section>
          <h3 className="sd-section-label">Manage</h3>
          <div className="sd-nav-list">
            {MANAGE_ITEMS.map(({ path, icon: Icon, label, desc, badge }, i) => (
              <motion.button
                key={path}
                className="sd-nav-row"
                onClick={() => navigate(path)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                type="button"
              >
                <span className="sd-nav-ic"><Icon size={20} /></span>
                <div className="sd-nav-body">
                  <strong>{label}</strong>
                  <p className="muted small">{desc}</p>
                </div>
                {badge > 0 && <span className="sd-nav-badge">{badge}</span>}
                <ChevronRight size={18} className="muted" />
              </motion.button>
            ))}
          </div>
        </section>

        {/* Account links */}
        <section>
          <h3 className="sd-section-label">Account</h3>
          <div className="sd-nav-list">
            {ACCOUNT_ITEMS.map(({ path, icon: Icon, label, desc }) => (
              <button
                key={path}
                className="sd-nav-row"
                onClick={() => navigate(path)}
                type="button"
              >
                <span className="sd-nav-ic account"><Icon size={20} /></span>
                <div className="sd-nav-body">
                  <strong>{label}</strong>
                  <p className="muted small">{desc}</p>
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
            ))}

            <button className="sd-nav-row danger" onClick={onLogout} type="button">
              <span className="sd-nav-ic danger"><LogOut size={20} /></span>
              <div className="sd-nav-body">
                <strong>Sign out</strong>
                <p className="muted small">End this session on this device</p>
              </div>
              <ChevronRight size={18} className="muted" />
            </button>
          </div>
        </section>

        <Footer />
      </main>

      <BottomNav />
    </div>
  );
}
