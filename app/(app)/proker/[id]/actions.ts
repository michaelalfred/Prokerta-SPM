'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { bolehHapusProker, bolehUbahStatus, type StatusProker } from '@/lib/rules/proker';
import { createClient } from '@/lib/supabase/server';

const stati: StatusProker[] = ['menunggu', 'ditinjau', 'disetujui', 'ditolak', 'direvisi'];

export async function hapusProker(id: string): Promise<void> {
  const profile = await currentProfile();
  const supabase = await createClient();
  const { data } = await supabase.from('proker_v').select('id,tim_kerja_id,status_efektif').eq('id', id).maybeSingle();
  if (!data || !bolehHapusProker(profile.role, data.status_efektif as StatusProker, data.tim_kerja_id === profile.tim_kerja_id)) redirect(`/proker/${id}?galat=hapus`);
  const { error } = await supabase.from('proker').delete().eq('id', id);
  if (error) redirect(`/proker/${id}?galat=hapus`);
  revalidatePath('/proker');
  redirect('/proker');
}

export async function ubahStatusProker(id: string, form: FormData): Promise<void> {
  const profile = await currentProfile();
  const status = String(form.get('status') ?? '') as StatusProker;
  if (!stati.includes(status)) redirect(`/proker/${id}?galat=status`);
  const supabase = await createClient();
  const { data } = await supabase.from('proker_v').select('status_efektif').eq('id', id).maybeSingle();
  if (!data || !bolehUbahStatus(profile.role, data.status_efektif as StatusProker)) redirect(`/proker/${id}?galat=status`);
  const { error } = await supabase.rpc('set_proker_status', { p_id: id, p_status: status });
  if (error) redirect(`/proker/${id}?galat=status`);
  revalidatePath('/proker');
  revalidatePath(`/proker/${id}`);
  redirect(`/proker/${id}`);
}
