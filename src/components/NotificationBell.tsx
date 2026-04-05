import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getNotificationsForUser, getReadNotificationIds } from '../lib/notifications';

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
  }, [user, location.pathname]);

  const fetchUnreadCount = async () => {
    if (!user) return;

    let parentStudentClass: string | null = null;
    if (user.role === 'parent' && user.parent_id) {
      const { data: parent } = await supabase
        .from('parents')
        .select('student_id')
        .eq('id', user.parent_id)
        .single();
      if (parent?.student_id) {
        const { data: student } = await supabase
          .from('students')
          .select('classes:class_id(name)')
          .eq('id', parent.student_id)
          .single();
        if (student?.classes) {
          // Fix TypeScript error: cast to any and handle array/object
          const classData = student.classes as any;
          const className = Array.isArray(classData) ? classData[0]?.name : classData?.name;
          parentStudentClass = className;
        }
      }
    }

    const notifications = await getNotificationsForUser(user.id, user.role, parentStudentClass);
    const readIds = await getReadNotificationIds(user.id);
    const unread = notifications.filter(n => !readIds.includes(n.id));
    setUnreadCount(unread.length);
  };

  const handleClick = () => {
    navigate('/notifications');
  };

  return (
    <div className="position-relative" onClick={handleClick} style={{ cursor: 'pointer' }}>
      <i className="bi bi-bell-fill text-white fs-5"></i>
      {unreadCount > 0 && (
        <span className="badge bg-danger position-absolute top-0 start-100 translate-middle">
          {unreadCount}
        </span>
      )}
    </div>
  );
};

export default NotificationBell;