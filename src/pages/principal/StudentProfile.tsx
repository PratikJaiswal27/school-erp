import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ImageUpload from '../../components/ImageUpload';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';
import { getISTDate } from '../../lib/utils';

interface Student {
  id: string;
  name: string;
  class_id: string;
  class_name?: string;
  roll_number: string;
  father_name: string;
  mother_name: string;
  dob: string;
  gender: string;
  religion: string;
  address: string;
  profile_image: string;
}

interface Fee {
  id: string;
  month: string;
  paid: boolean;
  paid_date: string | null;
  remarks: string;
}

interface Document {
  id: string;
  doc_type: string;
  file_path: string;
  original_filename: string;
  uploaded_at: string;
}

const StudentProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [attendance, setAttendance] = useState<{ present: number; absent: number; percentage: number }>({ present: 0, absent: 0, percentage: 0 });
  const [fees, setFees] = useState<Fee[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Fetch student data, classes, attendance, fees, documents
  useEffect(() => {
    if (!id) return;
    fetchStudent();
    fetchClasses();
    fetchAttendance();
    fetchFees();
    fetchDocuments();
  }, [id]);

  const fetchStudent = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          classes:class_id (name)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) {
        setStudent({
          ...data,
          class_name: data.classes?.name,
        });
        setFormData(data);
      }
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('id, name').order('name');
    if (!error && data) setClasses(data);
  };

  const fetchAttendance = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', id)
      .gte('date', startDate);
    if (!error && data) {
      const present = data.filter(a => a.status === 'present').length;
      const absent = data.filter(a => a.status === 'absent').length;
      const total = present + absent;
      const percentage = total === 0 ? 0 : (present / total) * 100;
      setAttendance({ present, absent, percentage: Math.round(percentage) });
    }
  };

  const fetchFees = async () => {
    const { data, error } = await supabase
      .from('fees')
      .select('*')
      .eq('student_id', id)
      .order('month', { ascending: true });
    if (!error && data) setFees(data);
  };

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('student_id', id)
      .order('uploaded_at', { ascending: false });
    if (!error && data) setDocuments(data);
  };

  const handleEdit = () => {
    setEditing(true);
    setFormData(student || {});
  };

  const handleSave = async () => {
    if (!student) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: formData.name,
          class_id: formData.class_id,
          roll_number: formData.roll_number,
          father_name: formData.father_name,
          mother_name: formData.mother_name,
          dob: formData.dob,
          gender: formData.gender,
          religion: formData.religion,
          address: formData.address,
          profile_image: formData.profile_image,
        })
        .eq('id', student.id);
      if (error) throw error;
      setEditing(false);
      fetchStudent();
      setToast({ message: 'Student updated successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!student) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', student.id);
      if (error) throw error;
      navigate('/students');
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const handleFeeToggle = async (feeId: string, currentPaid: boolean) => {
    try {
      const { error } = await supabase
        .from('fees')
        .update({
          paid: !currentPaid,
          paid_date: !currentPaid ? getISTDate() : null,
        })
        .eq('id', feeId);
      if (error) throw error;
      fetchFees();
      setToast({ message: `Fee marked as ${!currentPaid ? 'paid' : 'unpaid'}`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  // Image upload handler for student profile photo
  const handleStudentPhotoUpload = async (file: File): Promise<string> => {
    if (!student) throw new Error('No student');
    const fileExt = file.name.split('.').pop();
    const fileName = `${student.id}/profile.${fileExt}`;
    const { error } = await supabase.storage.from('students').upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('students').getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from('students')
      .update({ profile_image: publicUrl })
      .eq('id', student.id);
    if (updateError) throw updateError;

    await fetchStudent();
    return publicUrl;
  };

  const handleStudentPhotoDelete = async () => {
    if (!student) return;
    const filePath = `${student.id}/profile.${student.profile_image?.split('/').pop()?.split('.')[1]}`;
    await supabase.storage.from('students').remove([filePath]);
    const { error } = await supabase.from('students').update({ profile_image: null }).eq('id', student.id);
    if (error) throw error;
    await fetchStudent();
  };

  const handleDocumentUpload = async (files: FileList) => {
    if (!student) return;
    setUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${student.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('documents').insert({
        student_id: student.id,
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

  if (!student) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-4">
            <h2>Student Profile</h2>
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

          {/* Student Info */}
          <div className="row">
            <div className="col-md-3 text-center">
              <ImageUpload
                onUpload={handleStudentPhotoUpload}
                existingUrl={student.profile_image || undefined}
                onDelete={handleStudentPhotoDelete}
              />
            </div>
            <div className="col-md-9">
              {!editing ? (
                <div className="row">
                  <div className="col-md-6">
                    <p><strong>Name:</strong> {student.name}</p>
                    <p><strong>Class:</strong> {student.class_name}</p>
                    <p><strong>Roll Number:</strong> {student.roll_number}</p>
                    <p><strong>Father's Name:</strong> {student.father_name}</p>
                    <p><strong>Mother's Name:</strong> {student.mother_name}</p>
                    <p><strong>Date of Birth:</strong> {student.dob}</p>
                  </div>
                  <div className="col-md-6">
                    <p><strong>Gender:</strong> {student.gender}</p>
                    <p><strong>Religion:</strong> {student.religion}</p>
                    <p><strong>Address:</strong> {student.address}</p>
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
                      <label>Class *</label>
                      <select className="form-select" value={formData.class_id || ''} onChange={e => setFormData({ ...formData, class_id: e.target.value })} required>
                        <option value="">Select Class</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label>Roll Number *</label>
                      <input type="text" className="form-control" value={formData.roll_number || ''} onChange={e => setFormData({ ...formData, roll_number: e.target.value })} required />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label>Father's Name</label>
                      <input type="text" className="form-control" value={formData.father_name || ''} onChange={e => setFormData({ ...formData, father_name: e.target.value })} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label>Mother's Name</label>
                      <input type="text" className="form-control" value={formData.mother_name || ''} onChange={e => setFormData({ ...formData, mother_name: e.target.value })} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label>Date of Birth</label>
                      <input type="date" className="form-control" value={formData.dob || ''} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label>Gender</label>
                      <select className="form-select" value={formData.gender || ''} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label>Religion</label>
                      <input type="text" className="form-control" value={formData.religion || ''} onChange={e => setFormData({ ...formData, religion: e.target.value })} />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label>Address</label>
                      <textarea className="form-control" rows={2} value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
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

          {/* Attendance Summary */}
          <div className="row mt-4">
            <div className="col-md-12">
              <h4>Attendance Summary (Last 30 Days)</h4>
              <div className="card bg-light p-3">
                <p>Present: {attendance.present} days</p>
                <p>Absent: {attendance.absent} days</p>
                <p>Percentage: {attendance.percentage}%</p>
              </div>
            </div>
          </div>

          <hr />

          {/* Fee Table */}
          <div className="row mt-4">
            <div className="col-md-12">
              <h4>Fee Details</h4>
              <div className="table-responsive">
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Paid</th>
                      <th>Paid Date</th>
                      <th>Remarks</th>
                      {user?.role === 'principal' && <th>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map(fee => (
                      <tr key={fee.id}>
                        <td>{new Date(fee.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td>
                        <td>{fee.paid ? 'Yes' : 'No'}</td>
                        <td>{fee.paid_date ? new Date(fee.paid_date).toLocaleDateString() : '-'}</td>
                        <td>{fee.remarks || '-'}</td>
                        {user?.role === 'principal' && (
                          <td>
                            <button
                              className={`btn btn-sm ${fee.paid ? 'btn-warning' : 'btn-success'}`}
                              onClick={() => handleFeeToggle(fee.id, fee.paid)}
                            >
                              {fee.paid ? 'Mark Unpaid' : 'Mark Paid'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {fees.length === 0 && (
                      <tr>
                        <td colSpan={user?.role === 'principal' ? 5 : 4} className="text-center">
                          No fee records found
                        </td>
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Student"
        message="Are you sure you want to delete this student? All related records (attendance, fees, documents, parent account) will be permanently deleted."
      />

      {/* Toast Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default StudentProfile;