import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getISTNow, getISTDate, getISTTimeString, formatISTTime } from '../../lib/utils';
import Toast from '../../components/Toast';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  profile_image: string;
}

interface AssignedClass {
  id: string;
  name: string;
}

const MarkAttendance: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const classIdFromUrl = searchParams.get('class');
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(classIdFromUrl || '');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<{ [studentId: string]: 'present' | 'absent' | null }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [attendanceStartTime, setAttendanceStartTime] = useState<string>('07:00');
  const [existingAttendance, setExistingAttendance] = useState<{ [studentId: string]: string }>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fetch assigned classes for this teacher
  useEffect(() => {
    if (!user?.teacher_id) return;
    const fetchAssignedClasses = async () => {
      const { data, error } = await supabase
        .from('class_attendance_teacher')
        .select('class_id, classes:class_id(name)')
        .eq('teacher_id', user.teacher_id);
      if (!error && data) {
        const classes = data.map(c => {
          // classes may be array; extract name safely
          let className = '';
          if (c.classes) {
            const classData = c.classes as any;
            if (Array.isArray(classData) && classData.length > 0) {
              className = classData[0]?.name || '';
            } else if (!Array.isArray(classData) && classData.name) {
              className = classData.name;
            }
          }
          return { id: c.class_id, name: className };
        });
        setAssignedClasses(classes);
        // If no class in URL and we have classes, select first
        if (!classIdFromUrl && classes.length > 0) {
          setSelectedClassId(classes[0].id);
          // Update URL to include class param (optional)
          setSearchParams({ class: classes[0].id });
        }
      }
    };
    fetchAssignedClasses();
  }, [user]);

  // Load data when selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) {
      setLoading(false);
      return;
    }
    fetchSettingsAndCheck();
    fetchStudents();
    fetchExistingAttendance();
  }, [selectedClassId]);

  const fetchSettingsAndCheck = async () => {
    const { data: settings, error } = await supabase
      .from('school_settings')
      .select('attendance_start_time')
      .single();
    if (error) {
      console.error('Error fetching settings:', error);
      setBlocked(false);
      return;
    }
    if (settings) {
      setAttendanceStartTime(settings.attendance_start_time);
      const now = getISTNow();
      const [hour, minute] = settings.attendance_start_time.split(':').map(Number);
      const startToday = new Date(now);
      startToday.setHours(hour, minute, 0);
      setBlocked(now < startToday);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, roll_number, profile_image')
        .eq('class_id', selectedClassId)
        .order('roll_number');
      if (error) throw error;
      if (data) {
        setStudents(data);
        const initial: { [key: string]: 'present' | 'absent' | null } = {};
        data.forEach(s => { initial[s.id] = null; });
        setAttendance(initial);
      }
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setToast({ message: err.message || 'Failed to load students', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingAttendance = async () => {
    if (!selectedClassId) return;
    const today = getISTDate();
    const { data, error } = await supabase
      .from('attendance')
      .select('student_id, status')
      .eq('class_id', selectedClassId)
      .eq('date', today);
    if (error) {
      console.error('Error fetching existing attendance:', error);
    } else if (data) {
      const existing: { [key: string]: string } = {};
      data.forEach(rec => { existing[rec.student_id] = rec.status; });
      setExistingAttendance(existing);
    }
  };

  const handleSave = async () => {
    if (Object.keys(existingAttendance).length > 0) {
      setToast({ message: 'Attendance already marked for today. Cannot edit.', type: 'error' });
      return;
    }
    if (!selectedClassId) return;
    setSaving(true);
    const today = getISTDate();
    const updates = [];

    for (const student of students) {
      const status = attendance[student.id];
      if (!status) continue;

      updates.push(
        supabase
          .from('attendance')
          .insert({
            student_id: student.id,
            class_id: selectedClassId,
            date: today,
            status,
            marked_by: user?.teacher_id,
            edited_by_principal: false,
          })
      );
    }

    if (updates.length === 0) {
      setToast({ message: 'No attendance selected', type: 'error' });
      setSaving(false);
      return;
    }

    try {
      await Promise.all(updates);
      setToast({ message: 'Attendance saved successfully', type: 'success' });
      await fetchExistingAttendance();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Handle class change from dropdown
  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSearchParams({ class: classId });
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  // If no assigned classes at all
  if (assignedClasses.length === 0) {
    return <div className="alert alert-warning">No classes assigned to you.</div>;
  }

  // If no class selected yet (should not happen, but fallback)
  if (!selectedClassId) {
    return <div className="alert alert-warning">Please select a class from the dropdown.</div>;
  }

  if (blocked) {
    const startTimeFormatted = formatISTTime(attendanceStartTime);
    const currentTime = formatISTTime(getISTTimeString());
    return (
      <div className="container mt-5">
        <div className="alert alert-warning">
          Attendance opens at {startTimeFormatted}. Current time: {currentTime}.
        </div>
      </div>
    );
  }

  const hasExistingToday = Object.keys(existingAttendance).length > 0;
  if (hasExistingToday) {
    return (
      <div className="container py-4">
        <h2>Attendance Already Marked Today</h2>
        <div className="mb-3">
          <label>Select Class</label>
          <select
            className="form-select"
            value={selectedClassId}
            onChange={(e) => handleClassChange(e.target.value)}
          >
            {assignedClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="table-responsive">
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.roll_number}</td>
                  <td>
                    <span className={`badge ${existingAttendance[student.id] === 'present' ? 'bg-success' : 'bg-danger'}`}>
                      {existingAttendance[student.id] === 'present' ? 'Present' : 'Absent'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <h2>Mark Attendance</h2>
      <div className="mb-3">
        <label>Select Class</label>
        <select
          className="form-select"
          value={selectedClassId}
          onChange={(e) => handleClassChange(e.target.value)}
        >
          {assignedClasses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name</th>
              <th>Roll No</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id}>
                <td>
                  {student.profile_image ? (
                    <img src={student.profile_image} alt={student.name} style={{ width: 40, height: 40, borderRadius: '50%' }} />
                  ) : (
                    <div className="avatar-placeholder" style={{ width: 40, height: 40, borderRadius: '50%', background: '#ccc', display: 'inline-block' }}></div>
                  )}
                </td>
                <td>{student.name}</td>
                <td>{student.roll_number}</td>
                <td>
                  <div className="btn-group" role="group">
                    <button
                      type="button"
                      className={`btn btn-sm ${attendance[student.id] === 'present' ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setAttendance({ ...attendance, [student.id]: 'present' })}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${attendance[student.id] === 'absent' ? 'btn-danger' : 'btn-outline-danger'}`}
                      onClick={() => setAttendance({ ...attendance, [student.id]: 'absent' })}
                    >
                      Absent
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn btn-primary mt-3" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Attendance'}
      </button>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default MarkAttendance;