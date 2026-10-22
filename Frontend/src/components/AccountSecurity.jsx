import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogOut, Trash2, Loader2 } from 'lucide-react';
import { authApi } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { useConfirm } from '../store/ConfirmContext';
import { Notice } from './Feedback';

/**
 * Change-password + sign-out + delete-account, shared by the buyer and
 * seller settings pages. Previously the seller page faked a successful
 * password change, the buyer page never sent the password at all, and
 * both "Delete account" buttons called a function that didn't exist.
 */
export default function AccountSecurity() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user, logout } = useAuth();
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [delErr, setDelErr] = useState('');
  const isSeller = user?.role === 'seller';
  const hasPassword = user?.hasPassword !== false; // Google-only accounts may not have one

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (!pw.current) return setPwMsg({ ok: false, text: 'Enter your current password.' });
    if (pw.next.length < 8) return setPwMsg({ ok: false, text: 'Your new password needs at least 8 characters.' });
    setPwBusy(true);
    try {
      await authApi.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '' });
      setPwMsg({ ok: true, text: 'Password updated.' });
    } catch (err) {
      setPwMsg({ ok: false, text: err.message || "We couldn't update your password." });
    } finally {
      setPwBusy(false);
    }
  };

  const onLogout = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      body: 'You can sign back in at any time.',
      confirmLabel: 'Sign out',
    });
    if (ok) { logout(); navigate('/home'); }
  };

  const onDelete = async () => {
    setDelErr('');
    const ok = await confirm({
      title: 'Delete your account?',
      body: isSeller
        ? 'Your shop and listings will be removed and you will be signed out. You need to finish or cancel any open orders first. This cannot be undone.'
        : 'Your profile will be removed and you will be signed out. This cannot be undone.',
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    try {
      await authApi.deleteMe();
      logout();
      navigate('/home', { replace: true });
    } catch (e) {
      setDelErr(e.message || "We couldn't delete your account. Please try again.");
    }
  };

  return (
    <>
      {hasPassword && (
        <form className="settings-form" onSubmit={changePassword}>
          <section className="card">
            <h3 className="page-h2"><Lock size={16} /> Change password</h3>
            <label className="field">
              <span>Current password</span>
              <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </label>
            <label className="field">
              <span>New password</span>
              <input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="At least 8 characters" minLength={8} maxLength={128} />
            </label>
            {pwMsg && <Notice tone={pwMsg.ok ? 'success' : 'error'} style={{ marginTop: 12 }}>{pwMsg.text}</Notice>}
            <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }} disabled={pwBusy}>
              {pwBusy && <Loader2 size={16} className="spin" />} Update password
            </button>
          </section>
        </form>
      )}

      <section className="card danger-zone">
        <h3 className="page-h2">Account</h3>
        <div className="danger-actions">
          <button className="btn btn-ghost" onClick={onLogout}><LogOut size={16} /> Sign out</button>
          <button className="btn btn-danger" onClick={onDelete}><Trash2 size={16} /> Delete account</button>
        </div>
        {delErr && <Notice tone="error" style={{ marginTop: 10 }}>{delErr}</Notice>}
      </section>
    </>
  );
}
