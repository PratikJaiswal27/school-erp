import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatISTTime } from '../../lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PERIODS = Array.from({ length: 7 }, (_, i) => i + 1);

interface TimetableEntry {
  subject: string;
  teacher_name: string;
  start_time: string;
  end_time: string;
}

const ParentTimetable: React.FC = () => {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState<{ [day: string]: { [period: number]: TimetableEntry } }>({});
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.parent_id) {
      setLoading(false);
      return;
    }
    fetchTimetable();
  }, [user]);

  const fetchTimetable = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .select('student_id')
        .eq('id', user?.parent_id)
        .single();
      if (parentError) throw parentError;
      if (!parent?.student_id) {
        setError('No student linked to this parent account.');
        setLoading(false);
        return;
      }

      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('class_id, classes:class_id(name)')
        .eq('id', parent.student_id)
        .single();
      if (studentError) throw studentError;
      if (!student?.class_id) {
        setError('Student has no class assigned.');
        setLoading(false);
        return;
      }

      let classNameValue = '';
      if (student.classes) {
        const classData = student.classes as any;
        if (Array.isArray(classData) && classData.length > 0) {
          classNameValue = classData[0]?.name || '';
        } else if (!Array.isArray(classData) && classData.name) {
          classNameValue = classData.name;
        }
      }
      setClassName(classNameValue);

      const { data: entries, error: ttError } = await supabase
        .from('timetable')
        .select(`
          day,
          period_number,
          subject,
          teacher_id,
          start_time,
          end_time,
          teachers:teacher_id (name)
        `)
        .eq('class_id', student.class_id);
      if (ttError) throw ttError;

      const organized: any = {};
      DAYS.forEach(day => {
        organized[day] = {};
        PERIODS.forEach(period => {
          const entry = entries?.find(e => e.day === day && e.period_number === period);
          if (entry) {
            let teacherName = '-';
            if (entry.teachers) {
              const teacherData = entry.teachers as any;
              if (Array.isArray(teacherData) && teacherData.length > 0) {
                teacherName = teacherData[0]?.name || '-';
              } else if (!Array.isArray(teacherData) && teacherData.name) {
                teacherName = teacherData.name;
              }
            }
            organized[day][period] = {
              subject: entry.subject || '-',
              teacher_name: teacherName,
              start_time: entry.start_time ? formatISTTime(entry.start_time) : '-',
              end_time: entry.end_time ? formatISTTime(entry.end_time) : '-'
            };
          } else {
            organized[day][period] = {
              subject: '-',
              teacher_name: '-',
              start_time: '-',
              end_time: '-'
            };
          }
        });
      });
      setTimetable(organized);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  const renderPeriodCell = (day: string, period: number) => {
    const entry = timetable[day]?.[period];
    if (!entry) return <td key={period} data-label={`Period ${period}`}>-</td>;
    return (
      <td key={period} data-label={`Period ${period}`}>
        <div><strong style={{ color: '#0d6efd' }}>{entry.subject}</strong></div>
        <div className="mt-1">{entry.teacher_name}</div>
      </td>
    );
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container py-4">
      <h2>Timetable - {className}</h2>
      <div className="mb-2">
        <div className="text-muted">🍽️ Lunch break: 11:40 AM – 12:00 PM (after Period 4)</div>
        <div className="text-muted">🏫 School Dispersal at 2:00 PM</div>
      </div>
      <div className="table-responsive">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th className="sticky-col">Day / Period</th>
              {PERIODS.map(p => <th key={p}>Period {p}</th>)}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => {
              if (day === 'Saturday' || day === 'Sunday') {
                return (
                  <tr key={day}>
                    <th className="sticky-col">{day}</th>
                    <td colSpan={PERIODS.length} className="text-center text-muted">Holiday</td>
                  </tr>
                );
              }
              return (
                <tr key={day}>
                  <th className="sticky-col">{day}</th>
                  {PERIODS.map(period => renderPeriodCell(day, period))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ParentTimetable;