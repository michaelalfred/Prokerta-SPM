import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { updatePassword } from './actions';

export default async function GantiPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <main className="mx-auto max-w-md p-6"><h1 className="mb-4 text-xl font-semibold">Ganti Password</h1><form action={updatePassword} className="grid gap-4"><label className="grid gap-1">Password baru<input type="password" name="password" minLength={6} required className="rounded border p-2" /></label><label className="grid gap-1">Konfirmasi password<input type="password" name="confirm" minLength={6} required className="rounded border p-2" /></label><button className="rounded bg-blue-700 p-2 text-white">Simpan</button></form></main>;
}
