import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { hashPassword } from '../../lib/auth';
import ImageUpload from '../../components/ImageUpload';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { useNavigate } from 'react-router-dom';

interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string;
  profile_image: string | null;
  monthly_fee_paid: boolean;
  last_paid_month: string | null;
  user_id?: string;
  username?: string;
  assigned_classes: { class_id: string; class_name: string }[];
}

const Teachers: React.FC = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState<Partial<Teacher & { username: string; password: string; confirmPassword: string }>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showCreateLoginModal, setShowCreateLoginModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    setLoading(true);
    const { data: teachersData, error } = await supabase
      .from('teachers')
      .select(`
        *,
        users!teacher_id (id, username),
        class_attendance_teacher (class_id, classes (name))
      `);
    if (error) {
      console.error(error);
      setToast({ message: 'Failed to fetch teachers', type: 'error' });
    } else {
      const formatted = (teachersData || []).map((t: any) => ({
        ...t,
        user_id: t.users?.id,
        username: t.users?.username,
        assigned_classes: t.class_attendance_teacher?.map((cat: any) => ({
          class_id: cat.class_id,
          class_name: cat.classes?.name,
        })) || [],
      }));
      setTeachers(formatted);
    }
    setLoading(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `teachers/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error } = await supabase.storage.from('teachers').upload(fileName, file);
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('teachers').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handleImageDelete = async () => {
    if (!formData.profile_image) return;
    const url = formData.profile_image;
    const pathMatch = url.match(/\/public\/teachers\/(.+)$/);
    if (pathMatch && pathMatch[1]) {
      await supabase.storage.from('teachers').remove([pathMatch[1]]);
    }
    setFormData(prev => ({ ...prev, profile_image: null }));
  };

  const handleSaveTeacher = async () => {
    if (!formData.name) {
      setToast({ message: 'Name is required', type: 'error' });
      return;
    }
    try {
      if (selectedTeacher) {
        const { error } = await supabase
          .from('teachers')
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            profile_image: formData.profile_image,
          })
          .eq('id', selectedTeacher.id);
        if (error) throw error;
        setToast({ message: 'Teacher updated', type: 'success' });
      } else {
        if (!formData.username || !formData.password) {
          setToast({ message: 'Username and password are required', type: 'error' });
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setToast({ message: 'Passwords do not match', type: 'error' });
          return;
        }
        const { data: teacher, error: teacherError } = await supabase
          .from('teachers')
          .insert({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            profile_image: formData.profile_image,
          })
          .select()
          .single();
        if (teacherError) throw teacherError;

        const passwordHash = hashPassword(formData.password);
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
            username: formData.username,
            password_hash: passwordHash,
            role: 'teacher',
            teacher_id: teacher.id,
          })
          .select()
          .single();
        if (userError) {
          await supabase.from('teachers').delete().eq('id', teacher.id);
          throw userError;
        }

        // Mark all existing notifications as read for this new user
        const { data: allNotifs } = await supabase.from('notifications').select('id');
        if (allNotifs && allNotifs.length) {
          const reads = allNotifs.map(n => ({
            notification_id: n.id,
            user_id: userData.id,
          }));
          await supabase.from('notification_reads').insert(reads);
        }

        setToast({ message: 'Teacher added with login', type: 'success' });
      }
      setShowAddModal(false);
      setShowEditModal(false);
      fetchTeachers();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save', type: 'error' });
    }
  };

  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;
    try {
      if (selectedTeacher.user_id) {
        await supabase.from('users').delete().eq('id', selectedTeacher.user_id);
      }
      const { error } = await supabase.from('teachers').delete().eq('id', selectedTeacher.id);
      if (error) throw error;
      setToast({ message: 'Teacher deleted', type: 'success' });
      setShowDeleteModal(false);
      fetchTeachers();
    } catch (err: any) {
      setToast({ message: err.message || 'Delete failed', type: 'error' });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedTeacher) {
      setToast({ message: 'No teacher selected', type: 'error' });
      return;
    }
    if (!selectedTeacher.user_id) {
      setShowCreateLoginModal(true);
      return;
    }
    if (!resetPassword.trim()) {
      setToast({ message: 'Please enter new password', type: 'error' });
      return;
    }
    try {
      const newHash = hashPassword(resetPassword);
      const { error } = await supabase
        .from('users')
        .update({ password_hash: newHash })
        .eq('id', selectedTeacher.user_id);
      if (error) throw error;
      setToast({ message: 'Password reset successfully', type: 'success' });
      setShowResetPasswordModal(false);
      setResetPassword('');
    } catch (err: any) {
      setToast({ message: err.message || 'Reset failed', type: 'error' });
    }
  };

  const handleCreateLogin = async () => {
    if (!selectedTeacher) return;
    if (!newUsername.trim() || !newPassword.trim()) {
      setToast({ message: 'Username and password are required', type: 'error' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setToast({ message: 'Passwords do not match', type: 'error' });
      return;
    }
    try {
      const passwordHash = hashPassword(newPassword);
      const { error: userError } = await supabase
        .from('users')
        .insert({
          username: newUsername,
          password_hash: passwordHash,
          role: 'teacher',
          teacher_id: selectedTeacher.id,
        });
      if (userError) throw userError;
      setToast({ message: 'Login account created and password set', type: 'success' });
      setShowCreateLoginModal(false);
      setNewUsername('');
      setNewPassword('');
      setConfirmNewPassword('');
      fetchTeachers();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to create login', type: 'error' });
    }
  };

  const handleToggleFee = async (teacherId: string, currentPaid: boolean) => {
    try {
      const { error } = await supabase
        .from('teachers')
        .update({ monthly_fee_paid: !currentPaid })
        .eq('id', teacherId);
      if (error) throw error;
      setToast({ message: `Salary status updated`, type: 'success' });
      fetchTeachers();
    } catch (err: any) {
      setToast({ message: err.message || 'Update failed', type: 'error' });
    }
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between mb-3">
        <h2>Teacher Management</h2>
        <button className="btn btn-primary" onClick={() => { setFormData({}); setSelectedTeacher(null); setShowAddModal(true); }}>
          <i className="bi bi-plus-circle"></i> Add Teacher
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead>
            <tr>
              <th>Avatar</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Assigned Classes</th>
              <th>Salary Given</th>
              <th>Username</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map(teacher => (
              <tr key={teacher.id}>
                <td>
                  {teacher.profile_image ? (
                    <img
                      src={teacher.profile_image}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                      alt="avatar"
                    />
                  ) : (
                    <div className="avatar-placeholder" style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="text-white">{teacher.name?.charAt(0) || 'T'}</span>
                    </div>
                  )}
                </td>
                <td>{teacher.name}</td>
                <td>{teacher.phone}</td>
                <td>{teacher.email}</td>
                <td>{teacher.assigned_classes.map(c => c.class_name).join(', ')}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={teacher.monthly_fee_paid}
                    onChange={() => handleToggleFee(teacher.id, teacher.monthly_fee_paid)}
                  />
                </td>
                <td>{teacher.username}</td>
                <td>
                  <button className="btn btn-sm btn-info me-1" onClick={() => {
                    setSelectedTeacher(teacher);
                    setFormData({
                      name: teacher.name,
                      phone: teacher.phone,
                      email: teacher.email,
                      profile_image: teacher.profile_image,
                    });
                    setShowEditModal(true);
                  }}>Edit</button>
                  <button className="btn btn-sm btn-secondary me-1" onClick={() => navigate(`/teachers/${teacher.id}`)}>View</button>
                  <button className="btn btn-sm btn-warning me-1" onClick={() => {
                    setSelectedTeacher(teacher);
                    setShowResetPasswordModal(true);
                  }}>Reset Pass</button>
                  <button className="btn btn-sm btn-danger" onClick={() => {
                    setSelectedTeacher(teacher);
                    setShowDeleteModal(true);
                  }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <div className={`modal fade ${showAddModal || showEditModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5>{selectedTeacher ? 'Edit Teacher' : 'Add Teacher'}</h5>
              <button className="btn-close" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="mb-3">
                  <label>Name *</label>
                  <input type="text" className="form-control" name="name" value={formData.name || ''} onChange={handleInputChange} />
                </div>
                <div className="mb-3">
                  <label>Phone</label>
                  <input type="text" className="form-control" name="phone" value={formData.phone || ''} onChange={handleInputChange} />
                </div>
                <div className="mb-3">
                  <label>Email</label>
                  <input type="email" className="form-control" name="email" value={formData.email || ''} onChange={handleInputChange} />
                </div>
                <div className="mb-3">
                  <label>Profile Photo</label>
                  <ImageUpload
                    onUpload={handleImageUpload}
                    existingUrl={formData.profile_image || undefined}
                    onDelete={handleImageDelete}
                  />
                </div>
                {!selectedTeacher && (
                  <>
                    <div className="mb-3">
                      <label>Username *</label>
                      <input type="text" className="form-control" name="username" value={formData.username || ''} onChange={handleInputChange} />
                    </div>
                    <div className="mb-3">
                      <label>Password *</label>
                      <input type="password" className="form-control" name="password" value={formData.password || ''} onChange={handleInputChange} />
                    </div>
                    <div className="mb-3">
                      <label>Confirm Password</label>
                      <input type="password" className="form-control" name="confirmPassword" value={formData.confirmPassword || ''} onChange={handleInputChange} />
                    </div>
                  </>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTeacher}>Save</button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      <div className={`modal fade ${showResetPasswordModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5>Reset Password for {selectedTeacher?.name}</h5>
              <button className="btn-close" onClick={() => setShowResetPasswordModal(false)}></button>
            </div>
            <div className="modal-body">
              <label>New Password</label>
              <input type="password" className="form-control" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} autoFocus />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowResetPasswordModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPassword}>Reset</button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Login Modal */}
      <div className={`modal fade ${showCreateLoginModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5>Create Login Account for {selectedTeacher?.name}</h5>
              <button className="btn-close" onClick={() => setShowCreateLoginModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label>Username</label>
                <input type="text" className="form-control" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} />
              </div>
              <div className="mb-3">
                <label>Password</label>
                <input type="password" className="form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="mb-3">
                <label>Confirm Password</label>
                <input type="password" className="form-control" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateLoginModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateLogin}>Create & Set Password</button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteTeacher} title="Delete Teacher" message={`Are you sure you want to delete ${selectedTeacher?.name}?`} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Teachers;