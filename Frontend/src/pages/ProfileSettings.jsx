import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Check, Camera, MapPin, Loader2 } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import Avatar from '../components/Avatar';
import AccountSecurity from '../components/AccountSecurity';
import { useAuth } from '../store/AuthContext';
import { resizeImage } from '../utils/image';
import './pages.css';
import './Profile.css';
import './SellerSettings.css';

export default function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    location: user?.location || '',
    avatar: user?.avatar || '',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'seller') return <Navigate to="/seller/settings" replace />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPhoto = async (e) => {
    try { set('avatar', await resizeImage(e.target.files?.[0])); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
    e.target.value = '';
  };

  const save = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (form.name.trim().length < 2) { setMsg({ ok: false, text: 'Enter your full name.' }); return; }
    setBusy(true);
    try {
      await updateUser({
        name: form.name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        avatar: form.avatar,
      });
      setMsg({ ok: true, text: 'Your changes have been saved.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message || "We couldn't save your changes." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <TopBar showBack showSearch={false} title="Settings" />
      <main className="page-main settings-page">
        <form className="settings-form" onSubmit={save}>
          <section className="card">
            <h3 className="page-h2">Profile</h3>
            <div className="avatar-row">
              <Avatar src={form.avatar} name={form.name || user.name} size={72} />
              <label className="btn btn-ghost">
                <Camera size={16} /> Change photo
                <input type="file" accept="image/*" onChange={onPhoto} hidden />
              </label>
            </div>
            <label className="field">
              <span>Full name</span>
              <input type="text" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={user.email} readOnly aria-readonly="true" />
              <span className="field-hint">Contact support if you need to change the email on your account.</span>
            </label>
            <label className="field">
              <span>Phone number</span>
              <input type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="024 123 4567" />
            </label>
            <label className="field">
              <span><MapPin size={14} /> Default delivery location</span>
              <input type="text" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Greater Accra, East Legon" />
              <span className="field-hint">Used to pre-fill checkout.</span>
            </label>
            {msg && <div className={msg.ok ? 'auth-hint' : 'auth-error'} role={msg.ok ? 'status' : 'alert'} style={{ marginTop: 12 }}>{msg.text}</div>}
            <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }} disabled={busy}>
              {busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Save changes
            </button>
          </section>
        </form>

        <AccountSecurity />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
