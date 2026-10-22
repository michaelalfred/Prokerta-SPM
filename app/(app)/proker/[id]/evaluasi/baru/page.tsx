import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { bolehIsiEvaluasi, type StatusProker } from '@/lib/rules/proker';
import { createClient } from '@/lib/supabase/server';
import { EvaluationForm } from './evaluation-form';

export default async function NewEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await currentProfile();
  const supabase = await createClient();
  const { data } = await supabase.from('proker_v').select('id,tim_kerja_id,status_efektif,rentang_waktu,tanggal_mulai,tanggal_selesai').eq('id', id).maybeSingle();
  if (!data) notFound();
  if (data.tim_kerja_id !== profile.tim_kerja_id || !bolehIsiEvaluasi(data.status_efektif as StatusProker, true, false)) redirect(`/proker/${id}`);
  const { data: existing } = await supabase.from('evaluasi').select('id').eq('proker_id', id).maybeSingle();
  if (existing) redirect(`/proker/${id}`);
  return <article className="mx-auto grid min-w-0 max-w-3xl gap-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Evaluasi Proker</h1><Link href={`/proker/${id}`} className="rounded-lg border border-[var(--border)] px-4 py-2">Kembali</Link></div><p>Evaluasi tidak dapat diedit setelah dikirim.</p><EvaluationForm prokerId={id} tanggalMulai={data.tanggal_mulai} tanggalSelesai={data.tanggal_selesai} rentang={data.rentang_waktu} /></article>;
}
