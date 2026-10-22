'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const domain = process.env.AUTH_EMAIL_DOMAIN || 'prokerta.local';
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: `${username}@${domain}`, password });
  if (error) redirect('/login?error=1');
  redirect('/proker');
}
