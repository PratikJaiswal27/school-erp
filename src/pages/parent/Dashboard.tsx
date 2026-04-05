import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getISTDate } from '../../lib/utils';
import { Link } from 'react-router-dom';

interface Child {
  id: string;
  name: string;
  roll_number: string;
  class_name: string;
  profile_image: string;
}

interface TodayAttendance {
  status: 'present' | 'absent' | null;
}

const ParentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [child, setChild] = useState<Child | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance>({ status: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.parent_id) return;
    fetchChildData();
  }, [user]);

  const fetchChildData = async () => {
    setLoading(true);
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('student_id')
      .eq('id', user?.parent_id)
      .single();
    if (parentError || !parent?.student_id) {
      setLoading(false);
      return;
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select(`
        id, name, roll_number, profile_image,
        classes:class_id (name)
      `)
      .eq('id', parent.student_id)
      .single();
    if (!studentError && student) {
      // Fix: safely extract class name from array or object
      let className = '';
      if (student.classes) {
        const classData = student.classes as any;
        className = Array.isArray(classData) ? classData[0]?.name : classData?.name;
      }
      setChild({
        id: student.id,
        name: student.name,
        roll_number: student.roll_number,
        class_name: className || '',
        profile_image: student.profile_image || '',
      });
    }

    const today = getISTDate();
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('status')
      .eq('student_id', parent.student_id)
      .eq('date', today)
      .maybeSingle();
    if (!attError && attendance) {
      setTodayAttendance({ status: attendance.status });
    }

    setLoading(false);
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (!child) return <div className="alert alert-danger">No child linked to this parent account.</div>;

  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-body">
          <h2>Welcome, {user?.username}</h2>
          <div className="row mt-4">
            <div className="col-md-4 text-center">
              {child.profile_image ? (
                <img src={child.profile_image} alt={child.name} className="rounded-circle" style={{ width: 150, height: 150, objectFit: 'cover' }} />
              ) : (
                <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center mx-auto" style={{ width: 150, height: 150 }}>
                  <span className="text-white display-4">{child.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="col-md-8">
              <h3>{child.name}</h3>
              <p><strong>Class:</strong> {child.class_name}</p>
              <p><strong>Roll Number:</strong> {child.roll_number}</p>
              <div className="mt-3">
                <h4>Today's Attendance</h4>
                {todayAttendance.status === 'present' && <span className="badge bg-success fs-6">Present</span>}
                {todayAttendance.status === 'absent' && <span className="badge bg-danger fs-6">Absent</span>}
                {todayAttendance.status === null && <span className="badge bg-secondary fs-6">Not marked yet</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-6 mb-3">
          <Link to="/child-attendance" className="btn btn-primary w-100 py-3">View Attendance</Link>
        </div>
        <div className="col-md-6 mb-3">
          <Link to="/timetable" className="btn btn-primary w-100 py-3">View Timetable</Link>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;