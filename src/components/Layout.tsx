import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import Avatar from './Avatar';
import NotificationBell from './NotificationBell';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { logoUrl } = useSettings();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Role-based menu items
  const menuItems: { [key: string]: { label: string; path: string }[] } = {
    principal: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Students', path: '/students' },
      { label: 'Attendance', path: '/attendance' },
      { label: 'Teachers', path: '/teachers' },
      { label: 'Parents', path: '/parents' },
      { label: 'Fees', path: '/fees' },
      { label: 'Documents', path: '/documents' },
      { label: 'Timetable', path: '/timetable' },
      { label: 'Notifications', path: '/notifications' },
      { label: 'Report Cards', path: '/report-cards' },
      { label: 'Assign Attendance', path: '/assign-attendance' },
      { label: 'Settings', path: '/settings' },
    ],
    teacher: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Mark Attendance', path: '/mark-attendance' },
      { label: 'My Attendance', path: '/my-attendance' },
      { label: 'Timetable', path: '/timetable' },
      { label: 'Marks Entry', path: '/marks-entry' },
      { label: 'My Students', path: '/my-students' },
      { label: 'Notifications', path: '/notifications' },
      { label: 'My Profile', path: '/profile' },
    ],
    parent: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: "My Child's Attendance", path: '/child-attendance' },
      { label: 'Timetable', path: '/timetable' },
      { label: 'Notifications', path: '/notifications' },
      { label: 'Report Cards', path: '/report-cards' },
    ],
  };

  const currentMenu = user ? menuItems[user.role] : [];

  return (
    <div className="d-flex flex-column vh-100">
      {/* Navbar */}
      <nav className="navbar navbar-dark fixed-top" style={{ background: '#0d6efd' }}>
        <div className="container-fluid">
          <div className="d-flex align-items-center">
            <button
              className="btn btn-outline-light d-md-none me-2"
              onClick={() => setSidebarOpen(true)}
            >
              <i className="bi bi-list"></i>
            </button>
            <img
              src={logoUrl || '/placeholder-logo.png'}
              alt="School Logo"
              style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', marginRight: '8px' }}
              onError={(e) => { e.currentTarget.src = '/placeholder-logo.png'; }}
            />
            <span className="navbar-brand">{import.meta.env.VITE_APP_NAME}</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <NotificationBell />
            <Avatar name={user?.username} size={40} />
            <span className="text-white d-none d-sm-inline">{user?.username}</span>
            <span className="badge bg-light text-dark">{user?.role}</span>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar (desktop and offcanvas mobile) */}
      <div className="d-flex flex-grow-1" style={{ marginTop: '56px' }}>
        {/* Desktop sidebar */}
        <div className="d-none d-md-block bg-light p-3" style={{ width: '260px' }}>
          <ul className="nav flex-column">
            {currentMenu.map((item) => (
              <li className="nav-item mb-2" key={item.path}>
                <Link to={item.path} className="nav-link text-dark">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Mobile offcanvas */}
        <div
          className={`offcanvas offcanvas-start ${sidebarOpen ? 'show' : ''}`}
          style={{ visibility: sidebarOpen ? 'visible' : 'hidden' }}
          tabIndex={-1}
        >
          <div className="offcanvas-header">
            <h5 className="offcanvas-title">Menu</h5>
            <button
              type="button"
              className="btn-close"
              onClick={() => setSidebarOpen(false)}
            ></button>
          </div>
          <div className="offcanvas-body">
            <ul className="nav flex-column">
              {currentMenu.map((item) => (
                <li className="nav-item mb-2" key={item.path}>
                  <Link
                    to={item.path}
                    className="nav-link text-dark"
                    onClick={() => setSidebarOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-grow-1 p-4 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;