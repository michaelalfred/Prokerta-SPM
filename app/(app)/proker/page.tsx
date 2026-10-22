import Link from 'next/link';

import { currentProfile } from '@/lib/auth';
import { formatRupiah, hitungTotalAnggaran } from '@/lib/rules/anggaran';
import { createClient } from '@/lib/supabase/server';
import type { StatusProker } from '@/lib/rules/proker';

type Search = { tahun?: string; lembaga?: string; bidang?: string; status?: string };
type TeamInfo = { id: string; nama: string; bidang_id: string; bidang: { nama: string; lembaga_id: string; lembaga: { nama: string } } };
type ProkerRow = { id: string; tim_kerja_id: string; tahun_program: number; jenis: string; status: string; status_efektif: StatusProker; nama_kegiatan: string; tanggal_mulai: string; tanggal_selesai: string; rentang_waktu: boolean; created_at: string };
type BudgetRow = { proker_id: string; nominal: string | number };
const statuses: StatusProker[] = ['menunggu', 'ditinjau', 'disetujui', 'ditolak', 'direvisi'];

function tanggal(value: string): string {
  return new Date(`${value}T12:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
}

function Badge({ status }: { status: StatusProker }) {
  const colors: Record<StatusProker, string> = {
    menunggu: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100',
    ditinjau: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100',
    disetujui: 'border-green-300 bg-green-50 text-green-900 dark:border-green-700 dark:bg-green-950 dark:text-green-100',
    ditolak: 'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100',
    direvisi: 'border-purple-300 bg-purple-50 text-purple-900 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-100',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-sm ${colors[status]}`}>{status[0].toLocaleUpperCase('id-ID') + status.slice(1)}</span>;
}

export default async function ProkerPage({ searchParams }: { searchParams: Promise<Search> }) {
  const profile = await currentProfile();
  const filters = await searchParams;
  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin';
  const supabase = await createClient();

  const [teamsResult, yearsResult] = isAdmin ? await Promise.all([
    supabase.from('tim_kerja').select('id,nama,bidang_id,bidang(nama,lembaga_id,lembaga(nama))').order('nama'),
    supabase.from('proker_v').select('tahun_program'),
  ]) : [null, null];
  const teams = (teamsResult?.data ?? []) as unknown as TeamInfo[];
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const years = [...new Set((yearsResult?.data ?? []).map((row) => row.tahun_program))].sort((a, b) => b - a);
  const validYear = filters.tahun && /^\d{4}$/.test(filters.tahun) ? Number(filters.tahun) : null;
  const validStatus = statuses.includes(filters.status as StatusProker) ? filters.status as StatusProker : null;
  let query = supabase.from('proker_v').select('id,tim_kerja_id,tahun_program,jenis,status,status_efektif,nama_kegiatan,tanggal_mulai,tanggal_selesai,rentang_waktu,created_at').order('created_at', { ascending: false });
  if (validYear) query = query.eq('tahun_program', validYear);
  if (validStatus) query = query.eq('status_efektif', validStatus);
  const selectedTeams = teams.filter((team) => (!filters.lembaga || team.bidang.lembaga_id === filters.lembaga) && (!filters.bidang || team.bidang_id === filters.bidang));
  if (isAdmin && (filters.lembaga || filters.bidang)) query = selectedTeams.length ? query.in('tim_kerja_id', selectedTeams.map((team) => team.id)) : query.eq('tim_kerja_id', '00000000-0000-0000-0000-000000000000');
  const { data, error } = await query;
  const rows = (data ?? []) as ProkerRow[];
  const ids = rows.map((row) => row.id);
  const budgetResult = ids.length ? await supabase.from('proker_anggaran').select('proker_id,nominal').in('proker_id', ids) : { data: [], error: null };
  const totalByProker = new Map<string, string>();
  for (const row of budgetResult.data ?? []) {
    const item = row as BudgetRow;
    const current = totalByProker.get(item.proker_id) ?? '0.00';
    totalByProker.set(item.proker_id, hitungTotalAnggaran([{ nominal: current }, { nominal: item.nominal }]));
  }
  const teamName = (id: string) => {
    const team = teamById.get(id);
    return isAdmin && team ? `${team.bidang.lembaga.nama} · ${team.bidang.nama} · ${team.nama}` : profile.tim_kerja.nama;
  };
  const dateLabel = (row: ProkerRow) => row.rentang_waktu ? `${tanggal(row.tanggal_mulai)} – ${tanggal(row.tanggal_selesai)}` : tanggal(row.tanggal_mulai);

  return <section className="grid min-w-0 gap-5" aria-labelledby="judul-proker">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 id="judul-proker" className="text-2xl font-semibold">Proker</h1><Link href="/proker/baru" className="inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-4 font-medium text-white">Tambah Proker</Link></div>
    {isAdmin && <form className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filter proker">
      <label className="grid gap-1">Tahun Program<select name="tahun" defaultValue={filters.tahun ?? ''}><option value="">Semua tahun</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <label className="grid gap-1">Lembaga<select name="lembaga" defaultValue={filters.lembaga ?? ''}><option value="">Semua lembaga</option>{[...new Map(teams.map((team) => [team.bidang.lembaga_id, team.bidang.lembaga.nama])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="grid gap-1">Bidang<select name="bidang" defaultValue={filters.bidang ?? ''}><option value="">Semua bidang</option>{[...new Map(teams.map((team) => [team.bidang_id, `${team.bidang.lembaga.nama} · ${team.bidang.nama}`])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="grid gap-1">Status<select name="status" defaultValue={filters.status ?? ''}><option value="">Semua status</option>{statuses.map((status) => <option key={status} value={status}>{status[0].toLocaleUpperCase('id-ID') + status.slice(1)}</option>)}</select></label>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4"><button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white">Terapkan filter</button><Link href="/proker" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-4">Bersihkan</Link></div>
    </form>}
    {error || budgetResult.error ? <p role="alert" className="rounded-lg border border-red-300 p-4 text-red-700">Daftar proker tidak dapat dimuat. Muat ulang halaman.</p> : rows.length === 0 ? <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--muted)]">Belum ada proker</div> : <>
      <div className="grid gap-3 md:hidden">{rows.map((row) => <article key={row.id} className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{row.nama_kegiatan}</strong><Badge status={row.status_efektif} /></div>{isAdmin && <p className="text-sm text-[var(--muted)]">{teamName(row.tim_kerja_id)}</p>}<p className="text-sm">{row.tahun_program} · {row.jenis[0].toLocaleUpperCase('id-ID') + row.jenis.slice(1)}</p><p className="text-sm">{dateLabel(row)}</p><p className="text-sm">Total anggaran: {formatRupiah(totalByProker.get(row.id) ?? '0.00')}</p><Link className="inline-flex min-h-10 items-center font-medium text-blue-700 dark:text-blue-300" href={`/proker/${row.id}`}>Lihat detail</Link></article>)}</div>
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="bg-[var(--surface)]"><tr>{['Tahun Program','Jenis','Nama Kegiatan',...(isAdmin ? ['Tim Kerja'] : []),'Tanggal','Total Anggaran','Status',''].map((heading, index) => <th key={`${heading}-${index}`} className="border-b border-[var(--border)] px-3 py-3 text-sm font-semibold">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="bg-[var(--page)]"><td className="border-b border-[var(--border)] px-3 py-3">{row.tahun_program}</td><td className="border-b border-[var(--border)] px-3 py-3">{row.jenis[0].toLocaleUpperCase('id-ID') + row.jenis.slice(1)}</td><td className="border-b border-[var(--border)] px-3 py-3">{row.nama_kegiatan}</td>{isAdmin && <td className="border-b border-[var(--border)] px-3 py-3">{teamName(row.tim_kerja_id)}</td>}<td className="border-b border-[var(--border)] px-3 py-3">{dateLabel(row)}</td><td className="border-b border-[var(--border)] px-3 py-3">{formatRupiah(totalByProker.get(row.id) ?? '0.00')}</td><td className="border-b border-[var(--border)] px-3 py-3"><Badge status={row.status_efektif} /></td><td className="border-b border-[var(--border)] px-3 py-3"><Link href={`/proker/${row.id}`} className="font-medium text-blue-700 dark:text-blue-300">Detail</Link></td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
