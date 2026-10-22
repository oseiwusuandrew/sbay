import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Camera, GraduationCap, Briefcase, Loader2, Store } from 'lucide-react';
import AuthLayout from '../components/AuthLayout';
import { Notice, useToast } from '../components/Feedback';
import { useAuth } from '../store/AuthContext';
import { resizeImage } from '../utils/image';
import './BecomeSeller.css';

const NETWORKS = [
  ['mtn-momo', 'MTN MoMo'],
  ['vodafone-cash', 'Telecel Cash'],
  ['airteltigo-money', 'AirtelTigo Money'],
  ['bank', 'Bank account'],
];

function problems(form, idCard) {
  const e = {};
  if (form.storeName.trim().length < 2) e.storeName = 'Give your shop a name.';
  if (form.isStudent) {
    if (!form.university.trim()) e.university = 'Enter your university.';
    if (!idCard) e.idCard = 'Add a photo of your student ID.';
  } else if (!form.occupation.trim()) {
    e.occupation = 'Tell us what you do.';
  }
  const digits = form.payoutAccount.replace(/\D/g, '');
  if (form.payoutMethod === 'bank' ? !/^\d{9,16}$/.test(digits) : !/^0[2-5]\d{8}$/.test(digits)) {
    e.payoutAccount = form.payoutMethod === 'bank' ? 'Enter the account number (9 to 16 digits).' : 'Enter the 10-digit MoMo number, e.g. 024 123 4567.';
  }
  if (form.payoutName.trim().length < 2) e.payoutName = 'Enter the name on the account.';
  if (!form.agreed) e.agreed = 'Please agree to continue.';
  return e;
}

/**
 * Open a shop: name, verification details and where to get paid, on one
 * page. The shop is usable straight away; the sBay team reviews the
 * verification and adds the badge.
 */
export default function BecomeSeller() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, upgradeToSeller } = useAuth();
  const [form, setForm] = useState({
    storeName: '', bio: '',
    isStudent: true, university: '', occupation: '', businessReg: '',
    payoutMethod: 'mtn-momo', payoutAccount: user?.phone || '', payoutName: user?.name || '',
    agreed: false,
  });
  const [idCard, setIdCard] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user?.role === 'seller') return <Navigate to="/seller-dashboard" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const errors = problems(form, idCard);
  const show = (k) => touched && errors[k];

  const pickIdCard = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setIdCard(await resizeImage(file, 1600, 0.85)); }
    catch (ex) { setError(ex.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await upgradeToSeller({
        storeName: form.storeName.trim(),
        bio: form.bio.trim() || undefined,
        isStudent: form.isStudent,
        university: form.isStudent ? form.university.trim() : undefined,
        occupation: form.isStudent ? undefined : form.occupation.trim(),
        businessReg: form.isStudent ? undefined : form.businessReg.trim() || undefined,
        location: form.isStudent ? form.university.trim() : user?.location || undefined,
        payout: {
          method: form.payoutMethod,
          account: form.payoutAccount.replace(/\D/g, ''),
          accountName: form.payoutName.trim(),
        },
        idCardUrl: form.isStudent ? idCard : undefined,
      });
      toast.success('Your shop is open. We\'ll review your verification shortly.');
      navigate('/seller-dashboard', { replace: true });
    } catch (ex) {
      setError(ex.message || 'Could not open your shop. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Open your shop"
      subtitle="It takes a couple of minutes. You can start listing as soon as you're done."
      aside={{ title: "Turn the things you don't need into cash.", text: 'List in a minute, meet buyers on your campus, and get paid to your MoMo once they confirm.' }}
    >
      <form className="bs-form" onSubmit={submit} noValidate>
        <section className="bs-sec">
          <h2><Store size={16} aria-hidden="true" /> Your shop</h2>
          <label className="field">
            <span>Shop name</span>
            <input value={form.storeName} onChange={set('storeName')} maxLength={80} placeholder="e.g. Kofi's Gadgets" aria-invalid={!!show('storeName')} />
            {show('storeName') && <span className="field-error">{errors.storeName}</span>}
          </label>
          <label className="field">
            <span>What do you sell? <em className="muted">optional</em></span>
            <input value={form.bio} onChange={set('bio')} maxLength={200} placeholder="e.g. Phones, chargers and laptop accessories" />
          </label>
        </section>

        <section className="bs-sec">
          <h2>Verification</h2>
          <p className="muted small">Only the sBay team sees this. Verified shops get a badge buyers trust.</p>
          <div className="seg" role="radiogroup" aria-label="Are you a student?">
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
                <input value={form.university} onChange={set('university')} maxLength={120} placeholder="e.g. University of Ghana" aria-invalid={!!show('university')} />
                {show('university') && <span className="field-error">{errors.university}</span>}
              </label>
              <div className="field">
                <span>Student ID card</span>
                <label className={`bs-upload ${idCard ? 'has' : ''} ${show('idCard') ? 'has-error' : ''}`}>
                  {idCard ? <img src={idCard} alt="Your student ID" /> : (
                    <>
                      <Camera size={22} aria-hidden="true" />
                      <strong>Add a photo of your student ID</strong>
                      <span className="muted small">Your name and photo should be readable</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={pickIdCard} hidden />
                </label>
                {show('idCard') && <span className="field-error">{errors.idCard}</span>}
              </div>
            </>
          ) : (
            <>
              <label className="field">
                <span>What do you do?</span>
                <input value={form.occupation} onChange={set('occupation')} maxLength={120} placeholder="e.g. Phone accessories trader" aria-invalid={!!show('occupation')} />
                {show('occupation') && <span className="field-error">{errors.occupation}</span>}
              </label>
              <label className="field">
                <span>Business registration number <em className="muted">optional</em></span>
                <input value={form.businessReg} onChange={set('businessReg')} maxLength={80} />
              </label>
            </>
          )}
        </section>

        <section className="bs-sec">
          <h2>Where to pay you</h2>
          <label className="field">
            <span>Payout method</span>
            <select value={form.payoutMethod} onChange={set('payoutMethod')}>
              {NETWORKS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <div className="bs-row">
            <label className="field">
              <span>{form.payoutMethod === 'bank' ? 'Account number' : 'MoMo number'}</span>
              <input inputMode="numeric" value={form.payoutAccount} onChange={set('payoutAccount')} placeholder={form.payoutMethod === 'bank' ? 'Account number' : '024 123 4567'} aria-invalid={!!show('payoutAccount')} />
              {show('payoutAccount') && <span className="field-error">{errors.payoutAccount}</span>}
            </label>
            <label className="field">
              <span>Name on the account</span>
              <input value={form.payoutName} onChange={set('payoutName')} maxLength={80} aria-invalid={!!show('payoutName')} />
              {show('payoutName') && <span className="field-error">{errors.payoutName}</span>}
            </label>
          </div>
        </section>

        <label className={`bs-agree ${show('agreed') ? 'has-error' : ''}`}>
          <input type="checkbox" checked={form.agreed} onChange={set('agreed')} />
          <span>I agree to the <Link to="/terms" target="_blank">terms of use</Link> and have read the <Link to="/privacy" target="_blank">privacy notice</Link>.</span>
        </label>

        {touched && Object.keys(errors).length > 0 && <Notice tone="error">Some details are missing. Check the highlighted fields.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? <><Loader2 size={18} className="spin" /> Opening your shop…</> : 'Open my shop'}
        </button>
      </form>
    </AuthLayout>
  );
}
