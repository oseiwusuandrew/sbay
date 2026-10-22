import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { CartProvider } from './store/CartContext';
import { AuthProvider } from './store/AuthContext';
import { ConfirmProvider } from './store/ConfirmContext';
import { ToastProvider } from './components/Feedback';
import { OrdersProvider } from './store/OrdersContext';
import { LocationProvider } from './store/LocationContext';
import { WishlistProvider } from './store/WishlistContext';
import RequireAuth from './components/RequireAuth';
import ScrollToTop from './components/ScrollToTop';
import FloatingCart from './components/FloatingCart';
import DesktopNav from './components/DesktopNav';
import SupportWidget from './components/SupportWidget';
import NetworkBanner from './components/NetworkBanner';
import InstallPrompt from './components/InstallPrompt';
import { registerServiceWorker, setupInstallPrompt } from './utils/pwa';

// Lazy-load all pages for code splitting — only the active route's JS loads
const Splash          = lazy(() => import('./pages/Splash'));
const Home            = lazy(() => import('./pages/Home'));
const SearchPage      = lazy(() => import('./pages/Search'));
const ProductDetail   = lazy(() => import('./pages/ProductDetail'));
const SellerProfile   = lazy(() => import('./pages/SellerProfile'));
const Cart            = lazy(() => import('./pages/Cart'));
const Checkout        = lazy(() => import('./pages/Checkout'));
const PaymentSuccess  = lazy(() => import('./pages/PaymentSuccess'));
const PaymentFailed   = lazy(() => import('./pages/PaymentFailed'));
const Notifications   = lazy(() => import('./pages/Notifications'));
const ChatList        = lazy(() => import('./pages/ChatList'));
const IndividualChat  = lazy(() => import('./pages/IndividualChat'));
const Sell            = lazy(() => import('./pages/Sell'));
const Profile         = lazy(() => import('./pages/Profile'));
const ProfileOrders   = lazy(() => import('./pages/ProfileOrders'));
const ProfileWishlist = lazy(() => import('./pages/ProfileWishlist'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const Login           = lazy(() => import('./pages/Login'));
const Signup          = lazy(() => import('./pages/Signup'));
const ForgotPassword  = lazy(() => import('./pages/ForgotPassword'));
const BecomeSeller    = lazy(() => import('./pages/BecomeSeller'));
const SellerDashboard    = lazy(() => import('./pages/SellerDashboard'));
const SellerListings    = lazy(() => import('./pages/SellerListings'));
const SellerSales       = lazy(() => import('./pages/SellerSales'));
const Terms             = lazy(() => import('./pages/Terms'));
const SellerSubscription = lazy(() => import('./pages/SellerSubscription'));
const SellerSettings  = lazy(() => import('./pages/SellerSettings'));
const SellerVerification = lazy(() => import('./pages/SellerVerification'));
const Categories      = lazy(() => import('./pages/Categories'));
const Trending        = lazy(() => import('./pages/Trending'));

const AdminLayout      = lazy(() => import('./admin/AdminLayout'));
const AdminDashboard   = lazy(() => import('./admin/AdminDashboard'));
const AdminUsers       = lazy(() => import('./admin/AdminUsers'));
const AdminBuyers      = lazy(() => import('./admin/AdminBuyers'));
const AdminSellers     = lazy(() => import('./admin/AdminSellers'));
const AdminAdmins      = lazy(() => import('./admin/AdminAdmins'));
const AdminSellerDetail = lazy(() => import('./admin/AdminSellerDetail'));
const AdminUserDetail   = lazy(() => import('./admin/AdminUserDetail'));
const AdminProducts    = lazy(() => import('./admin/AdminProducts'));
const AdminOrders      = lazy(() => import('./admin/AdminOrders'));
const AdminPlans       = lazy(() => import('./admin/AdminPlans'));
const AdminSettings    = lazy(() => import('./admin/AdminSettings'));
const AdminAudit       = lazy(() => import('./admin/AdminAudit'));
const AdminChats       = lazy(() => import('./admin/AdminChats'));
const AdminStudentVerification = lazy(() => import('./admin/AdminStudentVerification'));
const AdminSellerVerification  = lazy(() => import('./admin/AdminSellerVerification'));
const AdminSupport     = lazy(() => import('./admin/AdminSupport'));

// AdminProvider stays eager since it wraps a route group
import { AdminProvider } from './admin/AdminContext';

// Minimal loading fallback
function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Register service worker for PWA
    registerServiceWorker();
    // Setup install prompt
    setupInstallPrompt();
  }, []);

  return (
    <AuthProvider>
      <ConfirmProvider>
        <CartProvider>
          <OrdersProvider>
            <LocationProvider>
            <WishlistProvider>
            <BrowserRouter>
              <ToastProvider>
              <ScrollToTop />
              <DesktopNav />
              <NetworkBanner />
              <FloatingCart />
              <SupportWidget />
              <InstallPrompt />
              <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public — anyone can browse */}
                <Route path="/"             element={<Splash />} />
                <Route path="/home"         element={<Home />} />
                <Route path="/search"       element={<SearchPage />} />
                <Route path="/product/:id"  element={<ProductDetail />} />
                <Route path="/seller/:id"   element={<SellerProfile />} />
                <Route path="/cart"         element={<Cart />} />

                {/* Browse by category & trending */}
                <Route path="/categories"        element={<Categories />} />
                <Route path="/category/:catId"   element={<Categories />} />
                <Route path="/trending"          element={<Trending />} />

                {/* Auth */}
                <Route path="/login"           element={<Login />} />
                <Route path="/signup"          element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* Chat — sign-in required */}
                <Route path="/chats"           element={<RequireAuth><ChatList /></RequireAuth>} />
                <Route path="/chat/:id"        element={<RequireAuth><IndividualChat /></RequireAuth>} />

                {/* Sensitive — sign-in required */}
                <Route path="/checkout"        element={<RequireAuth><Checkout /></RequireAuth>} />
                <Route path="/payment-success" element={<RequireAuth><PaymentSuccess /></RequireAuth>} />
                <Route path="/payment-failed"  element={<PaymentFailed />} />
                <Route path="/notifications"   element={<RequireAuth><Notifications /></RequireAuth>} />
                <Route path="/profile"         element={<Profile />} />
                <Route path="/profile/orders"   element={<RequireAuth><ProfileOrders /></RequireAuth>} />
                <Route path="/profile/wishlist" element={<ProfileWishlist />} />
                <Route path="/wishlist"         element={<Navigate to="/profile/wishlist" replace />} />
                <Route path="/profile/settings" element={<RequireAuth><ProfileSettings /></RequireAuth>} />
                <Route path="/orders"           element={<Navigate to="/profile/orders" replace />} />

                {/* Seller flow — auth + seller role */}
                <Route path="/become-seller"    element={<RequireAuth><BecomeSeller /></RequireAuth>} />
                <Route path="/sell"             element={<RequireAuth role="seller"><Sell /></RequireAuth>} />
                <Route path="/seller/listing/:id/edit" element={<RequireAuth role="seller"><Sell /></RequireAuth>} />
                <Route path="/seller-dashboard"           element={<RequireAuth role="seller"><SellerDashboard /></RequireAuth>} />
                <Route path="/seller-dashboard/listings"  element={<RequireAuth role="seller"><SellerListings /></RequireAuth>} />
                <Route path="/seller-dashboard/sales"     element={<RequireAuth role="seller"><SellerSales /></RequireAuth>} />
                <Route path="/seller-dashboard/purchases" element={<Navigate to="/profile/orders" replace />} />
                <Route path="/seller-dashboard/messages"  element={<Navigate to="/chats" replace />} />
                <Route path="/terms"                       element={<Terms />} />
                <Route path="/seller/subscription" element={<RequireAuth role="seller"><SellerSubscription /></RequireAuth>} />
                <Route path="/seller/settings"     element={<RequireAuth role="seller"><SellerSettings /></RequireAuth>} />
                <Route path="/seller/verification" element={<RequireAuth role="seller"><SellerVerification /></RequireAuth>} />

                {/* Admin SPA */}
                <Route path="/admin" element={
                  <AdminProvider><AdminLayout /></AdminProvider>
                }>
                  <Route index           element={<AdminDashboard />} />
                  <Route path="users"                     element={<AdminUsers />} />
                  <Route path="users/buyers"              element={<AdminBuyers />} />
                  <Route path="users/sellers"             element={<AdminSellers />} />
                  <Route path="users/sellers/:id"         element={<AdminSellerDetail />} />
                  <Route path="users/admins"              element={<AdminAdmins />} />
                  <Route path="users/:id"                 element={<AdminUserDetail />} />
                  <Route path="products"                  element={<AdminProducts />} />
                  <Route path="orders"                    element={<AdminOrders />} />
                  <Route path="plans"                     element={<AdminPlans />} />
                  <Route path="chats"                     element={<AdminChats />} />
                  <Route path="verification/students"     element={<AdminStudentVerification />} />
                  <Route path="verification/sellers"      element={<AdminSellerVerification />} />
                  <Route path="support"                   element={<AdminSupport />} />
                  <Route path="audit"                     element={<AdminAudit />} />
                  <Route path="settings"                  element={<AdminSettings />} />
                </Route>

                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
              </Suspense>
              </ToastProvider>
            </BrowserRouter>
            </WishlistProvider>
            </LocationProvider>
          </OrdersProvider>
        </CartProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
