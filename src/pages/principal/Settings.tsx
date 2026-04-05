import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { verifyPassword, hashPassword } from '../../lib/auth';
import Toast from '../../components/Toast';

const Settings: React.FC = () => {
  const { refreshSettings } = useSettings();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<any>({
    attendance_start_time: '07:00',
    logo_url: '',
    principal_name: '',
    principal_signature_text: '',
    school_stamp_text: '',
    school_address: '', // NEW
  });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Password change state (unchanged)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('school_settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (error) {
      console.error(error);
    } else if (data) {
      setSettings(data);
      if (data.logo_url) {
        setLogoPreview(data.logo_url);
      }
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `logo.${fileExt}`;
    const { error } = await supabase.storage.from('school-assets').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('school-assets').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handleLogoDelete = async () => {
    if (settings.logo_url) {
      const path = settings.logo_url.split('/public/school-assets/')[1];
      if (path) {
        await supabase.storage.from('school-assets').remove([path]);
      }
      setSettings((prev: any) => ({ ...prev, logo_url: '' }));
      setLogoPreview(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('school_settings')
        .update({
          attendance_start_time: settings.attendance_start_time,
          logo_url: settings.logo_url,
          principal_name: settings.principal_name,
          principal_signature_text: settings.principal_signature_text,
          school_stamp_text: settings.school_stamp_text,
          school_address: settings.school_address, // NEW
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (error) throw error;
      await refreshSettings();
      setToast({ message: 'Settings saved', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast({ message: 'Please fill all password fields', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: 'New passwords do not match', type: 'error' });
      return;
    }
    if (newPassword.length < 4) {
      setToast({ message: 'New password must be at least 4 characters', type: 'error' });
      return;
    }

    setChangingPassword(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', user.id)
        .single();
      if (userError) throw userError;
      if (!verifyPassword(currentPassword, userData.password_hash)) {
        setToast({ message: 'Current password is incorrect', type: 'error' });
        setChangingPassword(false);
        return;
      }

      const newHash = hashPassword(newPassword);
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: newHash })
        .eq('id', user.id);
      if (updateError) throw updateError;

      setToast({ message: 'Password changed successfully. Please log in again.', type: 'success' });
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      setToast({ message: err.message || 'Password change failed', type: 'error' });
    } finally {
      setChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container">
      <h2>School Settings</h2>
      <form>
        <div className="mb-3">
          <label className="form-label">Attendance Start Time (IST)</label>
          <input
            type="time"
            className="form-control"
            name="attendance_start_time"
            value={settings.attendance_start_time}
            onChange={handleInputChange}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">School Logo</label>
          {logoPreview && (
            <div className="mb-2">
              <img src={logoPreview} alt="Logo Preview" style={{ width: '100px', height: 'auto' }} />
              <button type="button" className="btn btn-sm btn-danger ms-2" onClick={handleLogoDelete}>Remove</button>
            </div>
          )}
          <input
            type="file"
            className="form-control"
            accept="image/jpeg,image/jpg,image/png"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  const publicUrl = await handleLogoUpload(file);
                  setSettings((prev: any) => ({ ...prev, logo_url: publicUrl }));
                  setLogoPreview(publicUrl);
                } catch (err: any) {
                  setToast({ message: err.message || 'Upload failed', type: 'error' });
                }
              }
            }}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">School Address</label>
          <textarea
            className="form-control"
            rows={2}
            name="school_address"
            value={settings.school_address || ''}
            onChange={handleInputChange}
            placeholder="Enter school address (will appear on report cards)"
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Principal Name</label>
          <input type="text" className="form-control" name="principal_name" value={settings.principal_name || ''} onChange={handleInputChange} />
        </div>
        <div className="mb-3">
          <label className="form-label">Principal Signature Text</label>
          <input type="text" className="form-control" name="principal_signature_text" value={settings.principal_signature_text || ''} onChange={handleInputChange} />
        </div>
        <div className="mb-3">
          <label className="form-label">School Stamp Text</label>
          <input type="text" className="form-control" name="school_stamp_text" value={settings.school_stamp_text || ''} onChange={handleInputChange} />
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <hr className="my-4" />

      <h3>Change Password</h3>
      <form>
        <div className="mb-3">
          <label className="form-label">Current Password</label>
          <input
            type="password"
            className="form-control"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">New Password</label>
          <input
            type="password"
            className="form-control"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Confirm New Password</label>
          <input
            type="password"
            className="form-control"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-warning" onClick={handlePasswordChange} disabled={changingPassword}>
          {changingPassword ? 'Changing...' : 'Change Password'}
        </button>
      </form>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Settings;