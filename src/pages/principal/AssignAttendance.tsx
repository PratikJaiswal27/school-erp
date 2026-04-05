import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Toast from '../../components/Toast';

const AssignAttendance: React.FC = () => {
  const [classes, setClasses] = useState<{ id: string; name: string; teacher_id?: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch classes without ordering (we'll sort manually)
    const { data: classesData } = await supabase.from('classes').select('id, name');
    // Fetch current assignments
    const { data: assignments } = await supabase.from('class_attendance_teacher').select('class_id, teacher_id');
    // Fetch teachers and order by name alphabetically
    const { data: teachersData } = await supabase.from('teachers').select('id, name').order('name');

    if (classesData) {
      // Sort classes numerically by class number (e.g., "Class 1" -> 1, "Class 10" -> 10)
      const sortedClasses = [...classesData].sort((a, b) => {
        const numA = parseInt(a.name.split(' ')[1]);
        const numB = parseInt(b.name.split(' ')[1]);
        return numA - numB;
      });
      const classList = sortedClasses.map(c => ({
        ...c,
        teacher_id: assignments?.find(a => a.class_id === c.id)?.teacher_id,
      }));
      setClasses(classList);
    }
    setTeachers(teachersData || []);
    setLoading(false);
  };

  const handleTeacherChange = (classId: string, teacherId: string) => {
    setClasses(prev => prev.map(c => c.id === classId ? { ...c, teacher_id: teacherId } : c));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // For each class, upsert assignment
      for (const cls of classes) {
        if (cls.teacher_id) {
          // Insert or update
          const { error } = await supabase
            .from('class_attendance_teacher')
            .upsert({ class_id: cls.id, teacher_id: cls.teacher_id }, { onConflict: 'class_id' });
          if (error) throw error;
        } else {
          // If teacher_id is empty, delete if exists
          const { error } = await supabase
            .from('class_attendance_teacher')
            .delete()
            .eq('class_id', cls.id);
          if (error) throw error;
        }
      }
      setToast({ message: 'Assignments saved', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="container">
      <h2>Assign Attendance Teachers</h2>
      <p>Assign which teacher is responsible for taking attendance for each class.</p>
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Class</th>
              <th>Assigned Teacher</th>
            </tr>
          </thead>
          <tbody>
            {classes.map(cls => (
              <tr key={cls.id}>
                <td>{cls.name}</td>
                <td>
                  <select
                    className="form-select"
                    value={cls.teacher_id || ''}
                    onChange={(e) => handleTeacherChange(cls.id, e.target.value)}
                  >
                    <option value="">-- None --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Assignments'}
        </button>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AssignAttendance;