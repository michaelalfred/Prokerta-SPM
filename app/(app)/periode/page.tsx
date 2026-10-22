import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { tanggalJakarta, periodeAktif, type InputPeriod } from '@/lib/rules/periode';
import { PeriodForm } from './period-form';

export default async function PeriodePage() {
  const profile = await currentProfile();
  if (!['admin', 'superadmin'].includes(profile.role)) redirect('/proker');
  const supabase = await createClient();
  const { data, error } = await supabase.from('periode_input').select('id,tahun_program,tanggal_mulai,tanggal_selesai').order('tahun_program', { ascending: false });
  const periods = (data ?? []) as (InputPeriod & { id: string })[];
  const active = periodeAktif(periods, new Date());
  const today = tanggalJakarta();
  return <><h1 className="mb-5 text-2xl font-semibold">Periode Input</h1><p className="mb-5 text-sm text-[var(--muted)]">Tanggal hari ini (Asia/Jakarta): {today}. {active ? `Periode ${active.tahun_program} sedang aktif.` : 'Tidak ada periode yang aktif.'}</p>{error && <p role="alert" className="mb-4 text-red-700">Periode tidak dapat dimuat: {error.message}</p>}<PeriodForm periods={periods} /></>;
}
