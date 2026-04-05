import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Toast from '../../components/Toast';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PERIODS = Array.from({ length: 8 }, (_, i) => i + 1);

interface TimetableEntry {
  id?: string;
  class_id: string;
  day: string;
  period_number: number;
  subject: string;
  teacher_id: string | null;
  start_time: string;
  end_time: string;
}

const PrincipalTimetable: React.FC = () => {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState<{ id: string; name: string } | null>(null);
  const [timetable, setTimetable] = useState<{ [day: string]: { [period: number]: TimetableEntry } }>({});
  const [allTeachers, setAllTeachers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchClassesAndTeachers();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchTimetable();
    }
  }, [selectedClass]);

  const fetchClassesAndTeachers = async () => {
    const { data: classData } = await supabase.from('classes').select('id, name');
    if (classData) {
      const sorted = [...classData].sort((a, b) => {
        const getNumber = (name: string) => {
          const match = name.trim().match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        return getNumber(a.name) - getNumber(b.name);
      });
      setClasses(sorted);
      if (sorted.length > 0) setSelectedClass(sorted[0]);
    }
    const { data: teachers } = await supabase.from('teachers').select('id, name');
    if (teachers) setAllTeachers(teachers);
    setLoading(false);
  };

  const fetchTimetable = async () => {
    if (!selectedClass) return;
    const { data, error } = await supabase
      .from('timetable')
      .select('*')
      .eq('class_id', selectedClass.id);
    if (error) {
      console.error(error);
      setToast({ message: 'Failed to load timetable', type: 'error' });
      return;
    }
    const newTimetable: any = {};
    DAYS.forEach(day => {
      newTimetable[day] = {};
      PERIODS.forEach(period => {
        const existing = data?.find(e => e.day === day && e.period_number === period);
        if (existing) {
          newTimetable[day][period] = existing;
        } else {
          newTimetable[day][period] = {
            class_id: selectedClass.id,
            day,
            period_number: period,
            subject: '',
            teacher_id: null,
            start_time: '',
            end_time: '',
          };
        }
      });
    });
    setTimetable(newTimetable);
  };

  const updateEntry = (day: string, period: number, field: string, value: any) => {
    setTimetable(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [period]: {
          ...prev[day][period],
          [field]: value,
        },
      },
    }));
  };

  const saveTimetable = async () => {
    if (!selectedClass) return;
    setSaving(true);
    const entriesToUpsert: any[] = [];
    for (const day of DAYS) {
      for (const period of PERIODS) {
        const entry = timetable[day][period];
        if (entry.subject || entry.teacher_id || entry.start_time || entry.end_time) {
          const { id, ...entryWithoutId } = entry;
          entriesToUpsert.push(entryWithoutId);
        }
      }
    }
    if (entriesToUpsert.length === 0) {
      setToast({ message: 'No data to save', type: 'error' });
      setSaving(false);
      return;
    }
    try {
      const { error } = await supabase
        .from('timetable')
        .upsert(entriesToUpsert, { onConflict: 'class_id,day,period_number' });
      if (error) throw error;
      setToast({ message: 'Timetable saved', type: 'success' });
      await fetchTimetable();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <h2>Manage Timetables</h2>
      <div className="mb-3">
        <label>Select Class</label>
        <select
          className="form-select"
          value={selectedClass?.id || ''}
          onChange={(e) => {
            const cls = classes.find(c => c.id === e.target.value);
            if (cls) setSelectedClass(cls);
          }}
        >
          {classes.map(cls => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
      </div>

      {selectedClass && (
        <>
          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th className="sticky-col">Day / Period</th>
                  {PERIODS.map(p => <th key={p}>Period {p}</th>)}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day}>
                    <th className="sticky-col">{day}</th>
                    {PERIODS.map(period => {
                      const entry = timetable[day]?.[period];
                      if (!entry) return <td key={period}>-</td>;
                      return (
                        <td key={period}>
                          <div className="mb-2">
                            <input
                              type="text"
                              className="form-control form-control-sm mb-1"
                              placeholder="Subject"
                              value={entry.subject || ''}
                              onChange={(e) => updateEntry(day, period, 'subject', e.target.value)}
                            />
                            <select
                              className="form-select form-select-sm mb-1"
                              value={entry.teacher_id || ''}
                              onChange={(e) => updateEntry(day, period, 'teacher_id', e.target.value)}
                            >
                              <option value="">Select Teacher</option>
                              {allTeachers.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                            <input
                              type="time"
                              className="form-control form-control-sm mb-1"
                              value={entry.start_time || ''}
                              onChange={(e) => updateEntry(day, period, 'start_time', e.target.value)}
                            />
                            <input
                              type="time"
                              className="form-control form-control-sm"
                              value={entry.end_time || ''}
                              onChange={(e) => updateEntry(day, period, 'end_time', e.target.value)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary mt-3" onClick={saveTimetable} disabled={saving}>
            {saving ? 'Saving...' : 'Save Timetable'}
          </button>
        </>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default PrincipalTimetable;