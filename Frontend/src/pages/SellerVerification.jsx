import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ShieldCheck, ShieldAlert, Clock, Loader2, GraduationCap, Briefcase } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { Notice, useToast } from '../components/Feedback';
import { useAuth } from '../store/AuthContext';
import { authApi } from '../api/client';
import { resizeImage } from '../utils/image';
import './pages.css';
import './SellerVerification.css';

const STATUS = {
  verified: { icon: ShieldCheck, title: "You're verified", text: 'Buyers see the verified badge on your shop and listings.' },
  pending: { icon: Clock, title: 'Under review', text: 'The sBay team reviews applications within a day or two. Your shop stays open meanwhile.' },
  rejected: { icon: ShieldAlert, title: 'Verification was not approved', text: null },
  unverified: { icon: ShieldAlert, title: 'Not verified yet', text: 'Verified shops get a badge that buyers look for. It only takes a minute.' },
};

/**
 * Seller verification status, and the form to apply again after a
 * rejection. Sends exactly what the admin review uses: student ID photo
 * and university for students, occupation for everyone else.
 */
export default function SellerVerification() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, refreshMe } = useAuth();
  const status = user?.verification?.status || (user?.verified ? 'verified' : 'unverified');
  const [applying, setApplying] = useState(false);

  const [form, setForm] = useState(() => ({
    isStudent: user?.verification?.isStudent ?? true,
    university: user?.verification?.university || '',
    occupation: user?.verification?.occupation || '',
    businessReg: user?.verification?.businessReg || '',
  }));
  const [idCard, setIdCard] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickIdCard = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setIdCard(await resizeImage(file, 1600, 0.85)); }
    catch (ex) { setErr(ex.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (form.isStudent && (!form.university.trim() || !idCard)) {
      setErr('Add your university and a photo of your student ID.');
      return;
    }
    if (!form.isStudent && !form.occupation.trim()) {
      setErr('Tell us what you do.');
      return;
    }
    setBusy(true);
    try {
      await authApi.resubmitVerification({
        isStudent: form.isStudent,
        university: form.isStudent ? form.university.trim() : undefined,
        occupation: form.isStudent ? undefined : form.occupation.trim(),
        businessReg: form.isStudent ? undefined : form.businessReg.trim() || undefined,
        idCardUrl: form.isStudent ? idCard : undefined,
      });
      await refreshMe();
      setApplying(false);
      toast.success('Sent for review');
    } catch (ex) {
      setErr(ex.message || 'Could not send your details. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const info = STATUS[status] || STATUS.unverified;
  const Icon = info.icon;
  const canApply = status === 'rejected' || status === 'unverified';

  return (
    <div className="page">
      <TopBar showBack showSearch={false} title="Verification" />
      <main className="page-main vf-page">
        {!applying ? (
          <section className={`vf-status vf-${status}`}>
            <span className="vf-status-ic"><Icon size={40} /></span>
            <h2>{info.title}</h2>
            <p className="muted">
              {info.text || user?.verification?.reason || 'Some details could not be confirmed. You can send them again.'}
            </p>
            {canApply ? (
              <button className="btn btn-primary" onClick={() => setApplying(true)}>
                {status === 'rejected' ? 'Send details again' : 'Get verified'}
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={() => navigate('/seller-dashboard')}>Back to dashboard</button>
            )}
          </section>
        ) : (
          <form className="card vf-form" onSubmit={submit}>
            <h2 className="page-h2">Verification details</h2>
            <p className="muted small">Only the sBay team sees these. They are never shown on your shop.</p>

            <div className="seg vf-choice" role="radiogroup" aria-label="Are you a student?">
              <button type="button" role="radio" aria-checked={form.isStudent} className={form.isStudent ? 'active' : ''}
                onClick={() => setForm((f) => ({ ...f, isStudent: true }))}>
                <GraduationCap size={16} /> I'm a student
              </button>
              <button type="button" role="radio" aria-checked={!form.isStudent} className={!form.isStudent ? 'active' : ''}
                onClick={() => setForm((f) => ({ ...f, isStudent: false }))}>
                <Briefcase size={16} /> I'm not a student
              </button>
            </div>

            {form.isStudent ? (
              <>
                <label className="field">
                  <span>University</span>
                  <input value={form.university} onChange={set('university')} placeholder="e.g. University of Ghana" maxLength={120} />
                </label>
                <div className="field">
                  <span>Student ID card</span>
                  <label className={`vf-upload ${idCard ? 'has' : ''}`}>
                    {idCard ? <img src={idCard} alt="Your student ID" /> : (
                      <>
                        <Camera size={24} aria-hidden="true" />
                        <strong>Add a photo of your student ID</strong>
                        <span className="muted small">Make sure your name and photo are readable</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={pickIdCard} hidden />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label className="field">
                  <span>What do you do?</span>
                  <input value={form.occupation} onChange={set('occupation')} placeholder="e.g. Phone accessories trader" maxLength={120} />
                </label>
                <label className="field">
                  <span>Business registration number <em className="muted">optional</em></span>
                  <input value={form.businessReg} onChange={set('businessReg')} placeholder="If your business is registered" maxLength={80} />
                </label>
              </>
            )}

            {err && <Notice tone="error">{err}</Notice>}

            <div className="vf-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setApplying(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? <><Loader2 size={16} className="spin" /> Sending…</> : 'Send for review'}
              </button>
            </div>
          </form>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
