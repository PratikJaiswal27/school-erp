import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ImageUpload from '../../components/ImageUpload';
import Toast from '../../components/Toast';

interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string;
  profile_image: string;
}

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Teacher>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!user?.teacher_id) return;
    fetchTeacher();
  }, [user]);

  const fetchTeacher = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, phone, email, profile_image')
      .eq('id', user?.teacher_id)
      .single();
    if (!error && data) {
      setTeacher(data);
      setFormData(data);
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    if (!teacher) throw new Error('No teacher');
    const fileExt = file.name.split('.').pop();
    const fileName = `${teacher.id}/profile.${fileExt}`;
    const { error } = await supabase.storage.from('teachers').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('teachers').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handleImageDelete = async () => {
    if (!teacher) return;
    const filePath = `${teacher.id}/profile.${teacher.profile_image?.split('.').pop()}`;
    await supabase.storage.from('teachers').remove([filePath]);
    await supabase.from('teachers').update({ profile_image: null }).eq('id', teacher.id);
    fetchTeacher();
  };

  const handleSave = async () => {
    if (!teacher) return;
    setLoading(true);
    const { error } = await supabase
      .from('teachers')
      .update({
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        profile_image: formData.profile_image
      })
      .eq('id', teacher.id);
    if (!error) {
      setEditing(false);
      fetchTeacher();
      setToast({ message: 'Profile updated', type: 'success' });
    } else {
      setToast({ message: error.message, type: 'error' });
    }
    setLoading(false);
  };

  if (!teacher) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-body">
          <h2>My Profile</h2>
          <div className="row">
            <div className="col-md-4 text-center">
              <ImageUpload
                onUpload={handleImageUpload}
                existingUrl={teacher.profile_image || undefined}
                onDelete={handleImageDelete}
              />
            </div>
            <div className="col-md-8">
              {!editing ? (
                <div>
                  <p><strong>Name:</strong> {teacher.name}</p>
                  <p><strong>Phone:</strong> {teacher.phone || '-'}</p>
                  <p><strong>Email:</strong> {teacher.email || '-'}</p>
                  <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit</button>
                </div>
              ) : (
                <form>
                  <div className="mb-3">
                    <label>Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Phone</label>
                    <input
                      type="tel"
                      className="form-control"
                      value={formData.phone || ''}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label>Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email || ''}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <button type="button" className="btn btn-success me-2" onClick={handleSave} disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Profile;