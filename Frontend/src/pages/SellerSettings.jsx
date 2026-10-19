import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Check, MapPin, Store, Phone, Mail, Wallet,
  ShieldCheck, ShieldAlert, Crown, Loader2,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import AccountSecurity from '../components/AccountSecurity';
import { useAuth } from '../store/AuthContext';
import { resizeImage } from '../utils/image';
import './pages.css';
import './Auth.css';
import './SellerSettings.css';

export default function SellerSettings() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [form, setForm] = useState({
    storeName: user?.sellerProfile?.storeName || '',
    bio:       user?.sellerProfile?.bio || '',
    phone:     user?.phone || '',
    email:     user?.email || '',
    location:  user?.location || '',
    avatar:    user?.avatar || '',

    payoutMethod: user?.payout?.method || 'mtn-momo',
    payoutAccount: user?.payout?.account || '',
    payoutName: user?.payout?.accountName || user?.name || '',

  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleAvatarUpload = async (e) => {
    try { set('avatar', await resizeImage(e.target.files?.[0])); }
    catch (err) { setSaveMsg({ ok: false, text: err.message }); }
    e.target.value = '';
  };

  // Only fields the API actually stores are sent. (Vacation mode and
  // notification toggles used to be shown here but were never saved.)
  const saveProfile = async (e) => {
    e.preventDefault();
    setSaveMsg(null);
    setSaving(true);
    try {
      await updateUser({
        avatar: form.avatar,
        phone: form.phone.trim(),
        location: form.location.trim(),
        sellerProfile: { storeName: form.storeName.trim(), bio: form.bio.trim(), location: form.location.trim() },
        payout: { method: form.payoutMethod, account: form.payoutAccount, accountName: form.payoutName.trim() },
      });
      setSaveMsg({ ok: true, text: 'Your shop details have been saved.' });
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message || "We couldn't save your changes." });
    } finally {
      setSaving(false);
    }
  };

  const verificationStatus = user?.verification?.status || (user?.verified ? 'verified' : 'unverified');
  const VERIFY_COPY = {
    verified: ['Verified seller', 'Your shop has been approved by the sBay team.'],
    pending: ['Verification in review', "We're reviewing your application and will email you once it's done."],
    rejected: ['Verification needs attention', user?.verification?.reason || 'Your application was not approved. Please resubmit your details.'],
    unverified: ['Not verified yet', 'Get verified to earn the badge buyers look for.'],
  };
  const [verifyTitle, verifyText] = VERIFY_COPY[verificationStatus] || VERIFY_COPY.unverified;
  const planId = user?.subscription?.plan || 'free';

  return (
    <div className="page">
      <TopBar showBack showSearch={false} title="Settings" />

      <main className="page-main settings-page">
        {/* Quick links */}
        <section className="ss-quick">
          <div className={`ss-quick-row read-only ${verificationStatus === 'verified' ? 'is-ok' : 'is-warn'}`}>
            <span className="ic">
              {verificationStatus === 'verified' ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            </span>
            <div>
              <strong>{verifyTitle}</strong>
              <p className="muted small">{verifyText}</p>
            </div>
          </div>
          <button className="ss-quick-row" onClick={() => navigate('/seller/subscription')}>
            <span className="ic"><Crown size={18} /></span>
            <div>
              <strong>Subscription</strong>
              <p className="muted small">Plan: {planId.charAt(0).toUpperCase() + planId.slice(1)}</p>
            </div>
          </button>
        </section>

        <form className="settings-form" onSubmit={saveProfile}>
          {/* Store identity */}
          <section className="card">
            <h3 className="page-h2"><Store size={16} /> Store identity</h3>
            <div className="avatar-row">
              <div
                className="avatar-preview"
                style={{ backgroundImage: `url(${form.avatar || user?.avatar})` }}
              />
              <label className="btn btn-ghost">
                <Camera size={16} /> Change photo
                <input type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
              </label>
            </div>
            <label className="field">
              <span>Store name</span>
              <input value={form.storeName} onChange={(e) => set('storeName', e.target.value)} placeholder="e.g. Kofi Gadgets" />
            </label>
            <label className="field">
              <span>Bio</span>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                placeholder="Tell buyers what your store sells and where you ship."
              />
            </label>
          </section>

          {/* Contact */}
          <section className="card">
            <h3 className="page-h2"><Mail size={16} /> Contact</h3>
            <label className="field">
              <span>Email</span>
              <input type="email" value={form.email} readOnly aria-readonly="true" />
              <span className="field-hint">Contact support if you need to change the email on your account.</span>
            </label>
            <label className="field">
              <span><Phone size={14} /> Phone (+233)</span>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+233 24 000 0000" />
            </label>
            <label className="field">
              <span><MapPin size={14} /> Default pickup location</span>
              <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Night Market, UG Legon" />
            </label>
          </section>

          {/* Payout */}
          <section className="card">
            <h3 className="page-h2"><Wallet size={16} /> Payout method</h3>
            <p className="muted small">How you'd like to receive your earnings.</p>
            <div className="pay-methods">
              {[
                { id: 'mtn-momo', label: 'MTN MoMo' },
                { id: 'vodafone-cash', label: 'Telecel Cash' },
                { id: 'airteltigo-money', label: 'AirtelTigo Money' },
                { id: 'bank', label: 'Bank transfer' },
              ].map((m) => (
                <label key={m.id} className={`pay-method ${form.payoutMethod === m.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="payout"
                    checked={form.payoutMethod === m.id}
                    onChange={() => set('payoutMethod', m.id)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            <label className="field">
              <span>Account / number</span>
              <input
                value={form.payoutAccount}
                onChange={(e) => set('payoutAccount', e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="024 123 4567"
              />
            </label>
            <label className="field">
              <span>Account name</span>
              <input
                value={form.payoutName}
                onChange={(e) => set('payoutName', e.target.value)}
                placeholder="As registered with your bank / MoMo"
              />
            </label>
          </section>

          {saveMsg && <div className={saveMsg.ok ? 'auth-hint' : 'auth-error'} role={saveMsg.ok ? 'status' : 'alert'}>{saveMsg.text}</div>}
          <div className="settings-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Save changes
            </button>
          </div>
        </form>

        <AccountSecurity />
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
