import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { calculateGrade } from '../../lib/grade';
import Toast from '../../components/Toast';

interface ClassInfo {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  roll_number: string;
}

interface Exam {
  id: string;
  exam_name: string;
  academic_year: string;
  finalized: boolean;
}

interface Mark {
  subject: string;
  max_marks: number;
  marks_obtained: number;
  grade: string;
  remarks: string;
}

const MarksEntry: React.FC = () => {
  const { user } = useAuth();
  const [assignedClasses, setAssignedClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewExamModal, setShowNewExamModal] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newAcademicYear, setNewAcademicYear] = useState(new Date().getFullYear().toString());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchAssignedClasses();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchExams();
      fetchStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedStudent && selectedExam) {
      fetchMarks();
    }
  }, [selectedStudent, selectedExam]);

  const fetchAssignedClasses = async () => {
    if (!user?.teacher_id) return;
    const { data: classData, error } = await supabase
      .from('class_attendance_teacher')
      .select('class_id, classes:class_id(name)')
      .eq('teacher_id', user.teacher_id);
    if (!error && classData) {
      const classes = classData.map(c => {
        let className = '';
        if (c.classes) {
          const classDataRaw = c.classes as any;
          if (Array.isArray(classDataRaw) && classDataRaw.length > 0) {
            className = classDataRaw[0]?.name || '';
          } else if (!Array.isArray(classDataRaw) && classDataRaw.name) {
            className = classDataRaw.name;
          }
        }
        return { id: c.class_id, name: className };
      });
      setAssignedClasses(classes);
      if (classes.length > 0) setSelectedClass(classes[0]);
    }
  };

  const fetchExams = async () => {
    if (!selectedClass) return;
    const { data, error } = await supabase
      .from('report_cards')
      .select('id, exam_name, academic_year, finalized')
      .eq('class_id', selectedClass.id)
      .order('created_at', { ascending: false });
    if (!error && data) setExams(data);
  };

  const fetchStudents = async () => {
    if (!selectedClass) return;
    const { data, error } = await supabase
      .from('students')
      .select('id, name, roll_number')
      .eq('class_id', selectedClass.id)
      .order('roll_number');
    if (!error && data) setStudents(data);
  };

  const fetchMarks = async () => {
    if (!selectedStudent || !selectedExam) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('report_card_marks')
      .select('*')
      .eq('report_card_id', selectedExam.id)
      .eq('student_id', selectedStudent.id);
    if (!error && data) {
      const marksArray: Mark[] = data.map(row => ({
        subject: row.subject,
        max_marks: row.max_marks,
        marks_obtained: row.marks_obtained,
        grade: row.grade,
        remarks: row.remarks || ''
      }));
      setMarks(marksArray);
    } else {
      setMarks([]);
    }
    setLoading(false);
  };

  const handleCreateExam = async () => {
    if (!selectedClass || !newExamName || !newAcademicYear) {
      setToast({ message: 'Please enter exam name and academic year', type: 'error' });
      return;
    }
    const { data, error } = await supabase
      .from('report_cards')
      .insert({
        class_id: selectedClass.id,
        exam_name: newExamName,
        academic_year: newAcademicYear,
        created_by: user?.teacher_id,
        finalized: false
      })
      .select()
      .single();
    if (!error && data) {
      setExams([data, ...exams]);
      setSelectedExam(data);
      setShowNewExamModal(false);
      setNewExamName('');
    } else {
      setToast({ message: error?.message || 'Failed to create exam', type: 'error' });
    }
  };

  const addMarkRow = () => {
    setMarks([...marks, { subject: '', max_marks: 0, marks_obtained: 0, grade: '', remarks: '' }]);
  };

  const removeMarkRow = (index: number) => {
    setMarks(prev => prev.filter((_, i) => i !== index));
  };

  const updateMark = (index: number, field: keyof Mark, value: any) => {
    setMarks(prev => {
      const newMarks = [...prev];
      newMarks[index] = { ...newMarks[index], [field]: value };
      if (field === 'marks_obtained' && newMarks[index].max_marks) {
        newMarks[index].grade = calculateGrade(value, newMarks[index].max_marks);
      }
      return newMarks;
    });
  };

  const saveMarks = async () => {
    if (!selectedStudent || !selectedExam) return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from('report_card_marks')
      .delete()
      .eq('report_card_id', selectedExam.id)
      .eq('student_id', selectedStudent.id);
    if (deleteError) {
      setToast({ message: deleteError.message, type: 'error' });
      setSaving(false);
      return;
    }
    const inserts = marks.map(m => ({
      report_card_id: selectedExam.id,
      student_id: selectedStudent.id,
      subject: m.subject,
      max_marks: m.max_marks,
      marks_obtained: m.marks_obtained,
      grade: m.grade,
      remarks: m.remarks
    }));
    const { error: insertError } = await supabase
      .from('report_card_marks')
      .insert(inserts);
    if (!insertError) {
      setToast({ message: 'Marks saved', type: 'success' });
    } else {
      setToast({ message: insertError.message, type: 'error' });
    }
    setSaving(false);
  };

  if (!selectedClass) return <div className="text-center mt-5">No classes assigned.</div>;

  return (
    <div className="container py-4">
      <h2>Marks Entry</h2>
      <div className="row mb-3">
        <div className="col-md-4">
          <label>Class</label>
          <select
            className="form-select"
            value={selectedClass?.id}
            onChange={(e) => {
              const cls = assignedClasses.find(c => c.id === e.target.value);
              if (cls) setSelectedClass(cls);
            }}
          >
            {assignedClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label>Exam</label>
          <div className="d-flex">
            <select
              className="form-select"
              value={selectedExam?.id || ''}
              onChange={(e) => {
                const exam = exams.find(ex => ex.id === e.target.value);
                if (exam) setSelectedExam(exam);
              }}
            >
              <option value="">Select Exam</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.academic_year}) {ex.finalized ? '(Finalized)' : ''}</option>
              ))}
            </select>
            <button className="btn btn-primary ms-2" onClick={() => setShowNewExamModal(true)}>New Exam</button>
          </div>
        </div>
        <div className="col-md-4">
          <label>Student</label>
          <select
            className="form-select"
            value={selectedStudent?.id || ''}
            onChange={(e) => {
              const student = students.find(s => s.id === e.target.value);
              if (student) setSelectedStudent(student);
            }}
          >
            <option value="">Select Student</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name} (Roll {s.roll_number})</option>
            ))}
          </select>
        </div>
      </div>

      {selectedExam && selectedStudent && (
        <>
          {selectedExam.finalized ? (
            <div className="alert alert-warning">This report card is finalized. Marks cannot be edited.</div>
          ) : (
            <>
              <div className="mb-3">
                <button className="btn btn-sm btn-success me-2" onClick={addMarkRow}>Add Subject</button>
                <button className="btn btn-primary" onClick={saveMarks} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Marks'}
                </button>
              </div>
              <div className="table-responsive">
                {/* Added class "marks-table" to keep headers visible on mobile */}
                <table className="table table-bordered marks-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Max Marks</th>
                      <th>Marks Obtained</th>
                      <th>Grade</th>
                      <th>Remarks</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.map((mark, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            value={mark.subject}
                            onChange={(e) => updateMark(idx, 'subject', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control"
                            value={mark.max_marks}
                            onChange={(e) => updateMark(idx, 'max_marks', parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control"
                            value={mark.marks_obtained}
                            onChange={(e) => updateMark(idx, 'marks_obtained', parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            value={mark.grade}
                            readOnly
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control"
                            value={mark.remarks}
                            onChange={(e) => updateMark(idx, 'remarks', e.target.value)}
                          />
                        </td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={() => removeMarkRow(idx)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                    {marks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center">No subjects added. Click "Add Subject" to start.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* New Exam Modal - with input fields */}
      {showNewExamModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create New Exam</h5>
                <button type="button" className="btn-close" onClick={() => setShowNewExamModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Exam Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newExamName}
                    onChange={(e) => setNewExamName(e.target.value)}
                    placeholder="e.g., Half Yearly, Final Exam"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Academic Year</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newAcademicYear}
                    onChange={(e) => setNewAcademicYear(e.target.value)}
                    placeholder="e.g., 2025-2026 or 2025"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowNewExamModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateExam}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default MarksEntry;