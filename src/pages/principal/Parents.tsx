import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { hashPassword } from '../../lib/auth';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';

interface Parent {
  id: string;
  name: string;
  phone: string;
  email: string;
  student_id: string;
  student_name?: string;
  student_class?: string;
  user_id?: string;
  username?: string;
}

const Parents: React.FC = () => {
  const [parents, setParents] = useState<Parent[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; class_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [formData, setFormData] = useState<Partial<Parent & { username: string; password: string; confirmPassword: string; student_id: string }>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showCreateLoginModal, setShowCreateLoginModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    fetchParents();
    fetchStudents();
  }, []);

  const fetchParents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('parents')
      .select(`
        *,
        users!parent_id (id, username),
        students (id, name, class_id, classes (name))
      `);
    if (error) console.error(error);
    else {
      const formatted = (data || []).map((p: any) => {
        let className = '';
        if (p.students?.classes) {
          const classesData = p.students.classes;
          const classesArray = Array.isArray(classesData) ? classesData : [classesData];
          className = classesArray[0]?.name || '';
        }
        return {
          ...p,
          user_id: p.users?.id,
          username: p.users?.username,
          student_name: p.students?.name,
          student_class: className,
        };
      });
      setParents(formatted);
    }
    setLoading(false);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('id, name, classes(name)');
    if (!error && data) {
      const studentList = data.map(s => {
        let className = '';
        if (s.classes) {
          const classesArray = Array.isArray(s.classes) ? s.classes : [s.classes];
          className = classesArray[0]?.name || '';
        }
        return { id: s.id, name: s.name, class_name: className };
      });
      setStudents(studentList);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveParent = async () => {
    if (!formData.name || !formData.student_id) {
      setToast({ message: 'Name and student are required', type: 'error' });
      return;
    }
    try {
      if (selectedParent) {
        const { error } = await supabase
          .from('parents')
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            student_id: formData.student_id,
          })
          .eq('id', selectedParent.id);
        if (error) throw error;
        setToast({ message: 'Parent updated', type: 'success' });
      } else {
        if (!formData.username || !formData.password) {
          setToast({ message: 'Username and password required', type: 'error' });
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setToast({ message: 'Passwords do not match', type: 'error' });
          return;
        }
        const { data: existing, error: checkError } = await supabase
          .from('parents')
          .select('id')
          .eq('student_id', formData.student_id);
        if (checkError) throw checkError;
        if (existing && existing.length > 0) {
          setToast({ message: 'This student already has a parent', type: 'error' });
          return;
        }
        const { data: parent, error: parentError } = await supabase
          .from('parents')
          .insert({
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            student_id: formData.student_id,
          })
          .select()
          .single();
        if (parentError) throw parentError;

        const passwordHash = hashPassword(formData.password);
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
            username: formData.username,
            password_hash: passwordHash,
            role: 'parent',
            parent_id: parent.id,
          })
          .select()
          .single();
        if (userError) {
          await supabase.from('parents').delete().eq('id', parent.id);
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

        setToast({ message: 'Parent added with login', type: 'success' });
      }
      setShowAddModal(false);
      setShowEditModal(false);
      fetchParents();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save', type: 'error' });
    }
  };

  const handleDeleteParent = async () => {
    if (!selectedParent) return;
    try {
      if (selectedParent.user_id) {
        await supabase.from('users').delete().eq('id', selectedParent.user_id);
      }
      const { error } = await supabase.from('parents').delete().eq('id', selectedParent.id);
      if (error) throw error;
      setToast({ message: 'Parent deleted', type: 'success' });
      setShowDeleteModal(false);
      fetchParents();
    } catch (err: any) {
      setToast({ message: err.message || 'Delete failed', type: 'error' });
    }
  };

  const handleResetPassword = async () => {
    if (!selectedParent) {
      setToast({ message: 'No parent selected', type: 'error' });
      return;
    }
    if (!selectedParent.user_id) {
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
        .eq('id', selectedParent.user_id);
      if (error) throw error;
      setToast({ message: 'Password reset successfully', type: 'success' });
      setShowResetPasswordModal(false);
      setResetPassword('');
    } catch (err: any) {
      setToast({ message: err.message || 'Reset failed', type: 'error' });
    }
  };

  const handleCreateLogin = async () => {
    if (!selectedParent) return;
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
          role: 'parent',
          parent_id: selectedParent.id,
        });
      if (userError) throw userError;
      setToast({ message: 'Login account created and password set', type: 'success' });
      setShowCreateLoginModal(false);
      setNewUsername('');
      setNewPassword('');
      setConfirmNewPassword('');
      fetchParents();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to create login', type: 'error' });
    }
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between mb-3">
        <h2>Parent Management</h2>
        <button className="btn btn-primary" onClick={() => { setFormData({}); setSelectedParent(null); setShowAddModal(true); }}>
          <i className="bi bi-plus-circle"></i> Add Parent
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Student</th>
              <th>Class</th>
              <th>Username</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parents.map(parent => (
              <tr key={parent.id}>
                <td>{parent.name}</td>
                <td>{parent.phone}</td>
                <td>{parent.email}</td>
                <td>{parent.student_name}</td>
                <td>{parent.student_class}</td>
                <td>{parent.username}</td>
                <td>
                  <button className="btn btn-sm btn-info me-1" onClick={() => {
                    setSelectedParent(parent);
                    setFormData({
                      name: parent.name,
                      phone: parent.phone,
                      email: parent.email,
                      student_id: parent.student_id,
                    });
                    setShowEditModal(true);
                  }}>Edit</button>
                  <button className="btn btn-sm btn-warning me-1" onClick={() => {
                    setSelectedParent(parent);
                    setShowResetPasswordModal(true);
                  }}>Reset Pass</button>
                  <button className="btn btn-sm btn-danger" onClick={() => {
                    setSelectedParent(parent);
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
              <h5>{selectedParent ? 'Edit Parent' : 'Add Parent'}</h5>
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
                  <label>Student *</label>
                  <select className="form-select" name="student_id" value={formData.student_id || ''} onChange={handleInputChange} required>
                    <option value="">Select Student</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.class_name})</option>
                    ))}
                  </select>
                </div>
                {!selectedParent && (
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
              <button className="btn btn-primary" onClick={handleSaveParent}>Save</button>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      <div className={`modal fade ${showResetPasswordModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5>Reset Password for {selectedParent?.name}</h5>
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
              <h5>Create Login Account for {selectedParent?.name}</h5>
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

      <ConfirmModal show={showDeleteModal} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteParent} title="Delete Parent" message={`Are you sure you want to delete ${selectedParent?.name}?`} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Parents;