import { redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PermissionForm } from './permission-form';

type Chair = { id: string; username: string; bidang_id: string; bidang: { id: string; nama: string; lembaga_id: string; lembaga: { nama: string } } };
type Division = { id: string; nama: string; lembaga_id: string; lembaga: { nama: string } };

export default async function IzinKetuaPage() {
  const profile = await currentProfile();
  if (!['admin', 'superadmin'].includes(profile.role)) redirect('/proker');
  const supabase = await createClient();
  const [{ data: chairs }, { data: divisions }, { data: grants }] = await Promise.all([
    supabase.from('profiles').select('id,username,bidang_id,bidang:bidang!profiles_bidang_id_fkey(id,nama,lembaga_id,lembaga(nama))').eq('role', 'ketua_bidang').order('username'),
    supabase.from('bidang').select('id,nama,lembaga_id,lembaga(nama)').order('nama'),
    supabase.from('ketua_bidang_izin').select('profile_id,bidang_id'),
  ]);
  const grantMap = new Map<string, string[]>();
  for (const row of grants ?? []) grantMap.set(row.profile_id, [...(grantMap.get(row.profile_id) ?? []), row.bidang_id]);
  return <section className="grid gap-5"><div><h1 className="text-2xl font-semibold">Izin Ketua Bidang</h1><p className="mt-1 text-sm text-[var(--muted)]">Bidang yang melekat pada akun selalu dapat dilihat. Atur bidang tambahan yang hanya dapat dilihat.</p></div>{(chairs as unknown as Chair[] ?? []).length ? (chairs as unknown as Chair[]).map((chair) => <PermissionForm key={chair.id} chair={chair} divisions={(divisions as unknown as Division[] ?? []).filter((item) => item.id !== chair.bidang_id)} granted={grantMap.get(chair.id) ?? []} />) : <p className="rounded-xl border border-[var(--border)] p-5">Belum ada akun ketua bidang.</p>}</section>;
}
