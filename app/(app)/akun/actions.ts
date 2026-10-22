'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth';

const usernamePattern = /^[a-z0-9._-]+$/;
const newPassword = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();

async function assertSuperadmin() { return requireRole(['superadmin']); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba lagi.'; }

export async function buatAkun(formData: FormData): Promise<{ password?: string; error?: string }> {
  await assertSuperadmin();
  const username = text(formData, 'username').toLowerCase();
  const namaTim = text(formData, 'nama_tim');
  const namaKoordinator = text(formData, 'nama_koordinator');
  const bidangId = text(formData, 'bidang_id');
  const lembagaId = text(formData, 'lembaga_id');
  const role = text(formData, 'role');
  if (!usernamePattern.test(username) || !namaTim || !bidangId || !lembagaId || !['admin', 'user'].includes(role)) return { error: 'Lengkapi data dengan benar.' };
  const supabase = createAdminClient();
  const { data: bidang, error: bidangError } = await supabase.from('bidang').select('id').eq('id', bidangId).eq('lembaga_id', lembagaId).maybeSingle();
  if (bidangError || !bidang) return { error: 'Bidang tidak sesuai dengan lembaga.' };
  const { data: team, error: teamError } = await supabase.from('tim_kerja').insert({ bidang_id: bidangId, nama: namaTim }).select('id').single();
  if (teamError || !team) return { error: teamError?.message ?? 'Tim kerja gagal dibuat.' };
  const password = newPassword();
  const email = `${username}@${process.env.AUTH_EMAIL_DOMAIN || 'prokerta.local'}`;
  const { data: auth, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError || !auth.user) {
    await supabase.from('tim_kerja').delete().eq('id', team.id);
    return { error: authError?.message ?? 'Akun gagal dibuat.' };
  }
  const { error: profileError } = await supabase.from('profiles').insert({ id: auth.user.id, username, role, tim_kerja_id: team.id, nama_koordinator: namaKoordinator || null });
  if (profileError) {
    await supabase.auth.admin.deleteUser(auth.user.id);
    await supabase.from('tim_kerja').delete().eq('id', team.id);
    return { error: profileError.message };
  }
  revalidatePath('/akun');
  return { password };
}

export async function ubahAkun(formData: FormData): Promise<{ error?: string }> {
  await assertSuperadmin();
  const profileId = text(formData, 'profile_id');
  const username = text(formData, 'username').toLowerCase();
  const namaKoordinator = text(formData, 'nama_koordinator');
  const namaTim = text(formData, 'nama_tim');
  const bidangId = text(formData, 'bidang_id');
  const lembagaId = text(formData, 'lembaga_id');
  if (!profileId || !usernamePattern.test(username) || !namaTim || !bidangId || !lembagaId) return { error: 'Lengkapi data dengan benar.' };
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,username,tim_kerja_id,role').eq('id', profileId).single();
  if (profileError || !profile) return { error: 'Akun tidak ditemukan.' };
  const { data: team, error: teamError } = await supabase.from('tim_kerja').select('id,bidang_id').eq('id', profile.tim_kerja_id).single();
  if (teamError || !team) return { error: 'Tim kerja tidak ditemukan.' };
  const { data: bidang, error: divisionError } = await supabase.from('bidang').select('id').eq('id', bidangId).eq('lembaga_id', lembagaId).maybeSingle();
  if (divisionError || !bidang) return { error: 'Bidang tidak sesuai dengan lembaga.' };
  if (profile.username !== username) {
    const { error } = await supabase.auth.admin.updateUserById(profile.id, { email: `${username}@${process.env.AUTH_EMAIL_DOMAIN || 'prokerta.local'}`, email_confirm: true });
    if (error) return { error: error.message };
  }
  const { error: updateTeamError } = await supabase.from('tim_kerja').update({ nama: namaTim, bidang_id: bidangId }).eq('id', team.id);
  if (updateTeamError) return { error: updateTeamError.message };
  const { error: updateProfileError } = await supabase.from('profiles').update({ username, nama_koordinator: namaKoordinator || null }).eq('id', profile.id);
  if (updateProfileError) return { error: updateProfileError.message };
  revalidatePath('/akun');
  return {};
}

export async function resetPassword(profileId: string): Promise<{ password?: string; error?: string }> {
  await assertSuperadmin();
  const supabase = createAdminClient();
  const { data: profile, error } = await supabase.from('profiles').select('id').eq('id', profileId).single();
  if (error || !profile) return { error: 'Akun tidak ditemukan.' };
  const password = newPassword();
  const { error: resetError } = await supabase.auth.admin.updateUserById(profile.id, { password });
  if (resetError) return { error: resetError.message };
  return { password };
}

export async function ubahRole(formData: FormData): Promise<{ error?: string }> {
  const actor = await assertSuperadmin();
  const profileId = text(formData, 'profile_id');
  const role = text(formData, 'role');
  if (!profileId || profileId === actor.id || !['admin', 'user'].includes(role)) return { error: 'Perubahan role tidak diizinkan.' };
  const supabase = createAdminClient();
  const { data: target, error: readError } = await supabase.from('profiles').select('role').eq('id', profileId).single();
  if (readError || !target || target.role === 'superadmin') return { error: 'Role akun ini tidak dapat diubah.' };
  const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
  if (error) return { error: error.message };
  revalidatePath('/akun');
  return {};
}

async function listObjects(folder: string): Promise<string[]> {
  const storage = createAdminClient().storage.from('bukti-evaluasi');
  const { data, error } = await storage.list(folder, { limit: 1000 });
  if (error) throw error;
  const paths: string[] = [];
  for (const item of data ?? []) {
    const itemPath = `${folder}/${item.name}`;
    if (item.id === null) paths.push(...await listObjects(itemPath));
    else paths.push(itemPath);
  }
  return paths;
}

export async function hapusAkun(formData: FormData): Promise<{ error?: string }> {
  await assertSuperadmin();
  const profileId = text(formData, 'profile_id');
  const confirmation = text(formData, 'konfirmasi');
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase.from('profiles').select('id,username,role,tim_kerja_id').eq('id', profileId).single();
  if (profileError || !profile) return { error: 'Akun tidak ditemukan.' };
  if (profile.role === 'superadmin') return { error: 'Akun superadmin tidak dapat dihapus.' };
  if (confirmation !== profile.username) return { error: 'Username konfirmasi tidak cocok.' };
  try {
    const objects = await listObjects(profile.tim_kerja_id);
    for (let i = 0; i < objects.length; i += 100) {
      const { error } = await supabase.storage.from('bukti-evaluasi').remove(objects.slice(i, i + 100));
      if (error) return { error: `Penghapusan file gagal: ${error.message}` };
    }
  } catch (error) { return { error: `Penghapusan file gagal: ${errorMessage(error)}` }; }
  const { error: teamError } = await supabase.from('tim_kerja').delete().eq('id', profile.tim_kerja_id);
  if (teamError) return { error: `Penghapusan tim kerja gagal: ${teamError.message}` };
  const { error: authError } = await supabase.auth.admin.deleteUser(profile.id);
  if (authError) return { error: `Tim kerja sudah dihapus, tetapi penghapusan akun Auth gagal: ${authError.message}` };
  revalidatePath('/akun');
  return {};
}
