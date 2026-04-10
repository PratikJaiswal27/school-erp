import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ImageUpload from '../../components/ImageUpload';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { getISTDate } from '../../lib/utils';

interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string;
  profile_image: string | null;
  username?: string;
  assigned_classes: { id: string; name: string }[];
}

interface SalaryRecord {
  id: string;
  month: string;
  paid: boolean;
  paid_date: string | null;
}

interface Document {
  id: string;
  doc_type: string;
  file_path: string;
  original_filename: string;
  uploaded_at: string;
}

const TeacherProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Teacher>>({});
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [updatingSalary, setUpdatingSalary] = useState(false);

  const currentSalaryRecord = salaryRecords.find(rec => {
    const [year, month] = rec.month.split('-');
    return parseInt(year) === selectedYear && parseInt(month) === selectedMonth;
  });

  useEffect(() => {
    if (!id) return;
    fetchTeacher();
    fetchDocuments();
    fetchSalaryRecords();
  }, [id]);

  const fetchTeacher = async () => {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          *,
          users!users_teacher_id_fkey (username),
          class_attendance_teacher (class_id, classes (id, name))
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) {
        const assigned = (data.class_attendance_teacher || []).map((cat: any) => ({
          id: cat.class_id,
          name: cat.classes?.name,
        }));
        setTeacher({
          ...data,
          username: data.users?.username,
          assigned_classes: assigned,
        });
        setFormData(data);
      }
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const fetchSalaryRecords = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('teacher_salary')
      .select('*')
      .eq('teacher_id', id)
      .order('month', { ascending: true });
    if (!error && data) {
      setSalaryRecords(data);
    }
  };

  const fetchDocuments = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('teacher_id', id)
      .order('uploaded_at', { ascending: false });
    if (!error && data) setDocuments(data);
  };

  const handleEdit = () => {
    setEditing(true);
    setFormData(teacher || {});
  };

  const handleSave = async () => {
    if (!teacher) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('teachers')
        .update({
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          profile_image: formData.profile_image,
        })
        .eq('id', teacher.id);
      if (error) throw error;
      setEditing(false);
      fetchTeacher();
      setToast({ message: 'Teacher updated successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!teacher) return;
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('teacher_id', teacher.id)
        .single();
      if (userData) {
        await supabase.from('users').delete().eq('id', userData.id);
      }
      const { error } = await supabase.from('teachers').delete().eq('id', teacher.id);
      if (error) throw error;
      navigate('/teachers');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    if (!teacher) throw new Error('No teacher');
    const fileExt = file.name.split('.').pop();
    const fileName = `teachers/${teacher.id}/profile.${fileExt}`;
    const { error } = await supabase.storage.from('teachers').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('teachers').getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;
    await supabase.from('teachers').update({ profile_image: publicUrl }).eq('id', teacher.id);
    await fetchTeacher();
    return publicUrl;
  };

  const handleImageDelete = async () => {
    if (!teacher?.profile_image) return;
    const path = teacher.profile_image.split('/public/teachers/')[1];
    if (path) {
      await supabase.storage.from('teachers').remove([path]);
    }
    await supabase.from('teachers').update({ profile_image: null }).eq('id', teacher.id);
    await fetchTeacher();
  };

  const handleSalaryToggle = async () => {
    if (!teacher) return;
    setUpdatingSalary(true);
    const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    try {
      if (currentSalaryRecord) {
        const newPaid = !currentSalaryRecord.paid;
        const { error } = await supabase
          .from('teacher_salary')
          .update({
            paid: newPaid,
            paid_date: newPaid ? getISTDate() : null,
          })
          .eq('id', currentSalaryRecord.id);
        if (error) throw error;
        setToast({ message: `Salary for ${monthStr} marked as ${newPaid ? 'Paid' : 'Unpaid'}`, type: 'success' });
      } else {
        const { error } = await supabase
          .from('teacher_salary')
          .insert({
            teacher_id: teacher.id,
            month: monthStr,
            paid: true,
            paid_date: getISTDate(),
          });
        if (error) throw error;
        setToast({ message: `Salary for ${monthStr} marked as Paid`, type: 'success' });
      }
      await fetchSalaryRecords();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setUpdatingSalary(false);
    }
  };

  const handleDocumentUpload = async (files: FileList) => {
    if (!teacher) return;
    setUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `teachers/${teacher.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert({
        teacher_id: teacher.id,
        doc_type: 'Other',
        file_path: fileName,
        original_filename: file.name,
      });
      if (dbError) throw dbError;
    });
    try {
      await Promise.all(uploadPromises);
      fetchDocuments();
      setToast({ message: `${files.length} file(s) uploaded`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDocumentView = async (doc: Document) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path);
    window.open(data.publicUrl, '_blank');
  };

  const handleDocumentDownload = async (doc: Document) => {
    const { data } = supabase.storage.from('documents').getPublicUrl(doc.file_path);
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = doc.original_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDocumentDelete = async (docId: string, filePath: string) => {
    try {
      await supabase.storage.from('documents').remove([filePath]);
      const { error } = await supabase.from('documents').delete().eq('id', docId);
      if (error) throw error;
      fetchDocuments();
      setToast({ message: 'Document deleted', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  if (!teacher) return <div className="text-center mt-5">Loading...</div>;

  const yearOptions = [];
  for (let y = 2020; y <= 2030; y++) yearOptions.push(y);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-4">
            <h2>Teacher Profile</h2>
            {user?.role === 'principal' && (
              <div>
                {!editing && (
                  <button className="btn btn-primary me-2" onClick={handleEdit}>
                    Edit
                  </button>
                )}
                <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
                  Delete
                </button>
              </div>
            )}
          </div>

          <div className="row">
            <div className="col-md-3 text-center">
              <ImageUpload
                onUpload={handleImageUpload}
                existingUrl={teacher.profile_image || undefined}
                onDelete={handleImageDelete}
              />
            </div>
            <div className="col-md-9">
              {!editing ? (
                <div className="row">
                  <div className="col-md-6">
                    <p><strong>Name:</strong> {teacher.name}</p>
                    <p><strong>Phone:</strong> {teacher.phone || '-'}</p>
                    <p><strong>Email:</strong> {teacher.email || '-'}</p>
                    <p><strong>Username:</strong> {teacher.username || '-'}</p>
                  </div>
                  <div className="col-md-6">
                    <p><strong>Assigned Classes:</strong> {teacher.assigned_classes.map(c => c.name).join(', ') || 'None'}</p>
                  </div>
                </div>
              ) : (
                <form>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label>Name *</label>
                      <input type="text" className="form-control" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label>Phone</label>
                      <input type="text" className="form-control" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label>Email</label>
                      <input type="email" className="form-control" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                  </div>
                  <button type="button" className="btn btn-success" onClick={handleSave} disabled={loading}>
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="btn btn-secondary ms-2" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </form>
              )}
            </div>
          </div>

          <hr />

          {/* Salary Section */}
          <div className="row mt-4">
            <div className="col-md-12">
              <h4>Salary History</h4>
              <div className="row mb-3">
                <div className="col-md-3">
                  <label>Year</label>
                  <select className="form-select" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label>Month</label>
                  <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
                    {monthNames.map((name, idx) => <option key={idx + 1} value={idx + 1}>{name}</option>)}
                  </select>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Status</th>
                      <th>Paid Date</th>
                      {user?.role === 'principal' && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSalaryRecord ? (
                      <tr>
                        <td>{monthNames[selectedMonth - 1]} {selectedYear}</td>
                        <td>{currentSalaryRecord.paid ? 'Paid' : 'Unpaid'}</td>
                        <td>{currentSalaryRecord.paid_date ? new Date(currentSalaryRecord.paid_date).toLocaleDateString() : '-'}</td>
                        {user?.role === 'principal' && (
                          <td>
                            <button
                              className={`btn btn-sm ${currentSalaryRecord.paid ? 'btn-warning' : 'btn-success'}`}
                              onClick={handleSalaryToggle}
                              disabled={updatingSalary}
                            >
                              {currentSalaryRecord.paid ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ) : (
                      <tr>
                        <td>{monthNames[selectedMonth - 1]} {selectedYear}</td>
                        <td>No record</td>
                        <td>-</td>
                        {user?.role === 'principal' && (
                          <td>
                            <button className="btn btn-sm btn-success" onClick={handleSalaryToggle} disabled={updatingSalary}>
                              Mark Paid
                            </button>
                          </td>
                        )}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <hr />

          {/* Documents Section */}
          <div className="row mt-4">
            <div className="col-md-12">
              <h4>Documents</h4>
              {user?.role === 'principal' && (
                <div className="mb-3">
                  <input
                    type="file"
                    multiple
                    className="form-control"
                    onChange={(e) => e.target.files && handleDocumentUpload(e.target.files)}
                    disabled={uploading}
                  />
                  {uploading && <div className="mt-2">Uploading...</div>}
                </div>
              )}
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Filename</th>
                      <th>Uploaded At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map(doc => (
                      <tr key={doc.id}>
                        <td>{doc.doc_type}</td>
                        <td>{doc.original_filename}</td>
                        <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                        <td>
                          <button className="btn btn-sm btn-info me-1" onClick={() => handleDocumentView(doc)}>View</button>
                          <button className="btn btn-sm btn-secondary me-1" onClick={() => handleDocumentDownload(doc)}>Download</button>
                          {user?.role === 'principal' && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleDocumentDelete(doc.id, doc.file_path)}>Delete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {documents.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center">No documents uploaded</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Teacher"
        message={`Are you sure you want to delete ${teacher.name}? This will also remove their login account and documents.`}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TeacherProfile;