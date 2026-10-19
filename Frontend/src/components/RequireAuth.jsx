import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

/**
 * Wrap any sensitive route with <RequireAuth>. Guests are redirected to
 * /login with a `next` param so we can return them after sign-in.
 *
 * While the stored session is still being checked we wait instead of
 * redirecting — otherwise a signed-in user without a cached profile
 * (e.g. arriving back from Paystack) was bounced to the login page.
 */
export default function RequireAuth({ children, role }) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (!user && booting) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading">
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (role === 'seller' && user.role !== 'seller') {
    return <Navigate to="/become-seller" replace />;
  }
  return children;
}
