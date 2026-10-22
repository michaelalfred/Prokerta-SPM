import { login } from './actions';
import Image from 'next/image';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6"><div className="flex flex-col items-center gap-3"><Image src="/logo.png" alt="Logo Paroki Purworejo" width={96} height={96} priority unoptimized className="h-24 w-24 object-contain" /><h1 className="text-2xl font-semibold">Prokerta SPM</h1></div>{params.error && <p role="alert" className="text-red-700">Username atau password salah</p>}<form action={login} className="grid gap-4"><label className="grid gap-1">Username<input name="username" required autoComplete="username" /></label><label className="grid gap-1">Password<input name="password" type="password" required autoComplete="current-password" /></label><button className="min-h-10 rounded-lg bg-blue-700 p-2 text-white">Masuk</button></form></main>;
}
