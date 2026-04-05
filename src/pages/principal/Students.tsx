import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { uploadFile, deleteFile, generateFileName, getSignedUrl } from '../../lib/storage';
import { parseCSV, downloadCSV } from '../../lib/csv';
import ImageUpload from '../../components/ImageUpload';
import ConfirmModal from '../../components/ConfirmModal';
import Toast from '../../components/Toast';

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
  profile_image: string | null;
}

interface Class {
  id: string;
  name: string;
}

const Students: React.FC = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<{ added: number; failed: number; errors: string[] } | null>(null);
  const [promoteClass, setPromoteClass] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Fetch classes and sort numerically
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data, error } = await supabase.from('classes').select('id, name');
    if (error) {
      console.error(error);
    } else if (data) {
      // Sort classes numerically by the class number (e.g., "Class 1" -> 1, "Class 10" -> 10)
      const sorted = [...data].sort((a, b) => {
        const numA = parseInt(a.name.split(' ')[1]);
        const numB = parseInt(b.name.split(' ')[1]);
        return numA - numB;
      });
      setClasses(sorted);
    }
  };

  // Fetch students with pagination and filters
  const fetchStudents = async () => {
    setLoading(true);
    let query = supabase
      .from('students')
      .select(`
        id,
        name,
        class_id,
        roll_number,
        father_name,
        mother_name,
        dob,
        gender,
        religion,
        address,
        profile_image,
        classes (name)
      `, { count: 'exact' })
      .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
      .order('name');

    if (filterClass) {
      query = query.eq('class_id', filterClass);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error(error);
      setToast({ message: 'Failed to fetch students', type: 'error' });
    } else {
      const formatted = (data || []).map((s: any) => ({
        ...s,
        class_name: s.classes?.name,
      }));
      setStudents(formatted);
      setTotalPages(Math.ceil((count || 0) / pageSize));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [currentPage, filterClass, search]);

  // Handle add/edit form change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle student image upload
  const handleImageUpload = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `students/${generateFileName(file.name)}`;
    const { error } = await supabase.storage.from('students').upload(fileName, file);
    if (error) throw error;
    const { data: publicUrlData } = supabase.storage.from('students').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  };

  const handleImageDelete = async () => {
    if (formData.profile_image) {
      const path = formData.profile_image.split('/public/students/')[1];
      if (path) {
        await supabase.storage.from('students').remove([path]);
      }
      setFormData(prev => ({ ...prev, profile_image: null }));
    }
  };

  // Save student (add or edit)
  const handleSaveStudent = async () => {
    if (!formData.name || !formData.class_id || !formData.roll_number) {
      setToast({ message: 'Please fill required fields (name, class, roll number)', type: 'error' });
      return;
    }

    try {
      if (selectedStudent) {
        // Update
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
          .eq('id', selectedStudent.id);
        if (error) throw error;
        setToast({ message: 'Student updated', type: 'success' });
      } else {
        // Insert
        const { error } = await supabase.from('students').insert({
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
        });
        if (error) throw error;
        setToast({ message: 'Student added', type: 'success' });
      }
      setShowAddModal(false);
      setShowEditModal(false);
      fetchStudents();
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Failed to save student', type: 'error' });
    }
  };

  // Delete student
  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    try {
      if (selectedStudent.profile_image) {
        const path = selectedStudent.profile_image.split('/public/students/')[1];
        if (path) {
          await supabase.storage.from('students').remove([path]);
        }
      }
      const { error } = await supabase.from('students').delete().eq('id', selectedStudent.id);
      if (error) throw error;
      setToast({ message: 'Student deleted', type: 'success' });
      setShowDeleteModal(false);
      fetchStudents();
    } catch (err: any) {
      setToast({ message: err.message || 'Delete failed', type: 'error' });
    }
  };

  // CSV Import
  const handleCSVImport = async () => {
    if (!csvFile) return;
    try {
      const data: any[] = await parseCSV(csvFile);
      let added = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const row of data) {
        if (!row.name || !row.class_name || !row.roll_number) {
          failed++;
          errors.push(`Missing required fields in row: ${JSON.stringify(row)}`);
          continue;
        }
        const classObj = classes.find(c => c.name === row.class_name);
        if (!classObj) {
          failed++;
          errors.push(`Class not found: ${row.class_name}`);
          continue;
        }
        const studentData = {
          name: row.name,
          class_id: classObj.id,
          roll_number: row.roll_number,
          father_name: row.father_name || '',
          mother_name: row.mother_name || '',
          dob: row.dob || null,
          gender: row.gender || '',
          religion: row.religion || '',
          address: row.address || '',
        };
        const { error } = await supabase.from('students').insert(studentData);
        if (error) {
          failed++;
          errors.push(`Error inserting ${row.name}: ${error.message}`);
        } else {
          added++;
        }
      }
      setCsvResult({ added, failed, errors });
      if (added > 0) {
        fetchStudents();
      }
    } catch (err: any) {
      setToast({ message: err.message || 'CSV import failed', type: 'error' });
    }
  };

  // Promote students
  const handlePromote = async () => {
    if (!promoteClass) {
      setToast({ message: 'Select a target class', type: 'error' });
      return;
    }
    try {
      const { error } = await supabase
        .from('students')
        .update({ class_id: promoteClass })
        .in('id', selectedStudentIds);
      if (error) throw error;
      setToast({ message: `${selectedStudentIds.length} students promoted`, type: 'success' });
      setShowPromoteModal(false);
      setSelectedStudentIds([]);
      fetchStudents();
    } catch (err: any) {
      setToast({ message: err.message || 'Promotion failed', type: 'error' });
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    const headers = ['name', 'class_name', 'roll_number', 'father_name', 'mother_name', 'dob', 'gender', 'religion', 'address'];
    const sampleRow = ['Arjun Sharma', 'Class 1', '1', 'Ramesh Sharma', 'Sunita Sharma', '2015-04-10', 'Male', 'Hindu', '12 MG Road Amritsar'];
    const data = [headers, sampleRow];
    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'student_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Student Management</h2>
        <div>
          <button className="btn btn-primary me-2" onClick={() => { setFormData({}); setSelectedStudent(null); setShowAddModal(true); }}>
            <i className="bi bi-plus-circle"></i> Add Student
          </button>
          <button className="btn btn-outline-primary me-2" onClick={() => setShowCSVModal(true)}>
            <i className="bi bi-filetype-csv"></i> Import CSV
          </button>
          <button className="btn btn-outline-secondary" onClick={downloadTemplate}>
            <i className="bi bi-download"></i> Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="row mb-3">
        <div className="col-md-3">
          <select className="form-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <input type="text" className="form-control" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="col-md-2">
          <button className="btn btn-success" onClick={() => setShowPromoteModal(true)} disabled={selectedStudentIds.length === 0}>
            Promote Selected ({selectedStudentIds.length})
          </button>
        </div>
      </div>

      {/* Student Table */}
      <div className="table-responsive">
        <table className="table table-hover table-striped">
          <thead>
            <tr>
              <th><input type="checkbox" onChange={(e) => {
                if (e.target.checked) setSelectedStudentIds(students.map(s => s.id));
                else setSelectedStudentIds([]);
              }} /></th>
              <th>Photo</th>
              <th>Name</th>
              <th>Class</th>
              <th>Roll</th>
              <th>Gender</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(student.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedStudentIds(prev => [...prev, student.id]);
                      else setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                    }}
                  />
                </td>
                <td>
                  <img
                    src={student.profile_image || ''}
                    alt="profile"
                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '50%' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </td>
                <td>{student.name}</td>
                <td>{student.class_name}</td>
                <td>{student.roll_number}</td>
                <td>{student.gender}</td>
                <td>
                  <button className="btn btn-sm btn-info me-1" onClick={() => {
                    setSelectedStudent(student);
                    setFormData(student);
                    setShowEditModal(true);
                  }}>
                    <i className="bi bi-pencil"></i> Edit
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => {
                    setSelectedStudent(student);
                    setShowDeleteModal(true);
                  }}>
                    <i className="bi bi-trash"></i> Delete
                  </button>
                  <button className="btn btn-sm btn-secondary ms-1" onClick={() => navigate(`/students/${student.id}`)}>
                    <i className="bi bi-eye"></i> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <nav>
        <ul className="pagination">
          <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => setCurrentPage(p => p-1)}>Previous</button>
          </li>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <li key={p} className={`page-item ${p === currentPage ? 'active' : ''}`}>
              <button className="page-link" onClick={() => setCurrentPage(p)}>{p}</button>
            </li>
          ))}
          <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => setCurrentPage(p => p+1)}>Next</button>
          </li>
        </ul>
      </nav>

      {/* Add/Edit Modal */}
      <div className={`modal fade ${showAddModal || showEditModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{selectedStudent ? 'Edit Student' : 'Add Student'}</h5>
              <button type="button" className="btn-close" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}></button>
            </div>
            <div className="modal-body">
              <form>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Name *</label>
                    <input type="text" className="form-control" name="name" value={formData.name || ''} onChange={handleInputChange} required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Class *</label>
                    <select className="form-select" name="class_id" value={formData.class_id || ''} onChange={handleInputChange} required>
                      <option value="">Select Class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Roll Number *</label>
                    <input type="text" className="form-control" name="roll_number" value={formData.roll_number || ''} onChange={handleInputChange} required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Father's Name</label>
                    <input type="text" className="form-control" name="father_name" value={formData.father_name || ''} onChange={handleInputChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Mother's Name</label>
                    <input type="text" className="form-control" name="mother_name" value={formData.mother_name || ''} onChange={handleInputChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Date of Birth</label>
                    <input type="date" className="form-control" name="dob" value={formData.dob || ''} onChange={handleInputChange} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Gender</label>
                    <select className="form-select" name="gender" value={formData.gender || ''} onChange={handleInputChange}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Religion</label>
                    <input type="text" className="form-control" name="religion" value={formData.religion || ''} onChange={handleInputChange} />
                  </div>
                  <div className="col-md-12 mb-3">
                    <label className="form-label">Address</label>
                    <textarea className="form-control" name="address" rows={2} value={formData.address || ''} onChange={handleInputChange}></textarea>
                  </div>
                  <div className="col-md-12 mb-3">
                    <label className="form-label">Profile Photo</label>
                    <ImageUpload
                      onUpload={handleImageUpload}
                      existingUrl={formData.profile_image || undefined}
                      onDelete={handleImageDelete}
                    />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveStudent}>Save</button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <ConfirmModal
        show={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteStudent}
        title="Delete Student"
        message={`Are you sure you want to delete ${selectedStudent?.name}? This will also delete all attendance, fees, documents, and parent account linked.`}
      />

      {/* CSV Import Modal */}
      <div className={`modal fade ${showCSVModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Import Students from CSV</h5>
              <button className="btn-close" onClick={() => setShowCSVModal(false)}></button>
            </div>
            <div className="modal-body">
              <input type="file" className="form-control" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
              {csvResult && (
                <div className="mt-2">
                  <p>Added: {csvResult.added}, Failed: {csvResult.failed}</p>
                  {csvResult.errors.length > 0 && (
                    <pre className="small text-danger">{csvResult.errors.join('\n')}</pre>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCSVModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCSVImport}>Import</button>
            </div>
          </div>
        </div>
      </div>

      {/* Promote Modal */}
      <div className={`modal fade ${showPromoteModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Promote Students</h5>
              <button className="btn-close" onClick={() => setShowPromoteModal(false)}></button>
            </div>
            <div className="modal-body">
              <label className="form-label">Select target class:</label>
              <select className="form-select" value={promoteClass} onChange={(e) => setPromoteClass(e.target.value)}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="mt-2">Promoting {selectedStudentIds.length} student(s).</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPromoteModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={handlePromote}>Promote</button>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Students;