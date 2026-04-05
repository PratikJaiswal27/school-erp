import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getISTTimeString, formatISTTime } from '../../lib/utils';
import { Link } from 'react-router-dom';

interface AssignedClass {
  id: string;
  name: string;
  teacher_id: string;
}

interface TodayAttendance {
  class_id: string;
  class_name: string;
  marked_count: number;
  total_students: number;
  marked_at?: string;
}

const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const [assignedClasses, setAssignedClasses] = useState<AssignedClass[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance[]>([]);
  const [myAttendance, setMyAttendance] = useState<{ marked: boolean; time?: string }>({ marked: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!user?.teacher_id) return;
    setLoading(true);

    // Fetch classes assigned to this teacher
    const { data: classData, error: classError } = await supabase
      .from('class_attendance_teacher')
      .select('class_id, classes:class_id(name)')
      .eq('teacher_id', user.teacher_id);
    if (!classError && classData) {
      const classes = classData.map(c => {
        // classes may be an array; extract name safely
        let className = '';
        const classesData = c.classes as any;
        if (classesData) {
          if (Array.isArray(classesData) && classesData.length > 0) {
            className = classesData[0]?.name || '';
          } else if (!Array.isArray(classesData) && classesData.name) {
            className = classesData.name;
          }
        }
        return {
          id: c.class_id,
          name: className,
          teacher_id: user.teacher_id!
        };
      });
      setAssignedClasses(classes);

      // For each class, get today's attendance count
      const today = new Date().toISOString().slice(0, 10);
      const attendancePromises = classes.map(async (cls) => {
        const { count: markedCount, error } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', cls.id)
          .eq('date', today);
        if (error) return null;
        // Get total students in class
        const { count: totalStudents } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', cls.id);
        return {
          class_id: cls.id,
          class_name: cls.name,
          marked_count: markedCount || 0,
          total_students: totalStudents || 0,
          marked_at: undefined
        };
      });
      const results = await Promise.all(attendancePromises);
      setTodayAttendance(results.filter(r => r !== null) as TodayAttendance[]);
    }

    // Check if teacher marked own attendance today
    const today = new Date().toISOString().slice(0, 10);
    const { data: teacherAtt, error: taError } = await supabase
      .from('teacher_attendance')
      .select('time_in')
      .eq('teacher_id', user.teacher_id)
      .eq('date', today)
      .maybeSingle();
    if (!taError && teacherAtt) {
      setMyAttendance({ marked: true, time: teacherAtt.time_in });
    }

    setLoading(false);
  };

  const handleMarkOwnAttendance = async () => {
    if (!user?.teacher_id) return;
    const timeIn = getISTTimeString(); // HH:MM:SS in IST
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from('teacher_attendance')
      .insert({ teacher_id: user.teacher_id, date: today, time_in: timeIn });
    if (!error) {
      setMyAttendance({ marked: true, time: timeIn });
    } else {
      alert('Failed to mark attendance.');
    }
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Welcome, {user?.username}</h2>
      </div>

      <div className="row">
        {/* My Classes Card */}
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-header bg-primary text-white">
              My Classes
            </div>
            <div className="card-body">
              {assignedClasses.length === 0 ? (
                <p>No classes assigned.</p>
              ) : (
                <ul className="list-group">
                  {assignedClasses.map(cls => (
                    <li key={cls.id} className="list-group-item d-flex justify-content-between align-items-center">
                      {cls.name}
                      <Link to={`/mark-attendance?class=${cls.id}`} className="btn btn-sm btn-outline-primary">
                        Mark Attendance
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Own Attendance Card */}
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-header bg-primary text-white">
              My Attendance
            </div>
            <div className="card-body">
              {myAttendance.marked ? (
                <p className="text-success">Marked at {formatISTTime(myAttendance.time!)}</p>
              ) : (
                <button className="btn btn-success" onClick={handleMarkOwnAttendance}>
                  Mark My Attendance
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Activity */}
      <div className="card mt-3">
        <div className="card-header bg-secondary text-white">
          Today's Activity
        </div>
        <div className="card-body">
          {todayAttendance.length === 0 ? (
            <p>No activity yet.</p>
          ) : (
            <ul className="list-group">
              {todayAttendance.map(ta => (
                <li key={ta.class_id} className="list-group-item">
                  {ta.class_name} — {ta.marked_count} / {ta.total_students} marked
                  {ta.marked_at && <span className="text-muted ms-2">at {ta.marked_at}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;