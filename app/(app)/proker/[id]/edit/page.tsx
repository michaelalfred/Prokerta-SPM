import { notFound, redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { bolehEditProker, type StatusProker } from '@/lib/rules/proker';
import { createClient } from '@/lib/supabase/server';
import type { MisiForm } from '../../baru/form-proker';
import { EditProkerForm } from './edit-proker-form';

type SavedProker = { id: string; tim_kerja_id: string; tahun_program: number; jenis: string; status_efektif: StatusProker; nama_kegiatan: string; sasaran_program: string; indikator_keberhasilan: string; target: string; penanggung_jawab: string; rentang_waktu: boolean; tanggal_mulai: string; tanggal_selesai: string; visi_teks: string | null; misi_teks: string | null; outcome_teks: string | null; milestone_teks: string | null; misi_id: string | null; milestone_id: string | null };

export default async function EditProkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await currentProfile();
  const supabase = await createClient();
  const { data } = await supabase.from('proker_v').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const proker = data as unknown as SavedProker;
  if (!bolehEditProker(profile.role, proker.status_efektif, proker.tim_kerja_id === profile.tim_kerja_id)) redirect(`/proker/${id}`);
  const [budgetsResult, missionsResult, milestonesResult] = await Promise.all([
    supabase.from('proker_anggaran').select('id,nama,jumlah_item,nominal').eq('proker_id', id).order('urutan'),
    supabase.from('misi').select('id,nomor,teks,outcome').order('nomor'),
    supabase.from('milestone').select('id,misi_id,nomor,teks').order('nomor'),
  ]);
  const byMission = new Map<string, MisiForm['milestone']>();
  for (const item of milestonesResult.data ?? []) byMission.set(item.misi_id, [...(byMission.get(item.misi_id) ?? []), { id: item.id, nomor: item.nomor, teks: item.teks }]);
  const misi: MisiForm[] = (missionsResult.data ?? []).map((item) => ({ id: item.id, nomor: item.nomor, teks: item.teks, outcome: item.outcome, milestone: byMission.get(item.id) ?? [] }));
  const complete = { ...proker, anggaran: budgetsResult.data ?? [] };
  return <section className="grid gap-5"><div className="mx-auto w-full max-w-4xl"><h1 className="text-2xl font-semibold">Edit Proker</h1><p className="mt-1 text-sm text-[var(--muted)]">Status efektif: {proker.status_efektif}</p></div>{budgetsResult.error || missionsResult.error || milestonesResult.error ? <p role="alert">Data proker tidak dapat dimuat.</p> : <EditProkerForm proker={complete} misi={misi} />}</section>;
}
