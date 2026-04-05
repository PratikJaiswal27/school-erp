import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getISTDate } from '../../lib/utils';
import Toast from '../../components/Toast';
import { downloadCSV } from '../../lib/csv';

const Attendance: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [selectedDate, setSelectedDate] = useState(getISTDate());
  const [selectedClass, setSelectedClass] = useState('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Teacher attendance state
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherClassFilter, setTeacherClassFilter] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name');
    if (data) {
      const sorted = [...data].sort((a, b) => {
        const numA = parseInt(a.name.split(' ')[1]);
        const numB = parseInt(b.name.split(' ')[1]);
        return numA - numB;
      });
      setClasses(sorted);
    }
  };

  // Student attendance: load by date and class
  useEffect(() => {
    if (activeTab === 'student' && selectedClass) {
      loadStudentAttendance();
    }
  }, [selectedClass, selectedDate, activeTab]);

  const loadStudentAttendance = async () => {
    if (!selectedClass) return;
    setLoading(true);
    const { data: studentsData, error: studentsError } = await supabase
      .from('students')
      .select('id, name, roll_number, profile_image')
      .eq('class_id', selectedClass)
      .order('roll_number');
    if (studentsError) {
      setToast({ message: 'Failed to load students', type: 'error' });
      setLoading(false);
      return;
    }
    const { data: attendanceData, error: attError } = await supabase
      .from('attendance')
      .select('student_id, status, edited_by_principal, updated_at')
      .eq('class_id', selectedClass)
      .eq('date', selectedDate);
    if (attError) {
      setToast({ message: 'Failed to load attendance', type: 'error' });
      setLoading(false);
      return;
    }
    const attendanceMap: Record<string, any> = {};
    attendanceData?.forEach(a => { attendanceMap[a.student_id] = a; });
    const studentsWithAtt = studentsData.map(s => ({
      ...s,
      status: attendanceMap[s.id]?.status || 'present',
      edited_by_principal: attendanceMap[s.id]?.edited_by_principal || false,
      updated_at: attendanceMap[s.id]?.updated_at,
    }));
    setStudents(studentsWithAtt);
    setLoading(false);
  };

  const handleStudentStatusChange = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, status } : s));
  };

  const handleSaveStudentAttendance = async () => {
    setLoading(true);
    try {
      for (const student of students) {
        const { error } = await supabase
          .from('attendance')
          .upsert({
            student_id: student.id,
            class_id: selectedClass,
            date: selectedDate,
            status: student.status,
            marked_by: null,
            edited_by_principal: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'student_id,date' });
        if (error) throw error;
      }
      setToast({ message: 'Student attendance saved', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportStudentCSV = async () => {
    if (!selectedClass) {
      setToast({ message: 'Select a class to export', type: 'error' });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        date,
        status,
        edited_by_principal,
        students (name, roll_number)
      `)
      .eq('class_id', selectedClass)
      .order('date', { ascending: false });
    if (error) {
      setToast({ message: 'Export failed', type: 'error' });
    } else {
      const rows = data.map(a => {
        const student = Array.isArray(a.students) ? a.students[0] : a.students;
        return {
          Date: a.date,
          Student: student?.name,
          Roll: student?.roll_number,
          Status: a.status,
          'Edited by Principal': a.edited_by_principal ? 'Yes' : 'No',
        };
      });
      downloadCSV(rows, `attendance_class_${selectedClass}_${new Date().toISOString()}.csv`);
      setToast({ message: 'Export started', type: 'success' });
    }
    setLoading(false);
  };

  // Teacher attendance: load teachers by date with class filter and search
  useEffect(() => {
    if (activeTab === 'teacher') {
      loadTeacherAttendance();
    }
  }, [selectedDate, teacherClassFilter, teacherSearch, activeTab]);

  const loadTeacherAttendance = async () => {
    setLoading(true);
    try {
      let query = supabase.from('teachers').select('id, name, phone, email, profile_image');
      if (teacherClassFilter) {
        const { data: assigned } = await supabase
          .from('class_attendance_teacher')
          .select('teacher_id')
          .eq('class_id', teacherClassFilter);
        if (assigned && assigned.length) {
          const teacherIds = assigned.map(a => a.teacher_id);
          query = query.in('id', teacherIds);
        } else {
          setTeachers([]);
          setLoading(false);
          return;
        }
      }
      if (teacherSearch) {
        query = query.ilike('name', `%${teacherSearch}%`);
      }
      const { data: teachersData, error: teachersError } = await query.order('name');
      if (teachersError) throw teachersError;

      const { data: attendanceData, error: attError } = await supabase
        .from('teacher_attendance')
        .select('teacher_id, time_in')
        .eq('date', selectedDate);
      if (attError) throw attError;

      const attendanceMap: Record<string, string> = {};
      attendanceData?.forEach(a => { attendanceMap[a.teacher_id] = a.time_in; });

      const teachersWithAtt = (teachersData || []).map(t => ({
        ...t,
        time_in: attendanceMap[t.id] || null,
      }));
      setTeachers(teachersWithAtt);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load teacher attendance', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>Attendance Management</h2>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'student' ? 'active' : ''}`} onClick={() => setActiveTab('student')}>Student Attendance (By Date)</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'teacher' ? 'active' : ''}`} onClick={() => setActiveTab('teacher')}>Teacher Attendance</button>
        </li>
      </ul>

      {activeTab === 'student' && (
        <>
          <div className="row mb-3">
            <div className="col-md-3">
              <label className="form-label">Class</label>
              <select className="form-select" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Date</label>
              <input type="date" className="form-control" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            <div className="col-md-2 align-self-end">
              <button className="btn btn-primary" onClick={handleSaveStudentAttendance} disabled={loading || !selectedClass}>
                Save Attendance
              </button>
            </div>
            <div className="col-md-2 align-self-end">
              <button className="btn btn-secondary" onClick={handleExportStudentCSV} disabled={!selectedClass}>
                Export CSV
              </button>
            </div>
          </div>
          {students.length > 0 && (
            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>Roll</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id}>
                      <td>{s.roll_number}</td>
                      <td>{s.name}</td>
                      <td>
                        <div className="form-check form-check-inline">
                          <input className="form-check-input" type="radio" name={`status_${s.id}`} id={`present_${s.id}`} value="present" checked={s.status === 'present'} onChange={() => handleStudentStatusChange(s.id, 'present')} />
                          <label className="form-check-label" htmlFor={`present_${s.id}`}>Present</label>
                        </div>
                        <div className="form-check form-check-inline">
                          <input className="form-check-input" type="radio" name={`status_${s.id}`} id={`absent_${s.id}`} value="absent" checked={s.status === 'absent'} onChange={() => handleStudentStatusChange(s.id, 'absent')} />
                          <label className="form-check-label" htmlFor={`absent_${s.id}`}>Absent</label>
                        </div>
                      </td>
                      <td>
                        {s.edited_by_principal && <span className="badge bg-info">Edited by Principal</span>}
                        {s.updated_at && <small className="text-muted ms-1">{new Date(s.updated_at).toLocaleString()}</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'teacher' && (
        <>
          <div className="row mb-3">
            <div className="col-md-3">
              <label className="form-label">Date</label>
              <input type="date" className="form-control" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Filter by Class</label>
              <select className="form-select" value={teacherClassFilter} onChange={(e) => setTeacherClassFilter(e.target.value)}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Search by Name</label>
              <input type="text" className="form-control" placeholder="Teacher name..." value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} />
            </div>
            <div className="col-md-2 align-self-end">
              <button className="btn btn-secondary" onClick={loadTeacherAttendance} disabled={loading}>
                Refresh
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Attendance Status</th>
                  <th>Time In (IST)</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(teacher => (
                  <tr key={teacher.id}>
                    <td>{teacher.name}</td>
                    <td>{teacher.phone || '-'}</td>
                    <td>{teacher.email || '-'}</td>
                    <td>
                      {teacher.time_in ? (
                        <span className="badge bg-success">Present</span>
                      ) : (
                        <span className="badge bg-danger">Absent</span>
                      )}
                    </td>
                    <td>{teacher.time_in ? teacher.time_in.slice(0, 5) : '-'}</td>
                  </tr>
                ))}
                {teachers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center">No teachers found</td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={5} className="text-center">Loading...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Attendance;