import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../store/AuthContext';
import { Notice } from '../components/Feedback';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const emailFromLink = params.get('email') || '';
  const { requestPasswordReset, resetPassword } = useAuth();

  const [email, setEmail] = useState(emailFromLink);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState('');
  const [done, setDone] = useState(false);

  const sendLink = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const res = await requestPasswordReset(email.trim());
      setDevLink(res.resetUrl || '');
      setSent(true);
    } catch (e2) {
      setErr(e2.message || "We couldn't send the reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    setBusy(true);
    try {
      await resetPassword({ email: email.trim(), token, newPassword: pw });
      setDone(true);
    } catch (e2) {
      setErr(e2.message || "We couldn't reset your password. The link may have expired.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthLayout>
        <div className="auth-done">
          <CheckCircle2 size={52} className="auth-done-ic" />
          <h1 className="auth-title">Password updated</h1>
          <p className="lede">You can now sign in with your new password.</p>
          <button className="btn btn-primary auth-submit" type="button" onClick={() => navigate('/login', { replace: true })}>
            Go to sign in
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (token) {
    return (
      <AuthLayout title="Choose a new password" subtitle={`For ${email || 'your account'}.`}>
        <form onSubmit={savePassword}>
          <div className="field">
            <label htmlFor="fp-pw">New password</label>
            <div className="field-input">
              <Lock size={18} className="lead" aria-hidden />
              <input id="fp-pw" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required autoFocus />
              <button type="button" className="toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <span className="field-hint">A short phrase is easy to remember and hard to guess.</span>
          </div>
          {err && <Notice tone="error">{err}</Notice>}
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? <><Loader2 size={18} className="spin" /> Saving…</> : 'Save new password'}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a link to choose a new password."
    >
      {sent ? (
        <div className="auth-done">
          <MailCheck size={48} className="auth-done-ic" />
          <h2 className="auth-title" style={{ fontSize: '1.3rem' }}>Check your inbox</h2>
          <p className="lede">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 30 minutes.
            Can't find it? Check your spam folder.
          </p>
          {devLink && <Notice tone="info"><a href={devLink}>Open reset link (development only)</a></Notice>}
          <button className="btn btn-ghost auth-submit" type="button" onClick={() => setSent(false)}>Use a different email</button>
        </div>
      ) : (
        <form onSubmit={sendLink}>
          <div className="field">
            <label htmlFor="fp-email">Email</label>
            <div className="field-input">
              <Mail size={18} className="lead" aria-hidden />
              <input id="fp-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
          </div>
          {err && <Notice tone="error">{err}</Notice>}
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? <><Loader2 size={18} className="spin" /> Sending…</> : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="auth-foot">
        Remembered it? <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
