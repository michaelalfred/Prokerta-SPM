'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { hitungTotalAnggaran, validasiItemAnggaran } from '@/lib/rules/anggaran';
import { bolehEditProker, type StatusProker } from '@/lib/rules/proker';
import { createClient } from '@/lib/supabase/server';
import type { HasilSimpanProker } from '../../baru/actions';

const ambil = (form: FormData, nama: string) => String(form.get(nama) ?? '').trim();
function tanggalValid(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function simpanEditProker(_state: HasilSimpanProker, form: FormData): Promise<HasilSimpanProker> {
  const id = ambil(form, 'id');
  const profile = await currentProfile();
  const supabase = await createClient();
  const { data: proker } = await supabase.from('proker_v').select('id,tim_kerja_id,status_efektif').eq('id', id).maybeSingle();
  if (!proker || !bolehEditProker(profile.role, proker.status_efektif as StatusProker, proker.tim_kerja_id === profile.tim_kerja_id)) return { error: 'Anda tidak berhak mengubah proker ini.' };

  const fields = ['sasaran_program', 'indikator_keberhasilan', 'target', 'nama_kegiatan', 'penanggung_jawab'] as const;
  const values = Object.fromEntries(fields.map((key) => [key, ambil(form, key)])) as Record<(typeof fields)[number], string>;
  if (!fields.every((key) => values[key])) return { error: 'Semua field proker wajib diisi.' };
  const rentang_waktu = form.get('rentang_waktu') === 'on';
  const tanggal_mulai = ambil(form, 'tanggal_mulai');
  const tanggal_selesai = rentang_waktu ? ambil(form, 'tanggal_selesai') : tanggal_mulai;
  if (!tanggalValid(tanggal_mulai) || !tanggalValid(tanggal_selesai) || (rentang_waktu && tanggal_selesai < tanggal_mulai)) return { error: 'Periksa tanggal waktu pelaksanaan.' };

  let rawBudget: unknown;
  try { rawBudget = JSON.parse(ambil(form, 'anggaran')); } catch { rawBudget = null; }
  const anggaran = validasiItemAnggaran(rawBudget);
  if (!anggaran) return { error: 'Isi minimal satu rincian biaya dengan nama, jumlah item bilangan bulat lebih dari nol, dan harga satuan nol atau lebih (maksimal dua desimal).' };
  const { error } = await supabase.rpc('ubah_proker_dengan_anggaran', {
    p_id: id,
    p_sasaran_program: values.sasaran_program,
    p_indikator_keberhasilan: values.indikator_keberhasilan,
    p_target: values.target,
    p_nama_kegiatan: values.nama_kegiatan,
    p_rentang_waktu: rentang_waktu,
    p_tanggal_mulai: tanggal_mulai,
    p_tanggal_selesai: tanggal_selesai,
    p_penanggung_jawab: values.penanggung_jawab,
    p_anggaran: anggaran.map((item) => ({ ...item, jumlah_item: String(item.jumlah_item) })),
    p_misi_id: ambil(form, 'misi_id') || null,
    p_milestone_id: ambil(form, 'milestone_id') || null,
  });
  if (error) return { error: error.message.includes('tidak berhak') ? error.message : 'Perubahan proker tidak dapat disimpan. Periksa data dan status proker.' };
  const total = hitungTotalAnggaran(anggaran);
  revalidatePath('/proker');
  revalidatePath(`/proker/${id}`);
  redirect(`/proker/${id}?tersimpan=${encodeURIComponent(total)}`);
}
