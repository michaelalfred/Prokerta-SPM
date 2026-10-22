import Image from 'next/image';
import Link from 'next/link';
import { currentProfile } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { logout } from '@/app/logout/actions';

const roleName = { user: 'Pengguna', admin: 'Admin', superadmin: 'Superadmin' };

export async function AppHeader() {
  const profile = await currentProfile();
  const links = [
    { label: 'Proker', href: '/proker', roles: ['user', 'admin', 'superadmin'] },
    { label: 'Evaluasi', href: '/evaluasi', roles: ['admin', 'superadmin'] },
    { label: 'Analisis', href: '/analisis', roles: ['admin', 'superadmin'] },
    { label: 'Periode Input', href: '/periode', roles: ['admin', 'superadmin'] },
    { label: 'Akun', href: '/akun', roles: ['superadmin'] },
    { label: 'Visi-Misi', href: '/visi-misi', roles: ['superadmin'] },
  ].filter((item) => item.roles.includes(profile.role));
  return <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
      <Link href="/proker" aria-label="Prokerta SPM" className="flex min-w-0 items-center gap-2">
        <Image src="/logo.png" alt="Logo Paroki Purworejo" width={40} height={40} priority unoptimized className="hidden h-10 w-10 object-contain sm:block" />
        <Image src="/logo.png" alt="Logo Paroki Purworejo" width={36} height={36} priority unoptimized className="h-9 w-9 object-contain sm:hidden" />
        <span className="truncate font-semibold">Prokerta SPM</span>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <details className="relative">
          <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-lg border border-[var(--border)] px-3 text-sm">Akun</summary>
          <div className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
            <p className="font-medium">{profile.tim_kerja.nama}</p><p className="text-sm text-[var(--muted)]">{profile.username} · {roleName[profile.role]}</p>
            <div className="mt-3 grid gap-1 border-t border-[var(--border)] pt-2"><Link className="rounded px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700" href="/ganti-password">Ganti Password</Link><form action={logout}><button className="min-h-10 w-full rounded px-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700">Keluar</button></form></div>
          </div>
        </details>
      </div>
    </div>
    <nav aria-label="Navigasi utama" className="mx-auto hidden max-w-7xl gap-1 px-6 pb-2 sm:flex">{links.map((item) => <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700">{item.label}</Link>)}</nav>
    <details className="mx-auto max-w-7xl px-4 pb-2 sm:hidden"><summary className="flex min-h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[var(--border)]" aria-label="Buka navigasi">☰</summary><nav className="grid gap-1 pt-2" aria-label="Navigasi utama">{links.map((item) => <Link key={item.href} href={item.href} className="min-h-10 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">{item.label}</Link>)}</nav></details>
  </header>;
}
