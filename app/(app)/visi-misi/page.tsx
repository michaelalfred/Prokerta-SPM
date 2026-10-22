import { redirect } from 'next/navigation';
import { VisiMisiEditor } from './editor';
import { currentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type MissionRow = { id: string; nomor: number; teks: string; outcome: string; milestone: { id: string; nomor: number; teks: string }[] };

export default async function VisiMisiPage() {
  const profile = await currentProfile();
  if (profile.role !== 'superadmin') redirect('/proker');
  const supabase = await createClient();
  const [{ data: vision }, { data: missions }] = await Promise.all([
    supabase.from('visi_misi').select('visi').eq('singleton', true).maybeSingle(),
    supabase.from('misi').select('id,nomor,teks,outcome,milestone(id,nomor,teks)').order('nomor'),
  ]);
  const missionRows = (missions ?? []) as unknown as MissionRow[];
  const normalized = missionRows.map((mission) => ({ ...mission, milestones: [...(mission.milestone ?? [])].sort((a, b) => a.nomor - b.nomor) }));
  return <><h1 className="mb-5 text-2xl font-semibold">Visi-Misi</h1><VisiMisiEditor visi={vision?.visi ?? ''} missions={normalized} /></>;
}
