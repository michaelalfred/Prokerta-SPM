import { AppHeader } from '@/components/app-header';

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><AppHeader /><main className="mx-auto min-h-[calc(100vh-6rem)] w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main></>;
}
