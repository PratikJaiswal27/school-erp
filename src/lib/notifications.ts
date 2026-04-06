import { supabase } from './supabase';

export interface Notification {
  id: string;
  title: string;
  message: string;
  target: string;
  is_holiday: boolean;
  created_at: string;
}

export async function getNotificationsForUser(
  userId: string,
  role: string,
  parentStudentClass?: string | null
): Promise<Notification[]> {
  let query = supabase.from('notifications').select('*');

  if (role === 'principal') {
    // Principal sees all notifications (no filtering)
    query = query;
  } else if (role === 'teacher') {
    // Teacher sees broadcast to 'all' or 'teachers'
    query = query.or(`target.eq.all,target.eq.teachers`);
  } else if (role === 'parent') {
    // Parent sees:
    // - notifications directly targeted to their user_id (user_id column)
    // - broadcast to 'all'
    // - broadcast to 'parents'
    // - broadcast to their specific class (if parentStudentClass is provided)
    let conditions = [`user_id.eq.${userId}`, `target.eq.all`, `target.eq.parents`];
    if (parentStudentClass) {
      const classTarget = `class_${parentStudentClass.split(' ')[1]}`;
      conditions.push(`target.eq.${classTarget}`);
    }
    const filterString = conditions.join(',');
    query = query.or(filterString);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getUnreadCount(_userId: string): Promise<number> {
  // This function is not used in the current implementation; kept for potential future use.
  return 0;
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_reads')
    .insert({ notification_id: notificationId, user_id: userId });
  if (error && error.code !== '23505') {
    console.error('Error marking notification read:', error);
  }
}

export async function getReadNotificationIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', userId);
  if (error) return [];
  return data.map(r => r.notification_id);
}