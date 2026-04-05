import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatISTTime } from '../../lib/utils';

interface AttendanceRecord {
  id: string;
  date: string;
  time_in: string;
}

const MyAttendance: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.teacher_id) return;
    const fetchAttendance = async () => {
      const { data, error } = await supabase
        .from('teacher_attendance')
        .select('id, date, time_in')
        .eq('teacher_id', user.teacher_id)
        .order('date', { ascending: false });
      if (!error && data) setRecords(data);
      setLoading(false);
    };
    fetchAttendance();
  }, [user]);

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <h2>My Attendance History</h2>
      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time In</th>
            </tr>
          </thead>
          <tbody>
            {records.map(rec => (
              <tr key={rec.id}>
                <td>{new Date(rec.date).toLocaleDateString('en-IN')}</td>
                <td>{formatISTTime(rec.time_in)}</td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyAttendance;