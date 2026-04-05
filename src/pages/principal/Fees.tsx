import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getISTDate } from '../../lib/utils';
import Toast from '../../components/Toast';

interface Student {
  id: string;
  name: string;
  class_name: string;
  roll_number: string;
}

interface Fee {
  id: string;
  student_id: string;
  month: string;
  paid: boolean;
  paid_date: string | null;
  remarks: string;
}

const PrincipalFees: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedClass, selectedMonth]);

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

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from('students').select(`
      id, name, roll_number,
      classes:class_id (name)
    `);
    if (selectedClass) {
      query = query.eq('class_id', selectedClass);
    }
    const { data: studentsData, error: studentError } = await query;
    if (studentError) {
      console.error(studentError);
      setLoading(false);
      return;
    }
    const studentList = (studentsData || []).map(s => {
      let className = '';
      if (s.classes) {
        // Convert to array if it's not already (Supabase sometimes returns array, sometimes object)
        const classesArray = Array.isArray(s.classes) ? s.classes : [s.classes];
        className = classesArray[0]?.name || '';
      }
      return {
        id: s.id,
        name: s.name,
        class_name: className,
        roll_number: s.roll_number,
      };
    });
    setStudents(studentList);

    const { data: feesData, error: feesError } = await supabase
      .from('fees')
      .select('*')
      .in('student_id', studentList.map(s => s.id))
      .eq('month', `${selectedMonth}-01`);
    if (feesError) {
      console.error(feesError);
    } else {
      setFees(feesData || []);
    }
    setLoading(false);
  };

  const handleToggle = async (studentId: string, currentPaid: boolean) => {
    const existing = fees.find(f => f.student_id === studentId);
    if (existing) {
      const { error } = await supabase
        .from('fees')
        .update({
          paid: !currentPaid,
          paid_date: !currentPaid ? getISTDate() : null,
        })
        .eq('id', existing.id);
      if (error) {
        setToast({ message: error.message, type: 'error' });
        return;
      }
      setFees(prev =>
        prev.map(f =>
          f.id === existing.id
            ? { ...f, paid: !currentPaid, paid_date: !currentPaid ? getISTDate() : null }
            : f
        )
      );
    } else {
      const { data: newFee, error } = await supabase
        .from('fees')
        .insert({
          student_id: studentId,
          month: `${selectedMonth}-01`,
          paid: !currentPaid,
          paid_date: !currentPaid ? getISTDate() : null,
        })
        .select()
        .single();
      if (error) {
        setToast({ message: error.message, type: 'error' });
        return;
      }
      setFees(prev => [...prev, newFee]);
    }
    setToast({ message: `Fee updated for ${students.find(s => s.id === studentId)?.name}`, type: 'success' });
  };

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
      <h2>Fees Management</h2>
      <div className="row mb-3">
        <div className="col-md-4">
          <label>Class</label>
          <select className="form-select" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label>Month</label>
          <select className="form-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            {months.map(m => (
              <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Class</th>
              <th>Roll No</th>
              <th>Status</th>
              <th>Paid Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => {
              const feeRecord = fees.find(f => f.student_id === student.id);
              const paid = feeRecord?.paid || false;
              const paidDate = feeRecord?.paid_date ? new Date(feeRecord.paid_date).toLocaleDateString() : '-';
              return (
                <tr key={student.id}>
                  <td>{student.name}</td>
                  <td>{student.class_name}</td>
                  <td>{student.roll_number}</td>
                  <td>{paid ? 'Paid' : 'Unpaid'}</td>
                  <td>{paidDate}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${paid ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => handleToggle(student.id, paid)}
                    >
                      {paid ? 'Mark Unpaid' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center">No students found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default PrincipalFees;