import { useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Phone, Eye, EyeOff, ShoppingBag, Store, Check, X, Loader2 } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import OAuthButtons from '../components/OAuthButtons';
import { useAuth } from '../store/AuthContext';
import { Notice } from '../components/Feedback';

/** Score password strength on length + variety → { score 0..4, label, color, checks }. */
function scorePassword(pw) {
  const checks = {
    length:   pw.length >= 8,
    lengthOk: pw.length >= 12,
    upper:    /[A-Z]/.test(pw),
    lower:    /[a-z]/.test(pw),
    digit:    /[0-9]/.test(pw),
    symbol:   /[^A-Za-z0-9]/.test(pw),
  };
  let score = 0;
  if (checks.length) score++;
  if (checks.upper && checks.lower) score++;
  if (checks.digit) score++;
  if (checks.symbol) score++;
  if (checks.lengthOk && score >= 3) score = 4;
  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const colors = ['#C9372C', '#E07B12', '#D4A20B', '#0A7E3E', '#064A23'];
  return { score, label: labels[score], color: colors[score], checks };
}

export default function Signup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/home';
  const sellerOnly = params.get('mode') === 'seller';
  const { signup } = useAuth();

  const [role, setRole] = useState(sellerOnly ? 'seller' : 'buyer');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const strength = useMemo(() => scorePassword(form.password), [form.password]);
  const passwordsMatch = form.password && form.password === form.confirmPassword;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (strength.score < 2) { setErr('Choose a stronger password: mix letters with numbers or symbols.'); return; }
    if (form.password !== form.confirmPassword) { setErr("The two passwords don't match."); return; }

    setBusy(true);
    try {
      await signup({ name: form.name.trim(), email: form.email.trim(), phone: form.phone, password: form.password, role });
      if (role === 'seller') navigate('/become-seller', { replace: true });
      else navigate(decodeURIComponent(next), { replace: true });
    } catch (e2) {
      setErr(e2.status === 409 ? 'An account with this email already exists. Try signing in instead.' : (e2.message || 'Sign-up failed. Please try again.'));
    } finally { setBusy(false); }
  };

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
              onChange={(e) => set('phone', e.target.value.replace(/\D/g, '').slice(0, 15))}
              placeholder="024 123 4567"
              required
              minLength={9}
            />
          </div>
          <span className="field-hint">We'll text you order updates. We never share your number.</span>
        </div>

        <div className="field">
          <label htmlFor="su-pw">Password</label>
          <div className="field-input">
            <Lock size={18} className="lead" aria-hidden />
            <input id="su-pw" type={show ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 8 characters" required />
            <button type="button" className="toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {form.password && (
            <div className="pw-strength" aria-live="polite">
              <div className="pw-bar">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="pw-seg" style={i < strength.score ? { background: strength.color } : undefined} />
                ))}
              </div>
              <small style={{ color: strength.color, fontWeight: 700 }}>{strength.label}</small>
              <ul className="pw-checks">
                <li className={strength.checks.length ? 'ok' : ''}>{strength.checks.length ? <Check size={12} /> : <X size={12} />} 8+ characters</li>
                <li className={strength.checks.upper && strength.checks.lower ? 'ok' : ''}>{strength.checks.upper && strength.checks.lower ? <Check size={12} /> : <X size={12} />} Upper and lower case</li>
                <li className={strength.checks.digit ? 'ok' : ''}>{strength.checks.digit ? <Check size={12} /> : <X size={12} />} A number</li>
                <li className={strength.checks.symbol ? 'ok' : ''}>{strength.checks.symbol ? <Check size={12} /> : <X size={12} />} A symbol</li>
              </ul>
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="su-pw2">Confirm password</label>
          <div className={`field-input ${form.confirmPassword && !passwordsMatch ? 'has-error' : ''}`}>
            <Lock size={18} className="lead" aria-hidden />
            <input id="su-pw2" type={show ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Type it again" required />
          </div>
          {form.confirmPassword && (
            <span className={`field-note ${passwordsMatch ? 'ok' : 'bad'}`}>
              {passwordsMatch ? <><Check size={12} /> Passwords match</> : <><X size={12} /> Passwords don't match yet</>}
            </span>
          )}
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
