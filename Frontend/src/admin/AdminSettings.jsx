import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { Save, UserPlus, Trash2, ShieldAlert } from 'lucide-react';
import { useAdminConfirm } from './AdminConfirmContext';
import { Notice, useToast } from '../components/Feedback';

/**
 * Platform settings + admin team management on a single page.
 *
 * Maintenance-mode is a hard kill-switch: when true, the public
 * settings endpoint surfaces it so the frontend can render a banner
 * across every page. (Wire-up of the banner is intentionally
 * lightweight for now.)
 */
export default function AdminSettings() {
  const { confirm } = useAdminConfirm();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsErr, setSettingsErr] = useState('');

  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', password: '' });
  const [adminErr, setAdminErr] = useState('');

  const load = async () => {
    const [s, a] = await Promise.all([
      adminApi.get('/settings'),
      adminApi.get('/admins'),
    ]);
    setSettings(s.data.settings);
    setAdmins(a.data.admins);
  };

  useEffect(() => { load().catch((e) => setSettingsErr(e.message)); }, []);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true); setSettingsErr('');
    try {
      const payload = {
        platformName: settings.platformName,
        defaultEscrowFeePct: Number(settings.defaultEscrowFeePct),
        sellerOnboardingFee: Number(settings.sellerOnboardingFee ?? 0),
        supportEmail: settings.supportEmail,
        announcement: settings.announcement,
        maintenanceMode: !!settings.maintenanceMode,
      };
      const { data } = await adminApi.patch('/settings', payload);
      setSettings(data.settings);
      toast.success('Settings saved');
    } catch (ex) { setSettingsErr(ex.message); }
    finally { setSavingSettings(false); }
  };

  const addAdmin = async (e) => {
    e.preventDefault();
    setAdminErr('');
    try {
      await adminApi.post('/admins', newAdmin);
      toast.success(`${newAdmin.email} is now an admin`);
      setNewAdmin({ name: '', email: '', password: '' });
      load();
    } catch (ex) { setAdminErr(ex.message); }
  };

  const removeAdmin = async (id, email) => {
    if (!(await confirm(`Remove admin access from ${email}? They will be demoted to a buyer.`))) return;
    try {
      await adminApi.delete(`/admins/${id}`);
      toast.success(`Removed admin access from ${email}`);
      load();
    } catch (ex) { toast.error(ex.message); }
  };

  if (!settings) return <p className="muted">Loading settings…</p>;

  return (
    <>
      <h1>Settings</h1>

      <div className="admin-card">
        <h2>Platform</h2>
        {settingsErr && <Notice tone="error">{settingsErr}</Notice>}
        <form className="admin-form" onSubmit={saveSettings}>
          <label>Platform name
            <input value={settings.platformName || ''}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} />
          </label>
          <label>Default escrow fee (%)
            <input type="number" min="0" max="100" step="0.1"
              value={settings.defaultEscrowFeePct ?? 5}
              onChange={(e) => setSettings({ ...settings, defaultEscrowFeePct: e.target.value })} />
            <small className="muted">Used when a seller's plan does not override the fee.</small>
          </label>
          <label>Seller onboarding fee (GH₵)
            <input type="number" min="0" step="0.01"
              value={settings.sellerOnboardingFee ?? 0}
              onChange={(e) => setSettings({ ...settings, sellerOnboardingFee: e.target.value })} />
            <small className="muted">One-time fee sellers pay before they can list items. Set to 0 to disable.</small>
          </label>
          <label>Support email
            <input type="email" value={settings.supportEmail || ''}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} />
          </label>
          <label>Site-wide announcement
            <textarea rows={2} value={settings.announcement || ''}
              onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
              placeholder="Shown on every public page when non-empty." />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!!settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} />
            <span><ShieldAlert size={14} /> Maintenance mode (hides marketplace from non-admins)</span>
          </label>
          <div>
            <button className="btn btn-primary" type="submit" disabled={savingSettings}>
              <Save size={14} /> {savingSettings ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2>Admins ({admins.length})</h2>
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a._id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td className="muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => removeAdmin(a._id, a.email)}>
                    <Trash2 size={14} /> Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ marginTop: 18 }}>Add admin</h2>
        {adminErr && <Notice tone="error">{adminErr}</Notice>}
        <form className="admin-form" onSubmit={addAdmin}>
          <label>Full name
            <input value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} required />
          </label>
          <label>Email
            <input type="email" value={newAdmin.email}
              onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} required />
          </label>
          <label>Initial password (minimum 10 characters)
            <input type="password" value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              minLength={10} required />
            <small className="muted">Share securely. The new admin can change this from their profile.</small>
          </label>
          <div>
            <button className="btn btn-primary" type="submit">
              <UserPlus size={14} /> Create admin
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
