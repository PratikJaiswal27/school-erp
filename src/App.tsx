import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';

// Principal pages
import PrincipalDashboard from './pages/principal/Dashboard';
import Students from './pages/principal/Students';
import StudentProfile from './pages/principal/StudentProfile';
import Attendance from './pages/principal/Attendance';
import Teachers from './pages/principal/Teachers';
import Parents from './pages/principal/Parents';
import AssignAttendance from './pages/principal/AssignAttendance';
import Settings from './pages/principal/Settings';
import ReportCards from './pages/principal/ReportCards';
import PrincipalFees from './pages/principal/Fees';
import PrincipalDocuments from './pages/principal/Documents';
import PrincipalTimetable from './pages/principal/TimeTable';
import PrincipalTeacherProfile from './pages/principal/TeacherProfile';

// Teacher pages
import TeacherDashboard from './pages/teacher/Dashboard';
import MarkAttendance from './pages/teacher/MarkAttendance';
import MyAttendance from './pages/teacher/MyAttendance';
import TeacherTimetable from './pages/teacher/Timetable';
import MarksEntry from './pages/teacher/MarksEntry';
import MyStudents from './pages/teacher/MyStudents';
import TeacherOwnProfile from './pages/teacher/Profile';

// Parent pages
import ParentDashboard from './pages/parent/Dashboard';
import ChildAttendance from './pages/parent/ChildAttendance';
import ParentTimetable from './pages/parent/Timetable';
import ParentReportCards from './pages/parent/ReportCards';
import ParentFees from './pages/parent/Fees';   // NEW

// Generic Notifications page for all roles
import Notifications from './pages/Notifications';

function AppRoutes() {
  const { user } = useAuth();
  if (!user) return <Login />;

  // Determine base dashboard based on role
  let DashboardComponent;
  if (user.role === 'principal') DashboardComponent = PrincipalDashboard;
  else if (user.role === 'teacher') DashboardComponent = TeacherDashboard;
  else DashboardComponent = ParentDashboard;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardComponent />} />

        {/* Student profile - accessible by all authenticated users */}
        <Route path="/students/:id" element={<StudentProfile />} />

        {/* Principal routes */}
        {user.role === 'principal' && (
          <>
            <Route path="/students" element={<Students />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/teachers" element={<Teachers />} />
            <Route path="/teachers/:id" element={<PrincipalTeacherProfile />} />
            <Route path="/parents" element={<Parents />} />
            <Route path="/assign-attendance" element={<AssignAttendance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/report-cards" element={<ReportCards />} />
            <Route path="/fees" element={<PrincipalFees />} />
            <Route path="/documents" element={<PrincipalDocuments />} />
            <Route path="/timetable" element={<PrincipalTimetable />} />
          </>
        )}

        {/* Teacher routes */}
        {user.role === 'teacher' && (
          <>
            <Route path="/mark-attendance" element={<MarkAttendance />} />
            <Route path="/my-attendance" element={<MyAttendance />} />
            <Route path="/timetable" element={<TeacherTimetable />} />
            <Route path="/marks-entry" element={<MarksEntry />} />
            <Route path="/my-students" element={<MyStudents />} />
            <Route path="/profile" element={<TeacherOwnProfile />} />
            <Route path="/notifications" element={<Notifications />} />
          </>
        )}

        {/* Parent routes */}
        {user.role === 'parent' && (
          <>
            <Route path="/child-attendance" element={<ChildAttendance />} />
            <Route path="/timetable" element={<ParentTimetable />} />
            <Route path="/fee-history" element={<ParentFees />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/report-cards" element={<ParentReportCards />} />
          </>
        )}
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;