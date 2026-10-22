'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { formatRupiah, hitungTotalAnggaran } from '@/lib/rules/anggaran';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { siapkanUpload, simpanEvaluasi } from './actions';

type UploadFile = { path: string; token: string; nama_file: string; ukuran_bytes: number; mime_type: string };
type Budget = { nama: string; jumlah_item: string; harga_satuan: string };
const initialBudget = [{ nama: '', jumlah_item: '1', harga_satuan: '0' }];

export function EvaluationForm({ prokerId, tanggalMulai, tanggalSelesai, rentang }: { prokerId: string; tanggalMulai: string; tanggalSelesai: string; rentang: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [budgets, setBudgets] = useState<Budget[]>(initialBudget);
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [evaluationId, setEvaluationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);
  const [range, setRange] = useState(rentang);
  const [dates, setDates] = useState({ mulai: tanggalMulai, selesai: tanggalSelesai });
  let totalRealisasi = '0.00';
  try { totalRealisasi = hitungTotalAnggaran(budgets.map((item) => ({ harga_satuan: item.harga_satuan || '0', jumlah_item: Number(item.jumlah_item) || 1 }))); } catch { /* input harga satuan parsial akan ditolak saat dikirim */ }

  function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingForm(new FormData(event.currentTarget));
    setConfirmOpen(true);
  }

  async function submit(form: FormData) {
    setBusy(true); setError('');
    const storage = createClient().storage.from('bukti-evaluasi');
    const saved: string[] = [];
    try {
      let currentId = evaluationId;
      let uploaded = uploads;
      if (!currentId) {
        const picked = Array.from(formRef.current?.querySelector<HTMLInputElement>('input[type=file]')?.files ?? []);
        if (picked.length > 10 || picked.some((file) => file.size > 10485760 || !['image/jpeg','image/png','application/pdf'].includes(file.type))) throw new Error('Pilih maksimal 10 file JPG, PNG, atau PDF. Ukuran setiap file maksimal 10 MB.');
        const prepared = await siapkanUpload(prokerId, picked.map((file) => ({ nama_file: file.name, mime_type: file.type, ukuran_bytes: file.size })));
        if ('error' in prepared) throw new Error(prepared.error);
        currentId = prepared.evaluationId;
        uploaded = prepared.files;
        for (let i = 0; i < picked.length; i++) {
          const { error: uploadError } = await storage.uploadToSignedUrl(uploaded[i].path, uploaded[i].token, picked[i], { contentType: picked[i].type, upsert: false });
          if (uploadError) throw new Error('Unggahan bukti gagal. Periksa koneksi dan coba lagi.');
          saved.push(uploaded[i].path);
        }
        setUploads(uploaded); setEvaluationId(currentId);
      }
      form.set('anggaran', JSON.stringify(budgets));
      form.set('files', JSON.stringify(uploaded.map((file) => ({ storage_path: file.path, nama_file: file.nama_file }))));
      form.set('evaluation_id', currentId);
      await simpanEvaluasi(prokerId, form);
      router.refresh();
    } catch (caught) {
      if (saved.length) await storage.remove(saved);
      setError(caught instanceof Error ? caught.message : 'Evaluasi tidak dapat disimpan.');
      setUploads([]); setEvaluationId('');
    } finally { setBusy(false); }
  }

  return <><form ref={formRef} onSubmit={requestConfirmation} className="grid gap-5">
    <label className="grid gap-1">Hasil Kegiatan<textarea name="hasil_kegiatan" required rows={4} /></label>
    <label className="grid gap-1">Capaian (%)<input name="capaian_persen" type="number" min="0" max="100" step="1" required /></label>
    <fieldset className="grid gap-3"><legend className="font-medium">Waktu Pelaksanaan</legend><label className="flex items-center gap-2"><input type="checkbox" name="rentang_waktu" checked={range} onChange={(event) => setRange(event.target.checked)} />Berlangsung lebih dari satu hari / dalam rentang waktu</label><label className="grid gap-1">Tanggal Mulai<input required type="date" name="tanggal_mulai" value={dates.mulai} onChange={(e) => setDates({ ...dates, mulai: e.target.value })} /></label>{range && <label className="grid gap-1">Tanggal Selesai<input required type="date" name="tanggal_selesai" min={dates.mulai} value={dates.selesai} onChange={(e) => setDates({ ...dates, selesai: e.target.value })} /></label>}</fieldset>
    <fieldset className="grid gap-3"><legend className="font-medium">Realisasi Anggaran</legend>{budgets.map((budget, index) => <div key={index} className="grid gap-2 sm:grid-cols-3"><label className="grid gap-1">Nama<input required value={budget.nama} onChange={(e) => setBudgets(budgets.map((row,i) => i===index ? {...row,nama:e.target.value} : row))} /></label><label className="grid gap-1">Jumlah item<input required type="number" min="1" step="1" value={budget.jumlah_item} onChange={(e) => setBudgets(budgets.map((row,i) => i===index ? {...row,jumlah_item:e.target.value} : row))} /></label><label className="grid gap-1">Harga satuan (Rp)<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={budget.harga_satuan} onChange={(e) => setBudgets(budgets.map((row,i) => i===index ? {...row,harga_satuan:e.target.value} : row))} /></label>{budgets.length>1 && <button type="button" className="text-left text-red-700" onClick={() => setBudgets(budgets.filter((_,i) => i!==index))}>Hapus item</button>}</div>)}<button type="button" className="min-h-10 justify-self-start rounded-lg bg-[#2563EB] px-3 text-white dark:bg-[#3B82F6]" onClick={() => setBudgets([...budgets,{nama:'',jumlah_item:'1',harga_satuan:'0'}])}>Tambah item</button><p className="text-right font-semibold">Total Realisasi: {formatRupiah(totalRealisasi)}</p></fieldset>
    <label className="grid gap-1">Foto / Bukti (opsional; maksimal 10 file, 10 MB per file)<input type="file" multiple accept="image/jpeg,image/png,application/pdf" /></label>
    <label className="grid gap-1">Keterangan Tambahan (opsional)<textarea name="keterangan_tambahan" rows={3} /></label>
    {uploads.length>0 && <p>{uploads.length} file siap dikirim.</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
    <button disabled={busy} className="min-h-11 rounded-lg bg-blue-700 px-4 text-white disabled:opacity-60">{busy ? 'Menyimpan…' : 'Kirim Evaluasi'}</button>
  </form><ConfirmationDialog open={confirmOpen} title="Kirim evaluasi?" message="Evaluasi tidak dapat diedit setelah dikirim. Pastikan seluruh informasi dan lampiran sudah benar." confirmLabel="Kirim evaluasi" onCancel={() => { setConfirmOpen(false); setPendingForm(null); }} onConfirm={() => { const form = pendingForm; setConfirmOpen(false); setPendingForm(null); if (form) void submit(form); }} /></>;
}
