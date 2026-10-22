'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type CommitResult = void | { error?: string; message?: string };
type Toast = { id: number; message: string; undoable: boolean; error?: boolean };
type UndoContextValue = { scheduleUndo: (label: string, commit: () => Promise<CommitResult>, onUndo?: () => void) => void };
const UndoContext = createContext<UndoContextValue | null>(null);

export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const pending = useRef(new Map<number, { timer: ReturnType<typeof setTimeout>; onUndo?: () => void }>());
  const scheduleUndo = useCallback((label: string, commit: () => Promise<CommitResult>, onUndo?: () => void) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message: `${label} dihapus.`, undoable: true }]);
    const timer = setTimeout(async () => {
      pending.current.delete(id);
      setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, message: `Menghapus ${label.toLocaleLowerCase('id-ID')}…`, undoable: false } : toast));
      let result: CommitResult;
      try { result = await commit(); }
      catch (error) { result = { error: error instanceof Error ? error.message : 'Penghapusan gagal.' }; }
      setToasts((current) => current.map((toast) => toast.id === id
        ? result && result.error ? { ...toast, message: result.error, undoable: false, error: true } : { ...toast, message: result?.message ?? `${label} berhasil dihapus.`, undoable: false }
        : toast));
      setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
    }, 10_000);
    pending.current.set(id, { timer, onUndo });
  }, []);

  function undo(id: number) {
    const item = pending.current.get(id);
    if (!item) return;
    clearTimeout(item.timer);
    pending.current.delete(id);
    item.onUndo?.();
    setToasts((current) => current.map((toast) => toast.id === id ? { ...toast, message: 'Penghapusan dibatalkan.', undoable: false } : toast));
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3500);
  }

  return <UndoContext.Provider value={{ scheduleUndo }}>
    {children}
    <div aria-live="polite" aria-atomic="false" className="fixed bottom-3 left-3 right-3 z-[70] grid justify-items-start gap-2 sm:bottom-5 sm:left-5 sm:right-auto sm:max-w-md">
      {toasts.map((toast) => <div key={toast.id} className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm text-white shadow-xl ${toast.error ? 'bg-red-800' : 'bg-slate-900'}`}>
        <span>{toast.message}</span>{toast.undoable && <button type="button" onClick={() => undo(toast.id)} className="min-h-9 shrink-0 rounded-lg border border-white/50 px-3 font-semibold hover:bg-white/10">Urungkan</button>}
      </div>)}
    </div>
  </UndoContext.Provider>;
}

export function useUndoToast() {
  const value = useContext(UndoContext);
  if (!value) throw new Error('useUndoToast harus dipakai di dalam UndoToastProvider.');
  return value;
}
