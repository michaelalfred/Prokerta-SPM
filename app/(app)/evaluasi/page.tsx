import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type Search = { tahun?: string; lembaga?: string; bidang?: string; status?: string };
type Team = { id: string; nama: string; bidang_id: string; bidang: { nama: string; lembaga_id: string; lembaga: { nama: string } } };
type Evaluation = { id: string; proker_id: string; capaian_persen: number; created_at: string };
type Proker = { id: string; nama_kegiatan: string; tahun_program: number; status_efektif: string; tim_kerja_id: string };
const statuses = ['menunggu','ditinjau','disetujui','ditolak','direvisi'];

export default async function EvaluationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const profile = await currentProfile();
  if (profile.role === 'user') redirect('/proker');
  const filters = await searchParams;
  const supabase = await createClient();
  const [teamResult, evaluationResult, yearResult] = await Promise.all([
    supabase.from('tim_kerja').select('id,nama,bidang_id,bidang(nama,lembaga_id,lembaga(nama))').order('nama'),
    supabase.from('evaluasi').select('id,proker_id,capaian_persen,created_at').order('created_at',{ascending:false}),
    supabase.from('proker_v').select('tahun_program'),
  ]);
  const teams = (teamResult.data ?? []) as unknown as Team[];
  const teamMap = new Map(teams.map((team) => [team.id,team]));
  const years = [...new Set((yearResult.data ?? []).map((row) => row.tahun_program))].sort((a,b)=>b-a);
  const teamMatches = (teamId: string) => { const team=teamMap.get(teamId); return !!team && (!filters.lembaga || team.bidang.lembaga_id===filters.lembaga) && (!filters.bidang || team.bidang_id===filters.bidang); };
  const rawRows = (evaluationResult.data ?? []) as unknown as Evaluation[];
  const prokerResult = rawRows.length ? await supabase.from('proker_v').select('id,nama_kegiatan,tahun_program,status_efektif,tim_kerja_id').in('id',rawRows.map((row)=>row.proker_id)) : { data: [], error: null };
  const prokerMap = new Map(((prokerResult.data??[]) as Proker[]).map((row)=>[row.id,row]));
  let rows = rawRows.flatMap((row)=>{const proker=prokerMap.get(row.proker_id);return proker?[{...row,proker}]:[]});
  if (filters.tahun && /^\d{4}$/.test(filters.tahun)) rows=rows.filter((row)=>row.proker.tahun_program===Number(filters.tahun));
  if (filters.status && statuses.includes(filters.status)) rows=rows.filter((row)=>row.proker.status_efektif===filters.status);
  if (filters.lembaga || filters.bidang) rows=rows.filter((row)=>teamMatches(row.proker.tim_kerja_id));
  const fmtDate=(value:string)=>new Date(value).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'});
  return <section className="grid min-w-0 max-w-full gap-5" aria-labelledby="judul-evaluasi">
    <h1 id="judul-evaluasi" className="text-2xl font-semibold">Daftar Evaluasi</h1>
    <form className="grid min-w-0 max-w-full gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filter evaluasi">
      <label className="grid min-w-0 gap-1 text-sm font-medium">Tahun Program<select name="tahun" defaultValue={filters.tahun ?? ''} className="w-full min-w-0 max-w-full truncate"><option value="">Semua tahun</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">Lembaga<select name="lembaga" defaultValue={filters.lembaga ?? ''} className="w-full min-w-0 max-w-full truncate"><option value="">Semua lembaga</option>{[...new Map(teams.map((team) => [team.bidang.lembaga_id, team.bidang.lembaga.nama])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">Bidang<select name="bidang" defaultValue={filters.bidang ?? ''} className="w-full min-w-0 max-w-full truncate"><option value="">Semua bidang</option>{[...new Map(teams.map((team) => [team.bidang_id, `${team.bidang.lembaga.nama} · ${team.bidang.nama}`])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="grid min-w-0 gap-1 text-sm font-medium">Status Proker<select name="status" defaultValue={filters.status ?? ''} className="w-full min-w-0 max-w-full truncate"><option value="">Semua status</option>{statuses.map((status) => <option key={status} value={status}>{status[0].toLocaleUpperCase('id-ID') + status.slice(1)}</option>)}</select></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white">Terapkan filter</button><Link href="/evaluasi" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-4">Bersihkan</Link></div>
    </form>
    {evaluationResult.error || teamResult.error || yearResult.error || prokerResult.error ? (
      <p role="alert" className="rounded-lg border border-red-300 p-4 text-red-700">Daftar evaluasi tidak dapat dimuat. Muat ulang halaman.</p>
    ) : rows.length === 0 ? (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--muted)]">Belum ada evaluasi</div>
    ) : (
      <>
        <div className="grid min-w-0 max-w-full gap-3 md:hidden">
          {rows.map((row) => {
            const team = teamMap.get(row.proker.tim_kerja_id);
            return (
              <article key={row.id} className="grid min-w-0 gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <strong className="min-w-0 break-words">{row.proker.nama_kegiatan}</strong>
                  <span className="inline-flex rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">
                    {row.capaian_persen}%
                  </span>
                </div>
                {team && <p className="text-sm text-[var(--muted)] break-words">{team.bidang.lembaga.nama} · {team.bidang.nama} · {team.nama}</p>}
                <p className="text-sm break-words">{row.proker.tahun_program}</p>
                <p className="text-sm break-words">Tanggal evaluasi: {fmtDate(row.created_at)}</p>
                <Link className="inline-flex min-h-10 items-center font-medium text-blue-700 dark:text-blue-300" href={`/evaluasi/${row.id}`}>
                  Lihat detail
                </Link>
              </article>
            );
          })}
        </div>
        <div className="hidden min-w-0 max-w-full overflow-x-auto rounded-xl border border-[var(--border)] md:block">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead className="bg-[var(--surface)]">
              <tr>
                {['Tahun Program', 'Lembaga · Bidang · Tim', 'Nama Kegiatan', 'Capaian', 'Tanggal Evaluasi', ''].map((heading, index) => (
                  <th key={`${heading}-${index}`} className="border-b border-[var(--border)] px-3 py-3 text-sm font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const team = teamMap.get(row.proker.tim_kerja_id);
                return (
                  <tr key={row.id} className="bg-[var(--page)]">
                    <td className="border-b border-[var(--border)] px-3 py-3">{row.proker.tahun_program}</td>
                    <td className="border-b border-[var(--border)] px-3 py-3">{team ? `${team.bidang.lembaga.nama} · ${team.bidang.nama} · ${team.nama}` : '—'}</td>
                    <td className="border-b border-[var(--border)] px-3 py-3">{row.proker.nama_kegiatan}</td>
                    <td className="border-b border-[var(--border)] px-3 py-3">{row.capaian_persen}%</td>
                    <td className="border-b border-[var(--border)] px-3 py-3">{fmtDate(row.created_at)}</td>
                    <td className="border-b border-[var(--border)] px-3 py-3">
                      <Link className="font-medium text-blue-700 dark:text-blue-300" href={`/evaluasi/${row.id}`}>
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    )}
  </section>;
}
