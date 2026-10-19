import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, GraduationCap, Briefcase, Upload, Shield, Clock,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../store/AuthContext';
import './Auth.css';
import './BecomeSeller.css';

const STEPS = ['Details', 'About You', 'Verification', 'Payout', 'Terms'];

export default function BecomeSeller() {
  const navigate = useNavigate();
  const { user, upgradeToSeller } = useAuth();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    storeName: '',
    bio: '',
    isStudent: null, // true | false
    university: '',
    studentId: null, // file
    occupation: '',
    businessReg: '',
    payoutMethod: 'mtn-momo',
    payoutAccount: '',
    payoutName: user?.name || '',
    agreedTerms: false,
    agreedPrivacy: false,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const canNext = () => {
    if (step === 0) return form.storeName.trim().length >= 2;
    if (step === 1) return form.isStudent !== null;
    if (step === 2) {
      return form.isStudent
        ? !!form.studentId && !!form.university
        : !!form.occupation;
    }
    if (step === 3) return form.payoutAccount.replace(/\D/g, '').length >= 9 && form.payoutName.trim().length >= 2;
    if (step === 4) return form.agreedTerms && form.agreedPrivacy;
    return true;
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  /** Convert a File to a base64 data URL. */
  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const finish = async () => {
    setError('');
    setSubmitting(true);
    try {
      // Convert student ID image to base64 if present.
      let idCardUrl;
      if (form.isStudent && form.studentId) {
        // Validate file size client-side (3 MB limit).
        if (form.studentId.size > 3 * 1024 * 1024) {
          throw new Error('Student ID image is too large. Please upload a smaller photo (max 3 MB).');
        }
        idCardUrl = await fileToDataUrl(form.studentId);
      }

      await upgradeToSeller({
        storeName: form.storeName.trim(),
        bio: form.bio.trim() || undefined,
        isStudent: !!form.isStudent,
        university: form.isStudent ? form.university.trim() : undefined,
        occupation: form.isStudent ? undefined : form.occupation.trim(),
        businessReg: form.isStudent ? undefined : (form.businessReg.trim() || undefined),
        location: user?.location || form.university || undefined,
        payout: {
          method: form.payoutMethod,
          account: form.payoutAccount,
          accountName: form.payoutName,
        },
        idCardUrl,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e.message || 'Could not submit your application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="auth-page kente-bg bs-page">
        <div className="auth-logo"><Logo size="md" /></div>
        <div className="bs-card bs-submitted">
          <div className="bs-submitted-ic"><Clock size={36} /></div>
          <h2>Application submitted</h2>
          <p className="muted">
            Thanks, {form.storeName || 'seller'}! Our admins will review your details and verify
            your account, usually within 24 hours. You can start setting up your store right away —
            you'll see a "Verified" badge on your profile once approved.
          </p>
          <div className="bs-actions" style={{ marginTop: 18 }}>
            <button
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={() => navigate('/seller-dashboard', { replace: true })}
            >
              Go to dashboard <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page kente-bg bs-page">
      <button className="auth-back" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
      <div className="auth-logo"><Logo size="md" /></div>

      <div className="bs-card">
        <header className="bs-head">
          <h2>Become a seller</h2>
          <p className="lede">A few quick steps to start selling on sBay.</p>
        </header>

        {/* Progress */}
        <div className="bs-progress">
          {STEPS.map((s, i) => (
            <div key={s} className={`bs-step ${i <= step ? 'done' : ''} ${i === step ? 'current' : ''}`}>
              <span className="bs-circle">{i < step ? <Check size={14} /> : i + 1}</span>
              <span className="bs-lbl">{s}</span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="bs-body"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && (
              <>
                <div className="field">
                  <label>Store name</label>
                  <div className="field-input">
                    <input value={form.storeName} onChange={(e) => set('storeName', e.target.value)} placeholder="e.g. Kofi Gadgets" />
                  </div>
                </div>
                <div className="field">
                  <label>Short bio</label>
                  <div className="field-input">
                    <input value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="What kind of items do you sell?" />
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="muted small">Are you currently a student?</p>
                <div className="role-grid" style={{ marginTop: 10 }}>
                  <button type="button" className={`role-card ${form.isStudent === true ? 'active' : ''}`} onClick={() => set('isStudent', true)}>
                    <GraduationCap size={28} color="#0A7E3E" />
                    <strong>Yes, I'm a student</strong>
                    <span>Verified with student ID</span>
                  </button>
                  <button type="button" className={`role-card ${form.isStudent === false ? 'active' : ''}`} onClick={() => set('isStudent', false)}>
                    <Briefcase size={28} color="#F5A623" />
                    <strong>No, I'm not</strong>
                    <span>Independent seller</span>
                  </button>
                </div>
              </>
            )}

            {step === 2 && form.isStudent && (
              <>
                <div className="field">
                  <label>University</label>
                  <div className="field-input">
                    <input value={form.university} onChange={(e) => set('university', e.target.value)} placeholder="UG, Legon" />
                  </div>
                </div>
                <div className="field">
                  <label>Upload Student ID</label>
                  <label className="file-drop">
                    <Upload size={22} />
                    <span>{form.studentId?.name || 'Tap to upload (JPG/PNG)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => set('studentId', e.target.files?.[0] || null)}
                      hidden
                    />
                  </label>
                  <p className="muted small">Your ID is only used to verify you and is never shown to buyers.</p>
                </div>
              </>
            )}

            {step === 2 && form.isStudent === false && (
              <>
                <div className="field">
                  <label>Occupation</label>
                  <div className="field-input">
                    <input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder="e.g. Trader, Freelancer" />
                  </div>
                </div>
                <div className="field">
                  <label>Business registration (optional)</label>
                  <div className="field-input">
                    <input value={form.businessReg} onChange={(e) => set('businessReg', e.target.value)} placeholder="e.g. RGD certificate number" />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="field">
                  <label>Payment network</label>
                  <div className="field-input">
                    <select value={form.payoutMethod} onChange={(e) => set('payoutMethod', e.target.value)}>
                      <option value="mtn-momo">MTN MoMo</option>
                      <option value="vodafone-cash">Telecel Cash</option>
                      <option value="airteltigo-money">AirtelTigo Money</option>
                      <option value="bank">Bank account</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Payment number</label>
                  <div className="field-input">
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={form.payoutAccount}
                      onChange={(e) => set('payoutAccount', e.target.value.replace(/\D/g, ''))}
                      placeholder="024 123 4567"
                    />
                  </div>
                  <p className="muted small">Enter a valid phone or account number for receiving buyer payments.</p>
                </div>
                <div className="field">
                  <label>Account name</label>
                  <div className="field-input">
                    <input value={form.payoutName} onChange={(e) => set('payoutName', e.target.value)} placeholder="Name registered on the account" />
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="terms-intro-block">
                  <Shield size={22} color="#0A7E3E" />
                  <div>
                    <h4 style={{ margin: 0, marginBottom: 4 }}>Almost done</h4>
                    <p className="muted small" style={{ margin: 0, lineHeight: 1.55 }}>
                      Please read and accept both documents before continuing.
                      Tap each link to read the full text in a new page.
                    </p>
                  </div>
                </div>

                <div className="terms-agree-card">
                  <div className="terms-agree-header">
                    <Shield size={18} color="#0A7E3E" />
                    <strong>sBay Seller Agreement</strong>
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="terms-read-link"
                    >
                      Read full agreement →
                    </a>
                  </div>
                  <p className="muted small" style={{ margin: '6px 0 12px' }}>
                    Covers eligibility, listing rules, prohibited items, escrow fees, dispute resolution, and your responsibilities as a seller.
                  </p>
                  <label className="agree-row">
                    <input type="checkbox" checked={form.agreedTerms} onChange={(e) => set('agreedTerms', e.target.checked)} />
                    <span>I have read and agree to the <strong>sBay Seller Agreement</strong>.</span>
                  </label>
                </div>

                <div className="terms-agree-card" style={{ marginTop: 12 }}>
                  <div className="terms-agree-header">
                    <Shield size={18} color="#1565C0" />
                    <strong>sBay Privacy Policy</strong>
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="terms-read-link"
                    >
                      Read full policy →
                    </a>
                  </div>
                  <p className="muted small" style={{ margin: '6px 0 12px' }}>
                    Covers what data we collect, how we use it, who sees it, your rights, and how we keep it secure.
                  </p>
                  <label className="agree-row">
                    <input type="checkbox" checked={form.agreedPrivacy} onChange={(e) => set('agreedPrivacy', e.target.checked)} />
                    <span>I have read and agree to the <strong>sBay Privacy Policy</strong>.</span>
                  </label>
                </div>

                {(!form.agreedTerms || !form.agreedPrivacy) && (
                  <p className="muted small" style={{ marginTop: 10, textAlign: 'center' }}>
                    You must accept both documents to continue.
                  </p>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="bs-actions">
          {step > 0 && <button className="btn btn-ghost" onClick={prev}><ArrowLeft size={16} /> Back</button>}
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" disabled={!canNext()} onClick={next} style={{ marginLeft: 'auto' }}>
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              disabled={!canNext() || submitting}
              onClick={finish}
              style={{ marginLeft: 'auto' }}
            >
              {submitting ? 'Submitting…' : <>Agree and continue <Check size={16} /></>}
            </button>
          )}
        </div>
        {error && (
          <p className="auth-error" style={{ marginTop: 10 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
