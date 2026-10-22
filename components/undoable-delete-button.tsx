'use client';

import { useState, type ReactNode } from 'react';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { useUndoToast } from '@/components/undo-toast-provider';

export function UndoableDeleteButton({ label, title, message, onDelete, onUndo, onScheduled, className, disabled = false, children }: {
  label: string;
  title: string;
  message: string;
  onDelete: () => Promise<void | { error?: string; message?: string }>;
  onUndo?: () => void;
  onScheduled?: () => void;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { scheduleUndo } = useUndoToast();
  return <>
    <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={className}>{children}</button>
    <ConfirmationDialog open={open} title={title} message={message} confirmLabel="Hapus" danger onCancel={() => setOpen(false)} onConfirm={() => {
      scheduleUndo(label, onDelete, onUndo);
      onScheduled?.();
      setOpen(false);
    }} />
  </>;
}
