import { AppHeader } from '@/components/app-header';
import { UndoToastProvider } from '@/components/undo-toast-provider';

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return <UndoToastProvider><AppHeader /><main className="mx-auto min-h-[calc(100vh-6rem)] w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6">{children}</main></UndoToastProvider>;
}
