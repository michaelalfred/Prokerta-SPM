'use client';

import { useRef, useState } from 'react';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { ubahStatusProker } from './actions';
import type { StatusProker } from '@/lib/rules/proker';

const options: StatusProker[] = ['ditinjau', 'disetujui', 'ditolak', 'direvisi'];
const label = (status: string) => status[0].toLocaleUpperCase('id-ID') + status.slice(1);

export function StatusProkerForm({ id, currentStatus, completeRevision = false }: { id: string; currentStatus: StatusProker; completeRevision?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const approvedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const action = ubahStatusProker.bind(null, id);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    const status = String(new FormData(event.currentTarget).get('status') ?? '');
    if (status !== 'disetujui') return;
    if (approvedRef.current) { approvedRef.current = false; return; }
    event.preventDefault();
    setOpen(true);
  }
  return <>
    <form ref={formRef} action={action} onSubmit={submit} className="flex flex-wrap items-center gap-2">
      {completeRevision ? <input type="hidden" name="status" value="disetujui" /> : <><label className="sr-only" htmlFor="status-proker">Status baru</label><select id="status-proker" name="status" defaultValue={currentStatus}>{options.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></>}
      <button className={`min-h-10 rounded-lg px-4 text-white ${completeRevision ? 'bg-green-700' : 'bg-blue-700'}`}>{completeRevision ? 'Selesaikan revisi' : 'Ubah Status'}</button>
    </form>
    <ConfirmationDialog open={open} title="Setujui proker?" message="Setelah disetujui, proker terkunci untuk diedit dan tim pemilik dapat mengisi evaluasi." confirmLabel="Setujui proker" onCancel={() => setOpen(false)} onConfirm={() => { approvedRef.current = true; setOpen(false); formRef.current?.requestSubmit(); }} />
  </>;
}
