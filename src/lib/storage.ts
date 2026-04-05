import { supabase } from './supabase';

// Upload a file to a bucket
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ data: any; error: any }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file);
  return { data, error };
}

// Get a signed URL for a file (for viewing/downloading)
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = 60 * 60 // 1 hour
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }
  return data.signedUrl;
}

// Delete a file
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error('Error deleting file:', error);
    return false;
  }
  return true;
}

// Helper to generate a unique filename (uuid + extension)
export function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop();
  return `${crypto.randomUUID()}.${ext}`;
}