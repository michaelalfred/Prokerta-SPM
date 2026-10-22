import { currentProfile } from '@/lib/auth';
import { periodeAktif, type InputPeriod } from '@/lib/rules/periode';
import { createClient } from '@/lib/supabase/server';
import { FormProker, type MisiForm } from './form-proker';

export default async function ProkerBaruPage() {
  const profile = await currentProfile();
  const supabase = await createClient();
  const [periodResult, visiResult, misiResult, milestoneResult] = await Promise.all([
    supabase.from('periode_input').select('tahun_program,tanggal_mulai,tanggal_selesai'),
    supabase.from('visi_misi').select('visi').eq('singleton', true).maybeSingle(),
    supabase.from('misi').select('id,nomor,teks,outcome').order('nomor'),
    supabase.from('milestone').select('id,misi_id,nomor,teks').order('nomor'),
  ]);

  const periods = (periodResult.data ?? []) as InputPeriod[];
  const active = periodeAktif(periods, new Date());
  const milestoneByMisi = new Map<string, MisiForm['milestone']>();
  for (const row of milestoneResult.data ?? []) {
    const current = milestoneByMisi.get(row.misi_id) ?? [];
    current.push({ id: row.id, nomor: row.nomor, teks: row.teks });
    milestoneByMisi.set(row.misi_id, current);
  }
  const misi: MisiForm[] = (misiResult.data ?? []).map((row) => ({
    id: row.id,
    nomor: row.nomor,
    teks: row.teks,
    outcome: row.outcome,
    milestone: milestoneByMisi.get(row.id) ?? [],
  }));
  const visi = visiResult.data?.visi ?? '';
  const visionerSiap = Boolean(visi.trim() && misi.some((item) => item.teks.trim() && item.outcome.trim() && item.milestone.some((milestone) => milestone.teks.trim())));

  return <section aria-labelledby="judul-proker-baru" className="mx-auto max-w-4xl">
    <h1 id="judul-proker-baru" className="mb-2 text-2xl font-semibold">Tambah Proker</h1>
    <p className="mb-6 text-sm text-[var(--muted)]">{active ? `Periode input ${active.tahun_program} sedang aktif. Jenis yang tersedia: Rutin dan Visioner.` : 'Tidak ada periode input aktif. Jenis yang tersedia: Aksidental.'}</p>
    {periodResult.error && <p role="alert" className="mb-4 text-red-700">Periode input tidak dapat dimuat. Coba muat ulang halaman.</p>}
    {(visiResult.error || misiResult.error || milestoneResult.error) && <p role="alert" className="mb-4 text-red-700">Data Visi-Misi tidak dapat dimuat.</p>}
    <FormProker active={Boolean(active)} year={active?.tahun_program ?? null} visi={visi} misi={misi} visionerSiap={visionerSiap} organisasi={{ lembaga: profile.tim_kerja.bidang.lembaga.nama, bidang: profile.tim_kerja.bidang.nama, tim: profile.tim_kerja.nama }} />
  </section>;
}
