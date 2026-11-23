import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AppRole = 'user' | 'admin' | 'superadmin' | 'ketua_bidang';
export type Profile = { id: string; username: string; role: AppRole; nama_koordinator: string | null; tim_kerja_id: string | null; bidang_id: string | null; tim_kerja: { nama: string; bidang: { nama: string; lembaga: { nama: string } } } | null; bidang: { nama: string; lembaga: { nama: string } } | null };
type ProfileRecord = Pick<Profile, 'id' | 'username' | 'role' | 'nama_koordinator' | 'tim_kerja_id' | 'bidang_id'>;

export async function currentProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  let profile: ProfileRecord | null = null;
  const current = await supabase.from('profiles').select('id,username,role,nama_koordinator,tim_kerja_id,bidang_id').eq('id', user.id).maybeSingle();
  if (!current.error) profile = current.data as unknown as ProfileRecord | null;

  // Keep existing user/admin accounts usable while the chair-bidang column
  // migration is not visible to this API schema.
  const missingChairSchema = current.error?.code === '42703'
    || current.error?.message.includes('bidang_id');
  if (missingChairSchema) {
    const legacy = await supabase.from('profiles').select('id,username,role,nama_koordinator,tim_kerja_id').eq('id', user.id).maybeSingle();
    if (!legacy.error && legacy.data) profile = { ...legacy.data, bidang_id: null } as unknown as ProfileRecord;
    else console.error('[auth] Profil aplikasi tidak dapat dibaca.', { code: legacy.error?.code, message: legacy.error?.message, details: legacy.error?.details, hint: legacy.error?.hint });
  } else if (current.error) {
    console.error('[auth] Query profil aplikasi gagal.', { code: current.error?.code, message: current.error?.message, details: current.error?.details, hint: current.error?.hint });
  }
  if (!profile) {
    console.error('[auth] Baris profil untuk sesi ini tidak ditemukan.', { authUserId: user.id });
    redirect('/login?error=profile');
  }

  // Load display names separately so an unavailable PostgREST relationship
  // cannot make the authenticated profile lookup fail.
  let tim_kerja: Profile['tim_kerja'] = null;
  let bidang: Profile['bidang'] = null;
  if (profile.tim_kerja_id) {
    const result = await supabase.from('tim_kerja').select('nama,bidang(nama,lembaga(nama))').eq('id', profile.tim_kerja_id).maybeSingle();
    if (result.error) console.error('[auth] Relasi tim kerja profil gagal dibaca.', { code: result.error.code, message: result.error.message });
    else tim_kerja = result.data as unknown as Profile['tim_kerja'];
  }
  if (profile.bidang_id) {
    const result = await supabase.from('bidang').select('nama,lembaga(nama)').eq('id', profile.bidang_id).maybeSingle();
    if (result.error) console.error('[auth] Relasi bidang profil gagal dibaca.', { code: result.error.code, message: result.error.message });
    else bidang = result.data as unknown as Profile['bidang'];
  }
  return { ...profile, tim_kerja, bidang };
}

export async function requireRole(roles: AppRole[]) {
  const profile = await currentProfile();
  if (!roles.includes(profile.role)) redirect('/proker');
  return profile;
}
