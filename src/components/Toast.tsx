import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  let bgClass = '';
  if (type === 'success') bgClass = 'bg-success';
  if (type === 'error') bgClass = 'bg-danger';
  if (type === 'info') bgClass = 'bg-info';

  return (
    <div className={`toast show position-fixed bottom-0 end-0 m-3 ${bgClass} text-white`} role="alert">
      <div className="toast-body">{message}</div>
    </div>
  );
};

export default Toast;