'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { validasiItemAnggaran } from '@/lib/rules/anggaran';
import { bolehIsiEvaluasi, type StatusProker } from '@/lib/rules/proker';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type MetaFile = { nama_file: string; mime_type: string; ukuran_bytes: number };
const allowedMime = ['image/jpeg', 'image/png', 'application/pdf'];
const extByMime: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

async function bolehIsi(prokerId: string, bulanEvaluasi: string | null = null) {
  const profile = await currentProfile();
  const supabase = await createClient();
  const { data: proker } = await supabase.from('proker_v').select('id,tim_kerja_id,tahun_program,jenis_evaluasi,status_efektif').eq('id', prokerId).maybeSingle();
  if (!proker || proker.tim_kerja_id !== profile.tim_kerja_id || !bolehIsiEvaluasi(proker.status_efektif as StatusProker, true, false)) return null;
  if (proker.jenis_evaluasi === 'tahunan') {
    if (bulanEvaluasi !== null) return null;
    const { data: existing } = await supabase.from('evaluasi').select('id').eq('proker_id', prokerId).is('bulan_evaluasi', null).maybeSingle();
    return existing ? null : { profile, supabase, proker };
  }
  if (!bulanEvaluasi || !/^\d{4}-(0[1-9]|1[0-2])-01$/.test(bulanEvaluasi) || Number(bulanEvaluasi.slice(0, 4)) !== proker.tahun_program) return null;
  const { data: existing } = await supabase.from('evaluasi').select('id').eq('proker_id', prokerId).eq('bulan_evaluasi', bulanEvaluasi).maybeSingle();
  return existing ? null : { profile, supabase, proker };
}

export async function siapkanUpload(prokerId: string, bulanEvaluasi: string | null, files: MetaFile[]) {
  const context = await bolehIsi(prokerId, bulanEvaluasi);
  if (!context) return { error: 'Proker tidak dapat dievaluasi. Muat ulang halaman.' };
  if (!Array.isArray(files) || files.length > 10 || files.some((file) => !file || !allowedMime.includes(file.mime_type) || !Number.isInteger(file.ukuran_bytes) || file.ukuran_bytes < 1 || file.ukuran_bytes > 10485760)) {
    return { error: 'Pilih maksimal 10 file JPG, PNG, atau PDF. Ukuran setiap file maksimal 10 MB.' };
  }
  const admin = createAdminClient();
  const evaluationId = randomUUID();
  const signedFiles: { path: string; token: string; nama_file: string; ukuran_bytes: number; mime_type: string }[] = [];
  for (const file of files) {
    const path = `${context.profile.tim_kerja_id}/${evaluationId}/${randomUUID()}.${extByMime[file.mime_type]}`;
    const { data, error } = await admin.storage.from('bukti-evaluasi').createSignedUploadUrl(path);
    if (error || !data) {
      if (signedFiles.length) await admin.storage.from('bukti-evaluasi').remove(signedFiles.map((item) => item.path));
      return { error: 'Tautan unggah bukti tidak dapat dibuat.' };
    }
    signedFiles.push({ path: data.path, token: data.token, nama_file: file.nama_file.slice(0, 255), ukuran_bytes: file.ukuran_bytes, mime_type: file.mime_type });
  }
  return { evaluationId, files: signedFiles };
}

export async function simpanEvaluasi(prokerId: string, form: FormData) {
  const bulanEvaluasi = String(form.get('bulan_evaluasi') ?? '') || null;
  const context = await bolehIsi(prokerId, bulanEvaluasi);
  if (!context) redirect(`/proker/${prokerId}?galat=evaluasi`);
  const hasil = String(form.get('hasil_kegiatan') ?? '').trim();
  const capaianText = String(form.get('capaian_persen') ?? '');
  const capaian = /^\d+$/.test(capaianText) ? Number(capaianText) : -1;
  const rentang = form.get('rentang_waktu') === 'on';
  const mulai = String(form.get('tanggal_mulai') ?? '');
  const selesai = rentang ? String(form.get('tanggal_selesai') ?? '') : mulai;
  const tambahan = String(form.get('keterangan_tambahan') ?? '').trim();
  let anggaran: unknown;
  let files: unknown;
  let evaluationId = '';
  try {
    anggaran = JSON.parse(String(form.get('anggaran') ?? ''));
    files = JSON.parse(String(form.get('files') ?? '[]'));
    evaluationId = String(form.get('evaluation_id') ?? '');
  } catch { redirect(`/proker/${prokerId}?galat=evaluasi`); }
  const budgetItems = validasiItemAnggaran(anggaran);
  if (!hasil || capaian < 0 || capaian > 100 || !/^[0-9a-f-]{36}$/i.test(evaluationId) || !budgetItems || !Array.isArray(files) || files.length > 10) redirect(`/proker/${prokerId}?galat=evaluasi`);
  const admin = createAdminClient();
  const paths = (files as { storage_path?: string }[]).map((file) => file.storage_path).filter((path): path is string => typeof path === 'string');
  const { error } = await context.supabase.rpc('buat_evaluasi_dengan_anggaran', {
    p_id: evaluationId, p_proker_id: prokerId, p_hasil_kegiatan: hasil, p_capaian_persen: capaian,
    p_rentang_waktu: rentang, p_tanggal_mulai: mulai, p_tanggal_selesai: selesai,
    p_keterangan_tambahan: tambahan || null,
    p_anggaran: budgetItems.map((item) => ({ ...item, jumlah_item: String(item.jumlah_item) })),
    p_files: files,
    p_bulan_evaluasi: bulanEvaluasi,
  });
  if (error) {
    if (paths.length) await admin.storage.from('bukti-evaluasi').remove(paths);
    redirect(`/proker/${prokerId}?galat=evaluasi`);
  }
  revalidatePath('/evaluasi');
  revalidatePath(`/proker/${prokerId}`);
  redirect(`/proker/${prokerId}`);
}

export async function signedUrlBukti(prokerId: string, storagePath: string) {
  const profile = await currentProfile();
  const supabase = await createClient();
  const { data: proker } = await supabase.from('proker_v').select('tim_kerja_id').eq('id', prokerId).maybeSingle();
  if (!proker || (proker.tim_kerja_id !== profile.tim_kerja_id && !['admin', 'superadmin'].includes(profile.role))) return null;
  const { data: file } = await supabase.from('evaluasi_file').select('id').eq('storage_path', storagePath).maybeSingle();
  if (!file) return null;
  const { data } = await createAdminClient().storage.from('bukti-evaluasi').createSignedUrl(storagePath, 60);
  return data?.signedUrl ?? null;
}
