import { createContext, useContext, useEffect, useState } from 'react';
import { authApi, setToken, getToken } from '../api/client';

const AuthContext = createContext(null);
const USER_KEY = 'sbay.user';

/**
 * Auth model:
 *   - guest:  not signed in. Can browse anything.
 *   - buyer:  signed-in, default role.
 *   - seller: signed-in and onboarded as a seller.
 *
 * The JWT is held in localStorage under `sbay.token` (see api/client.js)
 * and attached on every request by the axios interceptor. The cached
 * user document is kept under `sbay.user` so the app boots offline-fast,
 * but it's re-validated against `/auth/me` on every mount so role and
 * restriction changes from the admin panel propagate immediately.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) || null; }
    catch { return null; }
  });
  const [booting, setBooting] = useState(!!getToken());

  // Persist user cache for fast boot
  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  // Revalidate against the backend on startup if we have a token. If
  // the token is dead or the account has been restricted, sign out.
  useEffect(() => {
    let alive = true;
    if (!getToken()) { setBooting(false); return; }
    authApi.me()
      .then((fresh) => { if (alive) setUser(fresh); })
      .catch((e) => {
        // Only a definitive auth answer signs the user out. A timeout or
        // network blip (e.g. the API waking from a cold start) keeps the
        // cached session instead of kicking everyone to the login page.
        if (e?.status === 401 || e?.status === 403) {
          setToken(null);
          if (alive) setUser(null);
        }
      })
      .finally(() => { if (alive) setBooting(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async ({ email, password, remember = true }) => {
    if (!email || !password) throw new Error('Provide email and password.');
    const { token, user: u } = await authApi.login({ email, password });
    setToken(token, remember);
    setUser(u);
    return u;
  };

  const signup = async ({ name, email, password, phone, location, role, remember = true }) => {
    const { token, user: u } = await authApi.register({ name, email, password, phone, location, role });
    setToken(token, remember);
    setUser(u);
    return u;
  };

  const logout = () => { setToken(null); setUser(null); };

  const googleLogin = async (credential, remember = true, role) => {
    const { token, user: u } = await authApi.googleAuth(credential, role);
    setToken(token, remember);
    setUser(u);
    return u;
  };

  /** Promote current user to seller via backend. */
  const upgradeToSeller = async (sellerInfo = {}) => {
    const u = await authApi.becomeSeller(sellerInfo);
    setUser(u);
    return u;
  };

  /** Generic profile patch (name, avatar, phone, location). */
  const updateUser = async (patch) => {
    // Optimistic local merge then server reconcile so the UI doesn't
    // wait for the network on simple edits.
    setUser((cur) => (cur ? { ...cur, ...patch } : cur));
    try {
      const fresh = await authApi.updateMe(patch);
      setUser(fresh);
      return fresh;
    } catch (e) {
      // Roll back by re-fetching truth from the server.
      const fresh = await authApi.me().catch(() => null);
      if (fresh) setUser(fresh);
      throw e;
    }
  };

  /**
   * Verification is now an ADMIN-driven flow. `becomeSeller` already
   * queues the application; we expose this helper for legacy pages
   * that still need to refresh status after a manual change.
   */
  const refreshMe = async () => {
    if (!getToken()) return null;
    const fresh = await authApi.me();
    setUser(fresh);
    return fresh;
  };

  /**
   * Password reset — backend endpoints are not yet implemented. We
   * keep the legacy in-memory ticket so the existing /forgot-password
   * flow still works end-to-end in development. Wire to real endpoints
   * when they land.
   */
  const requestPasswordReset = async (email) => {
    if (!email) throw new Error('Enter your email.');
    return authApi.requestPasswordReset(email);
  };

  const resetPassword = async ({ email, token, newPassword }) => {
    if (!email || !token) throw new Error('Reset link is missing or invalid.');
    if (!newPassword || newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
    return authApi.resetPassword({ email, token, newPassword });
  };

  /** Kept for legacy callers — verification is now created by
   *  `upgradeToSeller` and reviewed by an admin. This function only
   *  refreshes local state. */
  const submitVerification = async () => refreshMe();

  return (
    <AuthContext.Provider value={{
      user, booting,
      login, signup, logout, googleLogin,
      upgradeToSeller, updateUser, refreshMe,
      submitVerification,
      requestPasswordReset, resetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
