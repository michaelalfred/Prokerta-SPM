import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AppRole = 'user' | 'admin' | 'superadmin';
export type Profile = { id: string; username: string; role: AppRole; nama_koordinator: string | null; tim_kerja_id: string; tim_kerja: { nama: string; bidang: { nama: string; lembaga: { nama: string } } } };

export async function currentProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await supabase.from('profiles').select('id,username,role,nama_koordinator,tim_kerja_id,tim_kerja(nama,bidang(nama,lembaga(nama)))').eq('id', user.id).single();
  if (error || !data) redirect('/login');
  return data as unknown as Profile;
}

export async function requireRole(roles: AppRole[]) {
  const profile = await currentProfile();
  if (!roles.includes(profile.role)) redirect('/proker');
  return profile;
}
