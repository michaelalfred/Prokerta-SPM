'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const numberValue = (form: FormData, key: string) => Number(value(form, key));

export async function simpanVisi(form: FormData): Promise<{ error?: string }> {
  await requireRole(['superadmin']);
  const visi = value(form, 'visi');
  if (!visi) return { error: 'Visi wajib diisi.' };
  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase.from('visi_misi').select('id').eq('singleton', true).maybeSingle();
  if (readError) return { error: readError.message };
  const result = existing ? await supabase.from('visi_misi').update({ visi }).eq('id', existing.id) : await supabase.from('visi_misi').insert({ singleton: true, visi });
  if (result.error) return { error: result.error.message };
  revalidatePath('/visi-misi');
  return {};
}

export async function simpanMisi(form: FormData): Promise<{ error?: string }> {
  await requireRole(['superadmin']);
  const id = value(form, 'id');
  const nomor = numberValue(form, 'nomor');
  const teks = value(form, 'teks');
  const outcome = value(form, 'outcome');
  if (!Number.isInteger(nomor) || nomor < 1 || !teks || !outcome) return { error: 'Nomor, teks misi, dan outcome wajib diisi.' };
  const supabase = createAdminClient();
  const result = id ? await supabase.from('misi').update({ nomor, teks, outcome }).eq('id', id) : await supabase.from('misi').insert({ nomor, teks, outcome });
  if (result.error) return { error: result.error.message };
  revalidatePath('/visi-misi');
  return {};
}

export async function hapusMisi(form: FormData): Promise<{ error?: string }> {
  await requireRole(['superadmin']);
  const id = value(form, 'id');
  if (!id) return { error: 'Misi tidak ditemukan.' };
  const { error } = await createAdminClient().from('misi').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/visi-misi');
  return {};
}

export async function simpanMilestone(form: FormData): Promise<{ error?: string }> {
  await requireRole(['superadmin']);
  const id = value(form, 'id');
  const misiId = value(form, 'misi_id');
  const nomor = numberValue(form, 'nomor');
  const teks = value(form, 'teks');
  if (!misiId || !Number.isInteger(nomor) || nomor < 1 || !teks) return { error: 'Nomor dan teks milestone wajib diisi.' };
  const supabase = createAdminClient();
  const result = id ? await supabase.from('milestone').update({ misi_id: misiId, nomor, teks }).eq('id', id) : await supabase.from('milestone').insert({ misi_id: misiId, nomor, teks });
  if (result.error) return { error: result.error.message };
  revalidatePath('/visi-misi');
  return {};
}

export async function hapusMilestone(form: FormData): Promise<{ error?: string }> {
  await requireRole(['superadmin']);
  const id = value(form, 'id');
  if (!id) return { error: 'Milestone tidak ditemukan.' };
  const { error } = await createAdminClient().from('milestone').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/visi-misi');
  return {};
}
