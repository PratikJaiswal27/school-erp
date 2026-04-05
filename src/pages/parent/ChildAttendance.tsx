import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent';
}

const ChildAttendance: React.FC = () => {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (!user?.parent_id) return;
    const fetchStudentId = async () => {
      const { data: parent } = await supabase
        .from('parents')
        .select('student_id')
        .eq('id', user.parent_id)
        .single();
      if (parent?.student_id) {
        setStudentId(parent.student_id);
        fetchAttendance(parent.student_id);
      } else {
        setLoading(false);
      }
    };
    fetchStudentId();
  }, [user]);

  useEffect(() => {
    if (studentId) {
      fetchAttendance(studentId);
    }
  }, [selectedMonth, studentId]);

  const fetchAttendance = async (sid: string) => {
    setLoading(true);
    const [year, month] = selectedMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('attendance')
      .select('date, status')
      .eq('student_id', sid)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    if (!error && data) {
      setRecords(data);
    }
    setLoading(false);
  };

  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const total = presentCount + absentCount;
  const percentage = total === 0 ? 0 : ((presentCount / total) * 100).toFixed(1);

  // Generate list of months for dropdown (last 12 months)
  const months = [];
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(monthStr);
  }

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <h2>Child Attendance</h2>
      <div className="row mb-3">
        <div className="col-md-4">
          <label>Month</label>
          <select className="form-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {months.map(m => (
              <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-md-4">
          <div className="card bg-light">
            <div className="card-body">
              <h5>Summary</h5>
              <p>Present: {presentCount} days</p>
              <p>Absent: {absentCount} days</p>
              <p>Attendance: {percentage}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Date</th>
              <th>Day</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map(rec => (
              <tr key={rec.date}>
                <td>{new Date(rec.date).toLocaleDateString('en-IN')}</td>
                <td>{new Date(rec.date).toLocaleDateString('en-IN', { weekday: 'long' })}</td>
                <td>
                  <span className={`badge ${rec.status === 'present' ? 'bg-success' : 'bg-danger'}`}>
                    {rec.status === 'present' ? 'Present' : 'Absent'}
                  </span>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={3} className="text-center">No attendance records for this month.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChildAttendance;