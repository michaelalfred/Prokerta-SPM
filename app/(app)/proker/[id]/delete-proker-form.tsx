'use client';

import { hapusProker } from './actions';

export function DeleteProkerForm({ id }: { id: string }) {
  const action = hapusProker.bind(null, id);
  return <form action={action} onSubmit={(event) => { if (!window.confirm('Hapus proker ini beserta rincian biayanya?')) event.preventDefault(); }}><button className="min-h-10 rounded-lg border border-red-300 px-4 text-red-700">Hapus</button></form>;
}
