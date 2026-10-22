'use server';

import { revalidatePath } from 'next/cache';
import { currentProfile } from '@/lib/auth';
import { hitungTotalAnggaran, validasiItemAnggaran } from '@/lib/rules/anggaran';
import { jenisProkerTersedia, type InputPeriod, type JenisProker } from '@/lib/rules/periode';
import { createClient } from '@/lib/supabase/server';

export type HasilSimpanProker = { error?: string; success?: string; total?: string };

const ambil = (form: FormData, nama: string) => String(form.get(nama) ?? '').trim();

function tanggalValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function simpanProker(_state: HasilSimpanProker, form: FormData): Promise<HasilSimpanProker> {
  await currentProfile();
  const supabase = await createClient();
  const jenis = ambil(form, 'jenis') as JenisProker;
  const sasaran_program = ambil(form, 'sasaran_program');
  const indikator_keberhasilan = ambil(form, 'indikator_keberhasilan');
  const target = ambil(form, 'target');
  const nama_kegiatan = ambil(form, 'nama_kegiatan');
  const penanggung_jawab = ambil(form, 'penanggung_jawab');
  const rentang_waktu = form.get('rentang_waktu') === 'on';
  const tanggal_mulai = ambil(form, 'tanggal_mulai');
  const tanggal_selesai = rentang_waktu ? ambil(form, 'tanggal_selesai') : tanggal_mulai;
  const misi_id = ambil(form, 'misi_id') || null;
  const milestone_id = ambil(form, 'milestone_id') || null;

  if (![sasaran_program, indikator_keberhasilan, target, nama_kegiatan, penanggung_jawab].every(Boolean)) {
    return { error: 'Semua field wajib diisi.' };
  }
  if (!tanggalValid(tanggal_mulai) || !tanggalValid(tanggal_selesai) || (rentang_waktu && tanggal_selesai < tanggal_mulai)) {
    return { error: 'Periksa tanggal waktu pelaksanaan. Tanggal selesai harus sama atau setelah tanggal mulai.' };
  }

  const { data: periods, error: periodError } = await supabase
    .from('periode_input')
    .select('tahun_program,tanggal_mulai,tanggal_selesai');
  if (periodError) return { error: 'Periode input tidak dapat diperiksa. Coba lagi.' };
  const tersedia = jenisProkerTersedia((periods ?? []) as InputPeriod[], new Date());
  if (!['rutin', 'visioner', 'aksidental'].includes(jenis) || !tersedia.some((item) => item.jenis === jenis)) {
    return { error: 'Jenis proker tidak tersedia untuk tanggal hari ini. Muat ulang halaman dan coba lagi.' };
  }

  let dataAnggaran: unknown;
  try {
    dataAnggaran = JSON.parse(ambil(form, 'anggaran'));
  } catch {
    dataAnggaran = null;
  }
  const anggaran = validasiItemAnggaran(dataAnggaran);
  if (!anggaran) return { error: 'Isi minimal satu rincian biaya dengan nama, jumlah item bilangan bulat lebih dari nol, dan harga satuan nol atau lebih (maksimal dua desimal).' };
  const total = hitungTotalAnggaran(anggaran);

  if (jenis === 'visioner' && (!misi_id || !milestone_id)) {
    return { error: 'Pilih Misi dan Milestone untuk proker Visioner.' };
  }
  if (jenis !== 'visioner' && (misi_id || milestone_id)) {
    return { error: 'Misi dan Milestone hanya diisi untuk proker Visioner.' };
  }

  const { error } = await supabase.rpc('buat_proker_dengan_anggaran', {
    p_jenis: jenis,
    p_sasaran_program: sasaran_program,
    p_indikator_keberhasilan: indikator_keberhasilan,
    p_target: target,
    p_nama_kegiatan: nama_kegiatan,
    p_rentang_waktu: rentang_waktu,
    p_tanggal_mulai: tanggal_mulai,
    p_tanggal_selesai: tanggal_selesai,
    p_penanggung_jawab: penanggung_jawab,
    p_anggaran: anggaran.map((item) => ({ ...item, jumlah_item: String(item.jumlah_item) })),
    p_misi_id: misi_id,
    p_milestone_id: milestone_id,
  });
  if (error) {
    const pesanDikenal = [
      'Dalam periode input', 'Di luar periode input', 'Data Visi-Misi', 'Pilih Misi', 'Pilih Milestone',
      'Semua field', 'Periksa tanggal', 'Rincian biaya', 'Nama dan jumlah', 'Jumlah item', 'Harga satuan anggaran',
    ];
    return { error: pesanDikenal.some((pesan) => error.message.includes(pesan)) ? error.message : 'Proker tidak dapat disimpan. Periksa data lalu coba lagi.' };
  }

  revalidatePath('/proker');
  return { success: 'Proker berhasil disimpan.', total };
}
