import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Toast from '../../components/Toast';

const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');
  const [isHoliday, setIsHoliday] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    setClasses(data || []);
  };

  const handleSend = async () => {
    if (!title || !message) {
      setToast({ message: 'Title and message are required', type: 'error' });
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from('notifications').insert({
        title,
        message,
        created_by: user?.id,
        target,
        is_holiday: isHoliday,
      });
      if (error) throw error;
      setToast({ message: 'Notification sent', type: 'success' });
      setTitle('');
      setMessage('');
      setTarget('all');
      setIsHoliday(false);
    } catch (err: any) {
      setToast({ message: err.message || 'Send failed', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container">
      <h2>Send Notification</h2>
      <form>
        <div className="mb-3">
          <label className="form-label">Title</label>
          <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Message</label>
          <textarea className="form-control" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className="form-label">Target Audience</label>
          <select className="form-select" value={target} onChange={(e) => setTarget(e.target.value)}>
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
          <input type="checkbox" className="form-check-input" id="holiday" checked={isHoliday} onChange={(e) => setIsHoliday(e.target.checked)} />
          <label className="form-check-label" htmlFor="holiday">Mark as Holiday</label>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleSend} disabled={sending}>
          {sending ? 'Sending...' : 'Send Notification'}
        </button>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Notifications;