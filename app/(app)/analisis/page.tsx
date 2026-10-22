import { Suspense } from 'react';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AchievementSection, ComplianceSection, MissionSection, StatusSection } from './sections';

type Search = { tahun?: string; lembaga?: string };
type Period = { tahun_program: number; tanggal_mulai: string; tanggal_selesai: string };
export default async function AnalisisPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole(['admin','superadmin']);
  const supabase=await createClient(); const params=await searchParams;
  const [{data:periods},{data:prokerYears},{data:institutions}]=await Promise.all([
    supabase.from('periode_input').select('tahun_program,tanggal_mulai,tanggal_selesai'),
    supabase.from('proker_v').select('tahun_program'),
    supabase.from('lembaga').select('id,nama').order('urutan').order('nama'),
  ]);
  const periodRows=(periods??[]) as Period[];
  const years=[...new Set([...periodRows.map(p=>p.tahun_program),...(prokerYears??[]).map(p=>p.tahun_program)])].sort((a,b)=>b-a);
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta'});
  const active=periodRows.find(p=>p.tanggal_mulai<=today&&today<=p.tanggal_selesai);
  const year=/^\d{4}$/.test(params.tahun??'')&&years.includes(Number(params.tahun))?Number(params.tahun):active?.tahun_program??years[0]??null;
  const institutionId=(institutions??[]).some(l=>l.id===params.lembaga)?params.lembaga!:null;
  const hasYear=year!==null;
  const hasProker=hasYear&&(prokerYears??[]).some(p=>p.tahun_program===year);
  return <section className="grid min-w-0 gap-5" aria-labelledby="analisis-title">
    <div><h1 id="analisis-title" className="text-2xl font-semibold">Analisis</h1><p className="mt-1 text-sm text-[var(--muted)]">Ringkasan proker dan evaluasi menurut tahun program.</p></div>
    <form className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 sm:items-end" aria-label="Filter analisis">
      <label className="grid gap-1 text-sm">Tahun Program<select name="tahun" required defaultValue={year??''}><option value="" disabled>Pilih tahun</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Lembaga<select name="lembaga" defaultValue={institutionId??''}><option value="">Semua lembaga</option>{(institutions??[]).map(l=><option key={l.id} value={l.id}>{l.nama}</option>)}</select></label>
      <button className="min-h-10 rounded-lg bg-blue-700 px-4 text-white sm:col-span-2 sm:justify-self-start">Terapkan filter</button>
    </form>
    {!hasProker ? <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">Belum ada data untuk tahun program ini.</p> : <>
      <Suspense fallback={<Loading title="Ringkasan Status"/>}><StatusSection year={year} institutionId={institutionId}/></Suspense>
      <Suspense fallback={<Loading title="Kepatuhan Evaluasi"/>}><ComplianceSection year={year} institutionId={institutionId}/></Suspense>
      <Suspense fallback={<Loading title="Capaian per Bidang"/>}><AchievementSection year={year} institutionId={institutionId}/></Suspense>
      <Suspense fallback={<Loading title="Peta Misi-Milestone"/>}><MissionSection year={year} institutionId={institutionId}/></Suspense>
    </>}
  </section>;
}
function Loading({title}:{title:string}) { return <section className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--muted)]" aria-label={`Memuat ${title}`}>{title} sedang dimuat…</section>; }
