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
    // Principal sees all
    query = query;
  } else if (role === 'teacher') {
    query = query.or(`target.eq.all,target.eq.teachers`);
  } else if (role === 'parent') {
    if (parentStudentClass) {
      const classTarget = `class_${parentStudentClass.split(' ')[1]}`; // e.g., "Class 1" -> "class_1"
      query = query.or(`target.eq.all,target.eq.parents,target.eq.${classTarget}`);
    } else {
      query = query.or(`target.eq.all,target.eq.parents`);
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getUnreadCount(userId: string): Promise<number> {
  // Get all notifications for user (we'll need to know their role and class)
  // This function should be called after we have user context. For now, we'll assume caller provides full user object.
  // We'll implement a more efficient version in the component.
  // For now, we'll fetch all notifications for the user and then subtract read ones.
  // But to avoid complexity, we'll do it in the component.
  return 0; // Placeholder
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notification_reads')
    .insert({ notification_id: notificationId, user_id: userId });
  if (error && error.code !== '23505') { // Ignore duplicate key errors
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