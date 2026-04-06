import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface FeeRecord {
  month: string;
  paid: boolean;
  paid_date: string | null;
}

const ParentFees: React.FC = () => {
  const { user } = useAuth();
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [childName, setChildName] = useState('');

  useEffect(() => {
    if (!user?.parent_id) return;
    fetchFees();
  }, [user]);

  const fetchFees = async () => {
    const { data: parent } = await supabase
      .from('parents')
      .select('student_id')
      .eq('id', user?.parent_id)
      .single();
    if (!parent?.student_id) {
      setLoading(false);
      return;
    }

    const { data: student } = await supabase
      .from('students')
      .select('name')
      .eq('id', parent.student_id)
      .single();
    if (student) setChildName(student.name);

    const { data, error } = await supabase
      .from('fees')
      .select('month, paid, paid_date')
      .eq('student_id', parent.student_id)
      .order('month', { ascending: false });
    if (!error && data) {
      setFees(data);
    }
    setLoading(false);
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <h2>Fee History - {childName}</h2>
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Month</th>
              <th>Status</th>
              <th>Paid Date</th>
            </tr>
          </thead>
          <tbody>
            {fees.map(fee => (
              <tr key={fee.month}>
                <td>{new Date(fee.month).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</td>
                <td>
                  <span className={`badge ${fee.paid ? 'bg-success' : 'bg-danger'}`}>
                    {fee.paid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
                <td>{fee.paid_date ? new Date(fee.paid_date).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
            {fees.length === 0 && (
              <tr><td colSpan={3} className="text-center">No fee records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ParentFees;