import Link from 'next/link';
import { formatRupiah } from '@/lib/rules/anggaran';
import { combineAchievement, compliancePercent, groupByDivision, type AchievementTeam, type ComplianceTeam } from '@/lib/rules/analisis';
import { createClient } from '@/lib/supabase/server';

type Props = { year: number; month: string; institutionId: string | null };
type Missing = { proker_id: string; nama_kegiatan: string; tanggal_mulai: string; tanggal_selesai: string; bulan_evaluasi: string };
type MonthlyBudget = { lembaga_id: string; lembaga: string; bidang_id: string; bidang: string; tim_kerja_id: string; tim_kerja: string; proker_id: string; nama_kegiatan: string; evaluasi_id: string; bulan_evaluasi: string; realisasi: string };
type Group<T> = { id: string; nama: string; rows: T[] };
const card = 'grid min-w-0 gap-3 rounded-lg border border-[var(--border)] p-3';
const count = (value: number | string | null | undefined) => Number(value ?? 0);
const monthTitle = (value: string) => new Date(`${value}T12:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric' });
function groupBy<T>(rows: T[], id: (row: T) => string, name: (row: T) => string): Group<T>[] {
  const groups = new Map<string, Group<T>>();
  for (const row of rows) {
    const key = id(row); const group = groups.get(key) ?? { id: key, nama: name(row), rows: [] };
    group.rows.push(row); groups.set(key, group);
  }
  return [...groups.values()];
}

export async function MonthlyEvaluationAnalysis({ year, month, institutionId }: Props) {
  const supabase = await createClient();
  const [complianceResult, achievementResult, budgetResult] = await Promise.all([
    supabase.rpc('analisis_evaluasi_kepatuhan_bulanan', { p_tahun: year, p_bulan: month, p_lembaga: institutionId }),
    supabase.rpc('analisis_capaian_bulanan', { p_tahun: year, p_bulan: month, p_lembaga: institutionId }),
    supabase.rpc('analisis_realisasi_bulanan', { p_tahun: year, p_bulan: month, p_lembaga: institutionId }),
  ]);
  const compliance = (complianceResult.data ?? []) as (ComplianceTeam & { daftar_belum: Missing[] })[];
  const achievements = (achievementResult.data ?? []) as AchievementTeam[];
  const budgets = (budgetResult.data ?? []) as MonthlyBudget[];
  const missing = compliance.flatMap((row) => (row.daftar_belum ?? []).map((item) => ({ ...item, tim: row.tim_kerja })));
  const due = compliance.reduce((sum, row) => sum + count(row.disetujui), 0);
  const done = compliance.reduce((sum, row) => sum + count(row.sudah_dievaluasi), 0);
  const pending = compliance.reduce((sum, row) => sum + count(row.belum_dievaluasi), 0);
  const totalActual = budgets.reduce((sum, row) => sum + Number(row.realisasi), 0).toFixed(2);
  const institutions = groupBy(budgets, (row) => row.lembaga_id, (row) => row.lembaga);
  const divisions = groupByDivision(achievements);
  const error = complianceResult.error || achievementResult.error || budgetResult.error;

  return <section className="grid min-w-0 gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
    <div><h2 className="text-lg font-semibold">Evaluasi Bulanan · {monthTitle(month)}</h2><p className="text-sm text-[var(--muted)]">Data bulanan terpisah dari evaluasi tahunan.</p></div>
    {error ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">Data analisis bulanan tidak dapat dimuat. Periksa migrasi database atau muat ulang halaman.</p> : <>
      <section className={card}>
        <h3 className="font-semibold">Kepatuhan Evaluasi Bulanan</h3>
        <p>Proker disetujui {due} · Dievaluasi {done} · Belum {pending} · {compliancePercent(done, due) === null ? '—' : `${compliancePercent(done, due)}%`}</p>
        {compliance.length > 0 && <div className="grid gap-2">{compliance.map((row) => <p key={row.tim_kerja_id} className="text-sm"><strong>{row.bidang} · {row.tim_kerja}:</strong> disetujui {row.disetujui}, dievaluasi {row.sudah_dievaluasi}, belum {row.belum_dievaluasi}</p>)}</div>}
        <h4 className="font-medium">Belum dievaluasi bulan ini</h4>
        {missing.length === 0 ? <p className="text-sm text-[var(--muted)]">Semua proker bulanan yang disetujui telah dievaluasi untuk bulan ini.</p> : <div className="grid gap-2">{missing.map((item) => <p key={item.proker_id} className="text-sm">{item.tim} · <Link className="underline" href={`/proker/${item.proker_id}`}>{item.nama_kegiatan}</Link></p>)}</div>}
      </section>
      <section className={card}>
        <h3 className="font-semibold">Capaian Bulanan</h3>
        {divisions.length === 0 ? <p className="text-sm text-[var(--muted)]">Belum ada evaluasi untuk bulan ini.</p> : <div className="grid gap-2">{divisions.map((division) => { const summary = combineAchievement(division.rows); return <p key={division.id}><strong>{division.nama}:</strong> {summary.count} evaluasi · rata-rata {summary.average?.toFixed(1)}% · rentang 0–49% / 50–79% / 80–100%: {summary.ranges.join(' / ')}</p>; })}</div>}
      </section>
      <section className={card}>
        <h3 className="font-semibold">Realisasi Anggaran Bulanan</h3>
        <p><strong>Total realisasi:</strong> {formatRupiah(totalActual)}</p>
        <p className="text-sm text-[var(--muted)]">Rencana dicatat untuk seluruh proker, jadi realisasi bulan ini ditampilkan tanpa serapan atau selisih.</p>
        {budgets.length === 0 ? <p className="text-sm text-[var(--muted)]">Belum ada realisasi anggaran bulan ini.</p> : <div className="grid gap-2">{institutions.map((institution) => { const institutionTotal = institution.rows.reduce((sum, row) => sum + Number(row.realisasi), 0).toFixed(2); const divisions = groupBy(institution.rows, (row) => row.bidang_id, (row) => row.bidang); return <details key={institution.id} className="rounded-lg border border-[var(--border)] p-3"><summary className="cursor-pointer"><strong>{institution.nama}:</strong> {formatRupiah(institutionTotal)}</summary><div className="mt-2 grid gap-2">{divisions.map((division) => { const divisionTotal = division.rows.reduce((sum, row) => sum + Number(row.realisasi), 0).toFixed(2); const teams = groupBy(division.rows, (row) => row.tim_kerja_id, (row) => row.tim_kerja); return <details key={division.id} className="rounded border border-[var(--border)] p-2"><summary className="cursor-pointer">{division.nama}: {formatRupiah(divisionTotal)}</summary><div className="mt-2 grid gap-2">{teams.map((team) => { const teamTotal = team.rows.reduce((sum, row) => sum + Number(row.realisasi), 0).toFixed(2); return <details key={team.id} className="rounded border border-[var(--border)] p-2"><summary className="cursor-pointer">{team.nama}: {formatRupiah(teamTotal)}</summary><ul className="mt-2 grid gap-1 text-sm">{team.rows.map((row) => <li key={row.evaluasi_id} className="break-words">{row.nama_kegiatan}: {formatRupiah(row.realisasi)}</li>)}</ul></details>; })}</div></details>; })}</div></details>; })}</div>}
      </section>
    </>}
  </section>;
}
