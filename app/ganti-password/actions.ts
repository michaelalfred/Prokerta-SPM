'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (password.length < 6 || password !== String(formData.get('confirm') ?? '')) redirect('/ganti-password?error=1');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/ganti-password?error=1');
  redirect('/proker');
}
