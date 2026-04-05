import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { generateReportCardPDF } from '../../lib/pdf';
import Toast from '../../components/Toast';

interface Exam {
  id: string;
  exam_name: string;
  academic_year: string;
  class_id: string;
  class_name?: string;
  finalized: boolean;
  created_at: string;
}

interface Class {
  id: string;
  name: string;
}

const ReportCards: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    fetchExams();
  }, [selectedClass]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    if (data) setClasses(data);
  };

  const fetchExams = async () => {
    setLoading(true);
    let query = supabase
      .from('report_cards')
      .select(`
        id,
        exam_name,
        academic_year,
        class_id,
        finalized,
        created_at,
        classes:class_id (name)
      `)
      .order('created_at', { ascending: false });
    if (selectedClass) {
      query = query.eq('class_id', selectedClass);
    }
    const { data, error } = await query;
    if (!error && data) {
      const formatted = data.map((e: any) => ({
        ...e,
        class_name: e.classes?.name,
      }));
      setExams(formatted);
    }
    setLoading(false);
  };

  const handleFinalize = async (examId: string, currentFinalized: boolean) => {
    // If trying to finalize (not unfinalize), check if any marks exist
    if (!currentFinalized) {
      const { count, error } = await supabase
        .from('report_card_marks')
        .select('*', { count: 'exact', head: true })
        .eq('report_card_id', examId);
      if (error) {
        setToast({ message: error.message, type: 'error' });
        return;
      }
      if (count === 0) {
        setToast({ message: 'Cannot finalize: No marks have been entered for this exam.', type: 'error' });
        return;
      }
    }

    setFinalizingId(examId);
    const { error } = await supabase
      .from('report_cards')
      .update({ finalized: !currentFinalized })
      .eq('id', examId);
    if (!error) {
      setToast({ message: `Report card ${currentFinalized ? 'unfinalized' : 'finalized'}`, type: 'success' });
      fetchExams();
    } else {
      setToast({ message: error.message, type: 'error' });
    }
    setFinalizingId(null);
  };

  const handleDownload = async (exam: Exam) => {
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, name, roll_number, father_name, mother_name, dob, gender')
      .eq('class_id', exam.class_id);
    if (studentError) {
      setToast({ message: 'Failed to fetch students', type: 'error' });
      return;
    }

    for (const student of students) {
      const { data: marksData } = await supabase
        .from('report_card_marks')
        .select('subject, max_marks, marks_obtained, grade, remarks')
        .eq('report_card_id', exam.id)
        .eq('student_id', student.id);

      if (!marksData || marksData.length === 0) {
        console.log(`No marks for student ${student.name}, skipping PDF`);
        continue;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', student.id)
        .gte('date', startDate);
      const present = attendanceData?.filter(a => a.status === 'present').length || 0;
      const absent = attendanceData?.filter(a => a.status === 'absent').length || 0;
      const total = present + absent;
      const percentage = total === 0 ? 0 : (present / total) * 100;

      const { data: settingsData } = await supabase
        .from('school_settings')
        .select('logo_url, principal_name, principal_signature_text, school_stamp_text, school_address')
        .single();
      const settings = settingsData || {
        logo_url: undefined,
        principal_name: 'School Principal',
        principal_signature_text: 'Principal, SGNPS',
        school_stamp_text: 'Shree Guru Nanak Public School',
      };

      try {
        const pdfBlob = await generateReportCardPDF(
          {
            name: student.name,
            class_name: exam.class_name!,
            roll_number: student.roll_number,
            father_name: student.father_name || '',
            mother_name: student.mother_name || '',
            dob: student.dob || '',
            gender: student.gender || '',
          },
          { exam_name: exam.exam_name, academic_year: exam.academic_year },
          marksData.map(m => ({
            subject: m.subject,
            max_marks: m.max_marks,
            marks_obtained: m.marks_obtained,
            grade: m.grade,
            remarks: m.remarks,
          })),
          { present, absent, percentage: Math.round(percentage) },
          settings
        );
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ReportCard_${student.name}_${exam.exam_name}_${exam.academic_year}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        setToast({ message: `Failed to generate PDF for ${student.name}`, type: 'error' });
      }
    }
    setToast({ message: `PDF generation started for ${students.length} students`, type: 'success' });
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <h2>Report Cards</h2>
      <div className="mb-3">
        <label>Filter by Class</label>
        <select className="form-select w-auto" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Exam Name</th>
              <th>Academic Year</th>
              <th>Class</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exams.map(exam => (
              <tr key={exam.id}>
                <td>{exam.exam_name}</td>
                <td>{exam.academic_year}</td>
                <td>{exam.class_name}</td>
                <td>
                  <span className={`badge ${exam.finalized ? 'bg-success' : 'bg-warning'}`}>
                    {exam.finalized ? 'Finalized' : 'Draft'}
                  </span>
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${exam.finalized ? 'btn-warning' : 'btn-success'} me-2`}
                    onClick={() => handleFinalize(exam.id, exam.finalized)}
                    disabled={finalizingId === exam.id}
                  >
                    {exam.finalized ? 'Unfinalize' : 'Finalize'}
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleDownload(exam)}
                    disabled={!exam.finalized}
                  >
                    Download All PDFs
                  </button>
                </td>
              </tr>
            ))}
            {exams.length === 0 && (
              <tr><td colSpan={5} className="text-center">No report cards found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ReportCards;