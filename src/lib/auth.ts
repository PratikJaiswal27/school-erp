export function hashPassword(password: string): string {
  return btoa(password);
}

export function verifyPassword(password: string, hash: string): boolean {
  return btoa(password) === hash;
}

// For principal to reset password (update user row)
export async function resetPassword(userId: string, newPassword: string, supabase: any) {
  const hash = hashPassword(newPassword);
  const { error } = await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('id', userId);
  return { error };
}