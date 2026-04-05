import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { generateReportCardPDF } from '../../lib/pdf';
import Toast from '../../components/Toast';

interface ReportCard {
  id: string;
  exam_name: string;
  academic_year: string;
  created_at: string;
  class_name: string;
}

const ParentReportCards: React.FC = () => {
  const { user } = useAuth();
  const [reportCards, setReportCards] = useState<ReportCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!user?.parent_id) return;
    fetchReportCards();
  }, [user]);

  const fetchReportCards = async () => {
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
      .select('class_id')
      .eq('id', parent.student_id)
      .single();
    if (studentError || !student?.class_id) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('report_cards')
      .select(`
        id,
        exam_name,
        academic_year,
        created_at,
        classes:class_id (name)
      `)
      .eq('class_id', student.class_id)
      .eq('finalized', true)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setReportCards(data.map((rc: any) => ({
        id: rc.id,
        exam_name: rc.exam_name,
        academic_year: rc.academic_year,
        created_at: rc.created_at,
        // Handle classes as array or object
        class_name: Array.isArray(rc.classes) ? rc.classes[0]?.name : rc.classes?.name || ''
      })));
    }
    setLoading(false);
  };

  const handleDownload = async (reportCard: ReportCard) => {
    setDownloading(reportCard.id);
    try {
      const { data: parent } = await supabase
        .from('parents')
        .select('student_id')
        .eq('id', user?.parent_id)
        .single();
      if (!parent?.student_id) throw new Error('No linked student');

      const { data: student } = await supabase
        .from('students')
        .select('name, roll_number, father_name, mother_name, dob, gender')
        .eq('id', parent.student_id)
        .single();
      if (!student) throw new Error('Student not found');

      const { data: marks } = await supabase
        .from('report_card_marks')
        .select('subject, max_marks, marks_obtained, grade, remarks')
        .eq('report_card_id', reportCard.id)
        .eq('student_id', parent.student_id);
      if (!marks || marks.length === 0) throw new Error('No marks found');

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', parent.student_id)
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

      const pdfBlob = await generateReportCardPDF(
        {
          name: student.name,
          class_name: reportCard.class_name,
          roll_number: student.roll_number,
          father_name: student.father_name || '',
          mother_name: student.mother_name || '',
          dob: student.dob || '',
          gender: student.gender || '',
        },
        { exam_name: reportCard.exam_name, academic_year: reportCard.academic_year },
        marks.map(m => ({
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
      a.download = `ReportCard_${student.name}_${reportCard.exam_name}_${reportCard.academic_year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast({ message: 'PDF downloaded', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Failed to generate PDF', type: 'error' });
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <h2>Report Cards</h2>
      {reportCards.length === 0 ? (
        <div className="alert alert-info">No finalized report cards available.</div>
      ) : (
        <div className="list-group">
          {reportCards.map(rc => (
            <div key={rc.id} className="list-group-item">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5>{rc.exam_name}</h5>
                  <p>Class: {rc.class_name} | Academic Year: {rc.academic_year}</p>
                  <small>Issued: {new Date(rc.created_at).toLocaleDateString()}</small>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => handleDownload(rc)}
                  disabled={downloading === rc.id}
                >
                  {downloading === rc.id ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ParentReportCards;