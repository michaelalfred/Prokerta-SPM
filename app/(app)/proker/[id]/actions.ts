'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { bolehHapusProker, bolehUbahStatus, type StatusProker } from '@/lib/rules/proker';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const stati: StatusProker[] = ['menunggu', 'ditinjau', 'disetujui', 'ditolak', 'direvisi'];

export async function hapusProker(id: string): Promise<{ error?: string; message?: string }> {
  const profile = await currentProfile();
  const supabase = await createClient();
  const { data } = await supabase.from('proker_v').select('id,tim_kerja_id,status_efektif').eq('id', id).maybeSingle();
  if (!data || !bolehHapusProker(profile.role, data.status_efektif as StatusProker, data.tim_kerja_id === profile.tim_kerja_id)) return { error: 'Proker tidak dapat dihapus. Status atau hak akses mungkin sudah berubah.' };
  const { data: evaluations, error: evaluationError } = await supabase.from('evaluasi').select('id').eq('proker_id', id);
  if (evaluationError) return { error: 'Data evaluasi proker tidak dapat diperiksa.' };
  const evaluationIds = (evaluations ?? []).map((evaluation) => evaluation.id);
  const { data: files, error: fileError } = evaluationIds.length
    ? await supabase.from('evaluasi_file').select('storage_path').in('evaluasi_id', evaluationIds)
    : { data: [], error: null };
  if (fileError) return { error: 'File bukti evaluasi proker tidak dapat diperiksa.' };
  const { error } = await supabase.from('proker').delete().eq('id', id);
  if (error) return { error: 'Proker tidak dapat dihapus. Status atau hak akses mungkin sudah berubah.' };
  const paths = (files ?? []).map((file) => file.storage_path);
  if (paths.length) {
    const admin = createAdminClient();
    for (let index = 0; index < paths.length; index += 100) {
      const { error: storageError } = await admin.storage.from('bukti-evaluasi').remove(paths.slice(index, index + 100));
      if (storageError) {
        revalidatePath('/proker');
        return { message: 'Proker terhapus, tetapi sebagian file bukti belum berhasil dihapus.' };
      }
    }
  }
  revalidatePath('/proker');
  return {};
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
