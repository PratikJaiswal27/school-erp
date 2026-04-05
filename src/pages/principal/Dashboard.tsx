import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Summary {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  todayAttendancePercent: number;
}

interface RecentActivity {
  id: string;
  action: string;
  timestamp: string;
  user: string;
}

interface StudentSearch {
  id: string;
  name: string;
  roll_number: string;
  class_name: string;
  profile_image: string | null;
}

const PrincipalDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary>({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    todayAttendancePercent: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSearch[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Total Students
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
      // Total Teachers
      const { count: teacherCount } = await supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true });
      // Total Classes
      const { count: classCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true });

      // Today's attendance percentage
      const today = new Date().toISOString().slice(0, 10);
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('status')
        .eq('date', today);
      const totalPresent = attendanceData?.filter(a => a.status === 'present').length || 0;
      const totalRecords = attendanceData?.length || 0;
      const attendancePercent = totalRecords === 0 ? 0 : (totalPresent / totalRecords) * 100;

      setSummary({
        totalStudents: studentCount || 0,
        totalTeachers: teacherCount || 0,
        totalClasses: classCount || 0,
        todayAttendancePercent: Math.round(attendancePercent),
      });

      // Recent activity: fetch latest 5 attendance updates
      const { data: latestAttendance } = await supabase
        .from('attendance')
        .select('updated_at, marked_by, teachers:marked_by(name)')
        .order('updated_at', { ascending: false })
        .limit(5);
      const activities: RecentActivity[] = (latestAttendance || []).map(att => {
        // teachers might be an array; extract name safely
        let teacherName = 'Unknown';
        const teachersData = att.teachers as any;
        if (teachersData) {
          if (Array.isArray(teachersData) && teachersData.length > 0) {
            teacherName = teachersData[0]?.name || 'Unknown';
          } else if (teachersData && typeof teachersData === 'object' && teachersData.name) {
            teacherName = teachersData.name;
          }
        }
        return {
          id: att.updated_at,
          action: `Attendance marked by ${teacherName}`,
          timestamp: new Date(att.updated_at).toLocaleString(),
          user: teacherName,
        };
      });
      setRecentActivity(activities);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const { data, error } = await supabase
      .from('students')
      .select(`
        id, name, roll_number,
        classes:class_id (name),
        profile_image
      `)
      .or(`name.ilike.%${term}%,roll_number.ilike.%${term}%`)
      .limit(5);
    if (!error && data) {
      const results: StudentSearch[] = data.map(s => {
        // classes may be an array; extract class name safely
        let className = '';
        const classData = s.classes as any;
        if (classData) {
          if (Array.isArray(classData) && classData.length > 0) {
            className = classData[0]?.name || '';
          } else if (classData && typeof classData === 'object' && classData.name) {
            className = classData.name;
          }
        }
        return {
          id: s.id,
          name: s.name,
          roll_number: s.roll_number,
          class_name: className,
          profile_image: s.profile_image,
        };
      });
      setSearchResults(results);
      setShowDropdown(results.length > 0);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const handleStudentSelect = (studentId: string) => {
    setShowDropdown(false);
    setSearchTerm('');
    navigate(`/students/${studentId}`);
  };

  if (loading) return <div className="text-center mt-5">Loading Dashboard...</div>;

  return (
    <div className="container py-4">
      {/* Search Bar */}
      <div className="row mb-4">
        <div className="col-md-6 mx-auto position-relative">
          <div className="input-group">
            <span className="input-group-text"><i className="bi bi-search"></i></span>
            <input
              type="text"
              className="form-control"
              placeholder="Search student by name or roll number..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            />
          </div>
          {showDropdown && (
            <div className="dropdown-menu show w-100 mt-1" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {searchResults.map(student => (
                <button
                  key={student.id}
                  className="dropdown-item d-flex align-items-center"
                  onClick={() => handleStudentSelect(student.id)}
                >
                  {student.profile_image ? (
                    <img src={student.profile_image} alt={student.name} style={{ width: 32, height: 32, borderRadius: '50%', marginRight: '8px' }} />
                  ) : (
                    <div className="avatar-placeholder me-2" style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#ccc', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {student.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div>{student.name}</div>
                    <small className="text-muted">Roll {student.roll_number} | {student.class_name}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-3 mb-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Total Students</h5>
              <p className="display-4">{summary.totalStudents}</p>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Today's Attendance</h5>
              <p className="display-4">{summary.todayAttendancePercent}%</p>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Total Teachers</h5>
              <p className="display-4">{summary.totalTeachers}</p>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Total Classes</h5>
              <p className="display-4">{summary.totalClasses}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <h5>Recent Activity</h5>
        </div>
        <div className="card-body">
          {recentActivity.length === 0 ? (
            <p className="text-muted">No recent activity.</p>
          ) : (
            <ul className="list-group">
              {recentActivity.map(activity => (
                <li key={activity.id} className="list-group-item d-flex justify-content-between align-items-center">
                  {activity.action}
                  <small className="text-muted">{activity.timestamp}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrincipalDashboard;