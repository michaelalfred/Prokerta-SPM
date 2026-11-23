'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function simpanIzinKetua(form: FormData) {
  await requireRole(['admin', 'superadmin']);
  const profileId = String(form.get('profile_id') ?? '');
  const bidangIds = form.getAll('bidang_id').map(String);
  if (!profileId || bidangIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) return { error: 'Data izin tidak valid.' };
  const supabase = await createClient();
  const { data: chair } = await supabase.from('profiles').select('id,role,bidang_id').eq('id', profileId).maybeSingle();
  if (!chair || chair.role !== 'ketua_bidang') return { error: 'Akun ketua bidang tidak ditemukan.' };
  if (bidangIds.includes(chair.bidang_id)) return { error: 'Bidang sendiri selalu diizinkan.' };
  const { error } = await supabase.rpc('simpan_izin_ketua', { p_profile_id: profileId, p_bidang_ids: bidangIds });
  if (error) return { error: 'Izin bidang tidak dapat disimpan.' };
  revalidatePath('/izin-ketua');
  revalidatePath('/proker');
  return { success: true };
}
