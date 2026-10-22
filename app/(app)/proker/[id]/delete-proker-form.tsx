'use client';

import { useRouter } from 'next/navigation';
import { UndoableDeleteButton } from '@/components/undoable-delete-button';
import { hapusProker } from './actions';

export function DeleteProkerForm({ id }: { id: string }) {
  const router = useRouter();
  return <UndoableDeleteButton label="Proker" title="Hapus proker?" message="Proker, rincian biaya, evaluasi, dan bukti terkait akan dihapus setelah 10 detik. Anda dapat membatalkan penghapusan melalui notifikasi." className="min-h-10 rounded-lg border border-red-300 px-4 text-red-700" onDelete={async () => {
    const result = await hapusProker(id);
    if (!result.error) router.push('/proker');
    return result;
  }}>Hapus</UndoableDeleteButton>;
}
