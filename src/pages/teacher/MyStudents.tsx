import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface Student {
  id: string;
  name: string;
  roll_number: string;
  class_name: string;
  profile_image: string;
}

const MyStudents: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.teacher_id) return;
    const fetchStudents = async () => {
      // Get assigned class IDs
      const { data: classes, error: classError } = await supabase
        .from('class_attendance_teacher')
        .select('class_id')
        .eq('teacher_id', user.teacher_id);
      if (classError || !classes) return;
      const classIds = classes.map(c => c.class_id);
      // Fetch students in those classes
      const { data: studentsData, error: studentError } = await supabase
        .from('students')
        .select(`
          id, name, roll_number, profile_image,
          classes:class_id (name)
        `)
        .in('class_id', classIds)
        .order('roll_number');
      if (!studentError && studentsData) {
        const formatted = studentsData.map(s => {
          let className = '';
          if (s.classes) {
            const classData = s.classes as any;
            if (Array.isArray(classData) && classData.length > 0) {
              className = classData[0]?.name || '';
            } else if (!Array.isArray(classData) && classData.name) {
              className = classData.name;
            }
          }
          return {
            id: s.id,
            name: s.name,
            roll_number: s.roll_number,
            class_name: className,
            profile_image: s.profile_image
          };
        });
        setStudents(formatted);
      }
      setLoading(false);
    };
    fetchStudents();
  }, [user]);

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <h2>My Students</h2>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name</th>
              <th>Roll No</th>
              <th>Class</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td>
                  {s.profile_image ? (
                    <img src={s.profile_image} alt={s.name} style={{ width: 40, height: 40, borderRadius: '50%' }} />
                  ) : (
                    <div className="avatar-placeholder" style={{ width: 40, height: 40, borderRadius: '50%', background: '#ccc' }}></div>
                  )}
                </td>
                <td>{s.name}</td>
                <td>{s.roll_number}</td>
                <td>{s.class_name}</td>
                <td>
                  <Link to={`/students/${s.id}`} className="btn btn-sm btn-primary">View Profile</Link>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center">No students in your assigned classes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyStudents;