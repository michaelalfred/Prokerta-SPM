import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { formatRupiah, hitungTotalAnggaran } from '@/lib/rules/anggaran';
import { bolehEditProker, bolehHapusProker, bolehIsiEvaluasi, bolehUbahStatus, type StatusProker } from '@/lib/rules/proker';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { DeleteProkerForm } from './delete-proker-form';
import { StatusProkerForm } from './status-proker-form';

type Proker = { id: string; tim_kerja_id: string; tahun_program: number; jenis: string; status: string; status_efektif: StatusProker; misi_id: string | null; milestone_id: string | null; visi_teks: string | null; misi_teks: string | null; outcome_teks: string | null; milestone_teks: string | null; sasaran_program: string; indikator_keberhasilan: string; target: string; nama_kegiatan: string; rentang_waktu: boolean; tanggal_mulai: string; tanggal_selesai: string; penanggung_jawab: string; created_at: string };
type Budget = { id: string; urutan: number; nama: string; jumlah_item: number; nominal: string | number };

function tanggal(value: string) { return new Date(`${value}T12:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }); }
function label(value: string) { return value[0].toLocaleUpperCase('id-ID') + value.slice(1); }

export default async function DetailProkerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ galat?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const profile = await currentProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from('proker_v').select('*').eq('id', id).maybeSingle();
  if (error || !data) notFound();
  const proker = data as unknown as Proker;
  const own = proker.tim_kerja_id === profile.tim_kerja_id;
  const teamResult = await supabase.from('tim_kerja').select('id,nama,bidang(nama,lembaga(nama))').eq('id', proker.tim_kerja_id).single();
  const team = teamResult.data as unknown as { nama: string; bidang: { nama: string; lembaga: { nama: string } } } | null;
  const [budgetResult, evaluationResult] = await Promise.all([
    supabase.from('proker_anggaran').select('id,urutan,nama,jumlah_item,nominal').eq('proker_id', id).order('urutan'),
    supabase.from('evaluasi').select('*').eq('proker_id', id).maybeSingle(),
  ]);
  const budgets = (budgetResult.data ?? []) as Budget[];
  const total = hitungTotalAnggaran(budgets.length ? budgets : [{ nominal: '0' }]);
  const allowedEdit = bolehEditProker(profile.role, proker.status_efektif, own);
  const allowedDelete = bolehHapusProker(profile.role, proker.status_efektif, own);
  const allowedStatus = bolehUbahStatus(profile.role, proker.status_efektif);
  const allowedEvaluation = bolehIsiEvaluasi(proker.status_efektif, own, Boolean(evaluationResult.data));
  const evaluation = evaluationResult.data;
  const [realizationResult, filesResult] = evaluation ? await Promise.all([
    supabase.from('evaluasi_anggaran').select('id,urutan,nama,jumlah_item,nominal').eq('evaluasi_id', evaluation.id).order('urutan'),
    supabase.from('evaluasi_file').select('nama_file,mime_type,storage_path').eq('evaluasi_id', evaluation.id).order('created_at'),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const adminStorage = createAdminClient().storage.from('bukti-evaluasi');
  const proofFiles = await Promise.all((filesResult.data ?? []).map(async (file) => {
    const { data: signed } = await adminStorage.createSignedUrl(file.storage_path, 60);
    return { ...file, url: signed?.signedUrl ?? null };
  }));
  const realization = (realizationResult.data ?? []) as Budget[];
  const realizationTotal = hitungTotalAnggaran(realization.length ? realization : [{ nominal: '0' }]);

  return <article className="mx-auto grid max-w-4xl gap-5" aria-labelledby="judul-detail">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 id="judul-detail" className="text-2xl font-semibold">Detail Proker</h1><Link href="/proker" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-4">Kembali ke daftar</Link></div>
    {query.galat && <p role="alert" className="rounded-lg border border-red-300 p-3 text-red-700">Aksi tidak dapat dilakukan. Status atau hak akses proker mungkin sudah berubah.</p>}
    <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 sm:p-6">
      <h2 className="text-lg font-semibold sm:col-span-2">Identitas Organisasi dan Status</h2>
      <p><span className="block text-sm text-[var(--muted)]">Lembaga</span>{team?.bidang.lembaga.nama ?? '—'}</p>
      <p><span className="block text-sm text-[var(--muted)]">Bidang</span>{team?.bidang.nama ?? '—'}</p>
      <p><span className="block text-sm text-[var(--muted)]">Tim Kerja</span>{team?.nama ?? '—'}</p>
      <p><span className="block text-sm text-[var(--muted)]">Tahun Program</span>{proker.tahun_program}</p>
      <p><span className="block text-sm text-[var(--muted)]">Jenis</span>{label(proker.jenis)}</p>
      <p><span className="block text-sm text-[var(--muted)]">Status</span>{label(proker.status_efektif)}</p>
    </section>
    {proker.jenis === 'visioner' && <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"><h2 className="text-lg font-semibold">Program Visioner (snapshot saat disimpan)</h2><p><strong>Visi:</strong> {proker.visi_teks}</p><p><strong>Misi:</strong> {proker.misi_teks}</p><p><strong>Outcomes:</strong> {proker.outcome_teks}</p><p><strong>Milestone:</strong> {proker.milestone_teks}</p></section>}
    <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 sm:p-6">
      <h2 className="text-lg font-semibold sm:col-span-2">Substansi dan Target</h2>
      <p><strong>Sasaran Program:</strong><br />{proker.sasaran_program}</p>
      <p><strong>Indikator Keberhasilan:</strong><br />{proker.indikator_keberhasilan}</p>
      <p><strong>Target:</strong><br />{proker.target}</p>
      <p><strong>Rincian / Nama Kegiatan:</strong><br />{proker.nama_kegiatan}</p>
      <p><strong>Waktu Pelaksanaan:</strong><br />{proker.rentang_waktu ? `${tanggal(proker.tanggal_mulai)} – ${tanggal(proker.tanggal_selesai)}` : tanggal(proker.tanggal_mulai)}</p>
      <p><strong>Penanggung Jawab (PJ):</strong><br />{proker.penanggung_jawab}</p>
    </section>
    <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"><h2 className="text-lg font-semibold">Rincian Biaya</h2><div className="grid gap-2">{budgets.map((item) => <div key={item.id} className="grid gap-1 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1fr_auto_auto]"><span>{item.nama}</span><span>Jumlah item: {item.jumlah_item}</span><span>{formatRupiah(String(item.nominal))}</span></div>)}</div><p className="text-right text-lg font-semibold">Total Anggaran: {formatRupiah(total)}</p></section>
    {evaluationResult.error || budgetResult.error || teamResult.error || realizationResult.error || filesResult.error ? <p role="alert" className="text-red-700">Sebagian data proker tidak dapat dimuat.</p> : null}
    <section className="flex flex-wrap gap-3" aria-label="Aksi proker">
      {allowedEdit && <Link href={`/proker/${id}/edit`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-4">Edit</Link>}
      {allowedDelete && <DeleteProkerForm id={id} />}
      {allowedStatus && <StatusProkerForm id={id} currentStatus={proker.status_efektif} />}
      {allowedEvaluation && <Link href={`/proker/${id}/evaluasi/baru`} className="inline-flex min-h-10 items-center rounded-lg bg-green-700 px-4 text-white">Isi Evaluasi</Link>}
      {profile.role !== 'user' && proker.status_efektif === 'direvisi' && <StatusProkerForm id={id} currentStatus={proker.status_efektif} completeRevision />}
    </section>
    {evaluation && <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"><h2 className="text-lg font-semibold">Evaluasi (read-only)</h2><p><strong>Hasil Kegiatan:</strong><br />{evaluation.hasil_kegiatan}</p><p><strong>Capaian:</strong> {evaluation.capaian_persen}%</p><p><strong>Waktu Pelaksanaan:</strong> {evaluation.rentang_waktu ? `${tanggal(evaluation.tanggal_mulai)} – ${tanggal(evaluation.tanggal_selesai)}` : tanggal(evaluation.tanggal_mulai)}</p>{evaluation.keterangan_tambahan && <p><strong>Keterangan Tambahan:</strong><br />{evaluation.keterangan_tambahan}</p>}<h3 className="font-semibold">Realisasi Anggaran</h3>{realization.map((item) => <div key={item.id} className="grid gap-1 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1fr_auto_auto]"><span>{item.nama}</span><span>Jumlah item: {item.jumlah_item}</span><span>{formatRupiah(String(item.nominal))}</span></div>)}<p className="text-right font-semibold">Total Realisasi: {formatRupiah(realizationTotal)}</p>{proofFiles.length>0 && <><h3 className="font-semibold">Foto / Bukti</h3><div className="grid gap-3 sm:grid-cols-2">{proofFiles.map((file) => <div key={file.storage_path} className="grid gap-2">{file.url && file.mime_type.startsWith('image/') ? <a href={file.url} target="_blank" rel="noreferrer"><Image unoptimized width={640} height={480} src={file.url} alt={file.nama_file} className="max-h-72 w-auto rounded-lg object-contain" /></a> : file.url ? <a className="text-blue-700 underline dark:text-blue-300" href={file.url} target="_blank" rel="noreferrer">Buka PDF: {file.nama_file}</a> : <span>{file.nama_file} (tidak dapat dibuka)</span>}</div>)}</div></>}</section>}
  </article>;
}
