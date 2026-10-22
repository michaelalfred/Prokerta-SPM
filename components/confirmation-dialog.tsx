'use client';

export function ConfirmationDialog({ open, title, message, confirmLabel = 'Ya, lanjutkan', danger = false, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
      <h2 id="confirmation-title" className="text-lg font-semibold">{title}</h2>
      <p id="confirmation-message" className="mt-2 text-sm text-[var(--muted)]">{message}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="min-h-10 rounded-lg border border-[var(--border)] px-4">Batal</button><button type="button" autoFocus onClick={onConfirm} className={`min-h-10 rounded-lg px-4 text-white ${danger ? 'bg-red-700' : 'bg-blue-700'}`}>{confirmLabel}</button></div>
    </section>
  </div>;
}
