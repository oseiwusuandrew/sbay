import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import OAuthButtons from '../components/OAuthButtons';
import { useAuth } from '../store/AuthContext';
import { Notice } from '../components/Feedback';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/home';
  const sellerMode = params.get('mode') === 'seller';
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const user = await login({ email: email.trim(), password: pw, remember });
      if (user?.role === 'admin') navigate('/admin', { replace: true });
      else navigate(decodeURIComponent(next), { replace: true });
    } catch (e2) {
      setErr(e2.status === 401 ? 'That email and password don\'t match. Please try again.' : (e2.message || 'Sign-in failed. Please try again.'));
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={sellerMode ? 'Sign in to continue setting up your shop.' : 'Sign in to buy, sell and track your orders.'}
    >
      <form onSubmit={submit} noValidate={false}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <div className="field-input">
            <Mail size={18} className="lead" aria-hidden />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <div className="field-input">
            <Lock size={18} className="lead" aria-hidden />
            <input
              id="login-password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
            />
            <button type="button" className="toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="auth-meta">
          <label className="auth-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Keep me signed in
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        {err && <Notice tone="error">{err}</Notice>}

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? <><Loader2 size={18} className="spin" /> Signing in…</> : 'Sign in'}
        </button>
      </form>

      <OAuthButtons role={sellerMode ? 'seller' : 'buyer'} next={next} remember={remember} />

      <p className="auth-foot">
        New to sBay?{' '}
        <Link to={`/signup?${sellerMode ? 'mode=seller&' : ''}next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </AuthLayout>
  );
}
