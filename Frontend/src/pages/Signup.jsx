import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, ShoppingBag, Store, Loader2 } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import OAuthButtons from '../components/OAuthButtons';
import { useAuth } from '../store/AuthContext';
import { Notice } from '../components/Feedback';

/** "0241234567" → "024 123 4567" while typing. */
const formatPhone = (digits) => digits.replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' '));

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/home';
  const sellerOnly = params.get('mode') === 'seller';
  const { signup, user, booting } = useAuth();
  // Someone who opens this page while already signed in goes straight on.
  const [arrivedSignedIn] = useState(() => Boolean(user) || booting);

  const [role, setRole] = useState(sellerOnly ? 'seller' : 'buyer');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const phoneDigits = form.phone.replace(/\D/g, '');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!/^0[2-5]\d{8}$/.test(phoneDigits)) { setErr('Enter a Ghanaian phone number, e.g. 024 123 4567.'); return; }
    if (form.password.length < 8) { setErr('Use at least 8 characters for your password.'); return; }

    setBusy(true);
    try {
      await signup({ name: form.name.trim(), email: form.email.trim(), phone: phoneDigits, password: form.password, role });
      if (role === 'seller') navigate('/become-seller', { replace: true });
      else navigate(decodeURIComponent(next), { replace: true });
    } catch (e2) {
      setErr(e2.status === 409 ? 'An account with this email already exists. Try signing in instead.' : (e2.message || 'Sign-up failed. Please try again.'));
    } finally { setBusy(false); }
  };

  if (arrivedSignedIn && user) {
    return <Navigate to={sellerOnly && user.role !== 'seller' ? '/become-seller' : decodeURIComponent(next)} replace />;
  }

  return (
    <AuthLayout
      title={sellerOnly ? 'Open your sBay shop' : 'Create your account'}
      subtitle={sellerOnly ? 'Start with an account. Next, we\'ll set up your shop and payout details.' : 'It takes less than a minute.'}
      aside={role === 'seller'
        ? { title: 'Turn the things you don\'t need into cash.', text: 'List in a minute, meet buyers on your campus, and get paid to your MoMo once they confirm.' }
        : undefined}
    >
      <form onSubmit={submit}>
        {!sellerOnly && (
          <div className="role-grid" role="radiogroup" aria-label="Account type">
            <button type="button" role="radio" aria-checked={role === 'buyer'} className={`role-card ${role === 'buyer' ? 'active' : ''}`} onClick={() => setRole('buyer')}>
              <span className="role-emo"><ShoppingBag size={18} /></span>
              <strong>I want to buy</strong>
              <span>Shop deals on campus</span>
            </button>
            <button type="button" role="radio" aria-checked={role === 'seller'} className={`role-card ${role === 'seller' ? 'active' : ''}`} onClick={() => setRole('seller')}>
              <span className="role-emo"><Store size={18} /></span>
              <strong>I want to sell</strong>
              <span>Open a shop and get paid</span>
            </button>
          </div>
        )}

        <div className="field">
          <label htmlFor="su-name">Full name</label>
          <div className="field-input">
            <User size={18} className="lead" aria-hidden />
            <input id="su-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ama Mensah" required minLength={2} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="su-email">Email</label>
          <div className="field-input">
            <Mail size={18} className="lead" aria-hidden />
            <input id="su-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@example.com" required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="su-phone">Phone number</label>
          <div className="field-input">
            <Phone size={18} className="lead" aria-hidden />
            <input
              id="su-phone"
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => set('phone', formatPhone(e.target.value.replace(/\D/g, '').slice(0, 10)))}
              placeholder="024 123 4567"
              required
            />
          </div>
          <span className="field-hint">For order updates and meet-ups. Never shown publicly.</span>
        </div>

        <div className="field">
          <label htmlFor="su-pw">Password</label>
          <div className="field-input">
            <Lock size={18} className="lead" aria-hidden />
            <input
              id="su-pw"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              maxLength={128}
              required
            />
            <button type="button" className="toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span className="field-hint">A short phrase is easy to remember and hard to guess.</span>
        </div>

        {err && <Notice tone="error">{err}</Notice>}

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? <><Loader2 size={18} className="spin" /> Creating your account…</> : (role === 'seller' ? 'Continue to shop setup' : 'Create account')}
        </button>
        <p className="auth-legal">
          By continuing you agree to sBay's <Link to="/terms">Terms and escrow policy</Link>.
        </p>
      </form>

      <OAuthButtons role={role} next={next} />

      <p className="auth-foot">
        Already have an account? <Link to={`/login?${sellerOnly ? 'mode=seller&' : ''}next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
    </AuthLayout>
  );
}
