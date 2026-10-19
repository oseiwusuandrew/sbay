import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Check, ShieldCheck, ShieldAlert, ArrowLeft as Back, ArrowRight, Clock, IdCard, GraduationCap, User as UserIc,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../store/AuthContext';
import './pages.css';
import './Auth.css';
import './Sell.css';
import './SellerVerification.css';

const STEPS = ['Personal', 'Student ID', 'Government ID', 'Selfie', 'Review'];

export default function SellerVerification() {
  const navigate = useNavigate();
  const { user, submitVerification } = useAuth();
  const liveStatus = user?.verification?.status || (user?.verified ? 'verified' : 'unverified');
  const [resubmitting, setResubmitting] = useState(false);
  const status = resubmitting ? 'unverified' : liveStatus;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fullName: user?.name || '',
    dob: '',
    university: user?.university || '',
    studentNumber: '',
    studentIdImage: '',
    govIdType: 'Ghana Card',
    govIdNumber: '',
    govIdImage: '',
    selfieImage: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = (key) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set(key, reader.result);
    reader.readAsDataURL(file);
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const stepIsValid = () => {
    if (step === 0) return form.fullName && form.dob && form.university;
    if (step === 1) return form.studentNumber && form.studentIdImage;
    if (step === 2) return form.govIdNumber && form.govIdImage;
    if (step === 3) return form.selfieImage;
    return true;
  };

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      await submitVerification(form);
    } catch (e) { setErr(e.message || 'Could not submit.'); }
    finally { setBusy(false); }
  };

  // ---- Status screen (pending / verified / rejected) ----
  if (status === 'pending' || status === 'verified' || status === 'rejected') {
    return (
      <div className="page">
        <TopBar showBack showSearch={false} title="Verification" />
        <main className="page-main">
          <div className={`vf-status vf-${status}`}>
            <div className="vf-status-ic">
              {status === 'verified' && <ShieldCheck size={44} />}
              {status === 'pending'  && <Clock size={44} />}
              {status === 'rejected' && <ShieldAlert size={44} />}
            </div>
            <h2>
              {status === 'verified' && "You're verified"}
              {status === 'pending'  && 'Under review'}
              {status === 'rejected' && 'Verification was rejected'}
            </h2>
            <p className="muted">
              {status === 'verified' && 'Your verified badge is now visible to buyers across sBay.'}
              {status === 'pending'  && 'We typically review submissions within 24 hours. We will notify you once it is decided.'}
              {status === 'rejected' && (user?.verification?.reason || 'Some details did not match. You can resubmit any time.')}
            </p>

            {status === 'verified' && (
              <button className="btn btn-primary" onClick={() => navigate('/seller-dashboard')}>
                Back to dashboard
              </button>
            )}
            {status === 'pending' && (
              <button className="btn btn-ghost" onClick={() => navigate('/seller-dashboard')}>
                Back to dashboard
              </button>
            )}
            {status === 'rejected' && (
              <button
                className="btn btn-primary"
                onClick={() => { setStep(0); setResubmitting(true); }}
              >
                Resubmit
              </button>
            )}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ---- Wizard ----
  return (
    <div className="page">
      <TopBar showBack showSearch={false} title="Get verified" />

      <div className="stepper">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i <= step ? 'done' : ''}`}>
            <span className="circle">{i < step ? <Check size={14} /> : i + 1}</span>
            <span className="lbl">{s}</span>
          </div>
        ))}
      </div>

      <main className="page-main">
        <AnimatePresence mode="wait">
          <motion.section
            key={step}
            className="card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {step === 0 && (
              <>
                <h3 className="page-h2"><UserIc size={16} /> Personal details</h3>
                <p className="muted small">We use these to confirm your identity. They will not be shown publicly.</p>
                <div className="vf-grid">
                  <label>
                    <span>Full legal name</span>
                    <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="As shown on your ID" />
                  </label>
                  <label>
                    <span>Date of birth</span>
                    <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
                  </label>
                  <label className="full">
                    <span>University</span>
                    <input value={form.university} onChange={(e) => set('university', e.target.value)} placeholder="e.g. University of Ghana" />
                  </label>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h3 className="page-h2"><GraduationCap size={16} /> Student ID</h3>
                <p className="muted small">Upload a clear photo of your current student ID card.</p>
                <div className="vf-grid">
                  <label className="full">
                    <span>Student number</span>
                    <input value={form.studentNumber} onChange={(e) => set('studentNumber', e.target.value)} placeholder="e.g. 10812345" />
                  </label>
                </div>
                <UploadBox label="Student ID photo" value={form.studentIdImage} onChange={upload('studentIdImage')} />
              </>
            )}

            {step === 2 && (
              <>
                <h3 className="page-h2"><IdCard size={16} /> Government ID</h3>
                <p className="muted small">Ghana Card or passport — both sides if applicable.</p>
                <div className="vf-grid">
                  <label>
                    <span>Document type</span>
                    <select value={form.govIdType} onChange={(e) => set('govIdType', e.target.value)}>
                      <option>Ghana Card</option>
                      <option>Passport</option>
                      <option>Driver's License</option>
                    </select>
                  </label>
                  <label>
                    <span>ID number</span>
                    <input value={form.govIdNumber} onChange={(e) => set('govIdNumber', e.target.value)} placeholder="e.g. GHA-XXXXXXXX-X" />
                  </label>
                </div>
                <UploadBox label="Government ID photo" value={form.govIdImage} onChange={upload('govIdImage')} />
              </>
            )}

            {step === 3 && (
              <>
                <h3 className="page-h2"><Camera size={16} /> Selfie</h3>
                <p className="muted small">Take a well-lit selfie holding your government ID next to your face.</p>
                <UploadBox label="Selfie with ID" value={form.selfieImage} onChange={upload('selfieImage')} />
              </>
            )}

            {step === 4 && (
              <>
                <h3 className="page-h2">Review &amp; submit</h3>
                <ul className="vf-review">
                  <li><span>Name</span><strong>{form.fullName || '—'}</strong></li>
                  <li><span>Date of birth</span><strong>{form.dob || '—'}</strong></li>
                  <li><span>University</span><strong>{form.university || '—'}</strong></li>
                  <li><span>Student number</span><strong>{form.studentNumber || '—'}</strong></li>
                  <li><span>Government ID</span><strong>{form.govIdType} · {form.govIdNumber || '—'}</strong></li>
                  <li><span>Student ID photo</span><strong>{form.studentIdImage ? 'Uploaded' : 'Missing'}</strong></li>
                  <li><span>Government ID photo</span><strong>{form.govIdImage ? 'Uploaded' : 'Missing'}</strong></li>
                  <li><span>Selfie</span><strong>{form.selfieImage ? 'Uploaded' : 'Missing'}</strong></li>
                </ul>
                <p className="muted small">By submitting you agree to sBay's verification policy. We'll email you as soon as it has been reviewed.</p>
                {err && <div className="auth-error">{err}</div>}
              </>
            )}
          </motion.section>
        </AnimatePresence>

        <div className="step-actions">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={prev} disabled={busy}>
              <Back size={16} /> Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={next}
              disabled={!stepIsValid()}
            >
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={submit}
              disabled={busy || !stepIsValid()}
            >
              {busy ? 'Submitting…' : 'Submit for review'}
            </button>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function UploadBox({ label, value, onChange }) {
  return (
    <label className={`vf-upload ${value ? 'has' : ''}`}>
      {value ? (
        <img src={value} alt={label} />
      ) : (
        <>
          <Camera size={26} />
          <strong>{label}</strong>
          <span className="muted small">Tap to choose a photo</span>
        </>
      )}
      <input type="file" accept="image/*" onChange={onChange} hidden />
    </label>
  );
}
