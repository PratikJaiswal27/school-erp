import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getNotificationsForUser, getReadNotificationIds, markNotificationRead } from '../lib/notifications';
import Toast from '../components/Toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  target: string;
  is_holiday: boolean;
  created_at: string;
  created_by?: string;
}

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNotif, setNewNotif] = useState({ title: '', message: '', target: 'all', is_holiday: false });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
    if (user.role === 'principal') fetchClasses();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
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
          // Fix: classes may be array or object
          const classData = student.classes as any;
          if (Array.isArray(classData) && classData.length > 0) {
            parentStudentClass = classData[0]?.name;
          } else if (!Array.isArray(classData) && classData.name) {
            parentStudentClass = classData.name;
          }
        }
      }
    }
    const notifs = await getNotificationsForUser(user.id, user.role, parentStudentClass);
    const reads = await getReadNotificationIds(user.id);
    setNotifications(notifs);
    setReadIds(reads);
    setLoading(false);
  };

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    if (data) setClasses(data);
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!readIds.includes(notif.id)) {
      await markNotificationRead(notif.id, user!.id);
      setReadIds([...readIds, notif.id]);
    }
    setSelectedNotification(notif);
  };

  const handleCreateNotification = async () => {
    if (!newNotif.title || !newNotif.message) {
      setToast({ message: 'Title and message are required', type: 'error' });
      return;
    }
    try {
      const { error } = await supabase.from('notifications').insert({
        title: newNotif.title,
        message: newNotif.message,
        target: newNotif.target,
        is_holiday: newNotif.is_holiday,
        created_by: user?.id,
      });
      if (error) throw error;
      setToast({ message: 'Notification sent', type: 'success' });
      setShowCreateModal(false);
      setNewNotif({ title: '', message: '', target: 'all', is_holiday: false });
      fetchData(); // refresh list
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const closeModal = () => setSelectedNotification(null);

  if (loading) return <div className="text-center mt-5">Loading...</div>;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>Notifications</h2>
        {user?.role === 'principal' && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <i className="bi bi-plus-circle"></i> New Notification
          </button>
        )}
      </div>

      <div className="list-group">
        {notifications.map(notif => (
          <div
            key={notif.id}
            className={`list-group-item list-group-item-action ${readIds.includes(notif.id) ? 'list-group-item-light' : 'list-group-item-primary'}`}
            onClick={() => handleNotificationClick(notif)}
            style={{ cursor: 'pointer' }}
          >
            <div className="d-flex w-100 justify-content-between">
              <h5 className="mb-1">
                {notif.title}
                {notif.is_holiday && <span className="badge bg-warning ms-2">Holiday</span>}
              </h5>
              <small>{new Date(notif.created_at).toLocaleDateString()}</small>
            </div>
            <p className="mb-1">{notif.message}</p>
            {user?.role === 'principal' && (
              <small className="text-muted">Target: {notif.target}</small>
            )}
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="alert alert-info">No notifications to show.</div>
        )}
      </div>

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{selectedNotification.title}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                <p>{selectedNotification.message}</p>
                <small>Sent on: {new Date(selectedNotification.created_at).toLocaleString()}</small>
                {user?.role === 'principal' && (
                  <p className="mt-2"><small>Target: {selectedNotification.target}</small></p>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Notification Modal (principal only) */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Send Notification</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newNotif.title}
                    onChange={e => setNewNotif({ ...newNotif, title: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Message *</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={newNotif.message}
                    onChange={e => setNewNotif({ ...newNotif, message: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Target</label>
                  <select
                    className="form-select"
                    value={newNotif.target}
                    onChange={e => setNewNotif({ ...newNotif, target: e.target.value })}
                  >
                    <option value="all">All Users</option>
                    <option value="teachers">Teachers Only</option>
                    <option value="parents">Parents Only</option>
                    {classes.map(c => (
                      <option key={c.id} value={`class_${c.name.split(' ')[1]}`}>
                        Parents of {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3 form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="isHoliday"
                    checked={newNotif.is_holiday}
                    onChange={e => setNewNotif({ ...newNotif, is_holiday: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="isHoliday">Mark as Holiday</label>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateNotification}>Send</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Notifications;