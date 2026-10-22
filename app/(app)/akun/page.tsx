import { redirect } from 'next/navigation';
import { AccountManager } from './account-manager';
import { currentProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type ProfileRow = { id: string; username: string; role: string; nama_koordinator: string | null; tim_kerja: { id: string; nama: string; bidang_id: string; bidang: { nama: string; lembaga_id: string; lembaga: { nama: string } } } };

export default async function AkunPage() {
  const profile = await currentProfile();
  if (profile.role !== 'superadmin') redirect('/proker');
  const supabase = await createClient();
  const [{ data: profiles }, { data: institutions }, { data: divisions }] = await Promise.all([
    supabase.from('profiles').select('id,username,role,nama_koordinator,tim_kerja(id,nama,bidang_id,bidang(nama,lembaga_id,lembaga(nama)))').order('username'),
    supabase.from('lembaga').select('id,nama').order('urutan').order('nama'),
    supabase.from('bidang').select('id,nama,lembaga_id').order('urutan').order('nama'),
  ]);
  const rows = (profiles ?? []) as unknown as ProfileRow[];
  const accounts = rows.map((row) => ({ id: row.id, username: row.username, role: row.role, nama_koordinator: row.nama_koordinator, tim: { id: row.tim_kerja.id, nama: row.tim_kerja.nama, bidang_id: row.tim_kerja.bidang_id, lembaga_id: row.tim_kerja.bidang.lembaga_id, bidang: row.tim_kerja.bidang.nama, lembaga: row.tim_kerja.bidang.lembaga.nama } }));
  return <><h1 className="mb-5 text-2xl font-semibold">Manajemen Akun</h1><AccountManager accounts={accounts} institutions={institutions ?? []} divisions={divisions ?? []} /></>;
}
