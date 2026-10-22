'use client';

import { useActionState, useState } from 'react';
import { formatRupiah, hitungTotalAnggaran } from '@/lib/rules/anggaran';
import type { JenisProker } from '@/lib/rules/periode';
import { simpanProker, type HasilSimpanProker } from './actions';

type MilestoneForm = { id: string; nomor: number; teks: string };
export type MisiForm = {
  id: string;
  nomor: number;
  teks: string;
  outcome: string;
  milestone: MilestoneForm[];
};

type Props = {
  active: boolean;
  year: number | null;
  visi: string;
  misi: MisiForm[];
  visionerSiap: boolean;
  organisasi: { lembaga: string; bidang: string; tim: string };
};
type BarisAnggaran = {
  id: number;
  nama: string;
  jumlah_item: string;
  harga_satuan: string;
};
const initialState: HasilSimpanProker = {};

export function FormProker({
  active,
  year,
  visi,
  misi,
  visionerSiap,
  organisasi,
}: Props) {
  const [hasil, formAction, pending] = useActionState(
    simpanProker,
    initialState,
  );
  const [jenis, setJenis] = useState<JenisProker>(
    active ? 'rutin' : 'aksidental',
  );
  const [rentangWaktu, setRentangWaktu] = useState(false);
  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [misiId, setMisiId] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [nomorBaris, setNomorBaris] = useState(1);
  const [anggaran, setAnggaran] = useState<BarisAnggaran[]>([
    { id: 0, nama: '', jumlah_item: '1', harga_satuan: '' },
  ]);
  const misiDipilih = misi.find((item) => item.id === misiId);
  let totalTampilan = '—';
  try {
    totalTampilan = formatRupiah(
      hitungTotalAnggaran(anggaran.map((item) => ({ harga_satuan: item.harga_satuan, jumlah_item: Number(item.jumlah_item) || 1 }))),
    );
  } catch {
    totalTampilan = 'Isi harga satuan yang valid';
  }

  function ubahAnggaran(
    id: number,
    field: keyof Omit<BarisAnggaran, 'id'>,
    value: string,
  ) {
    setAnggaran((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function tambahAnggaran() {
    setAnggaran((rows) => [
      ...rows,
      { id: nomorBaris, nama: '', jumlah_item: '1', harga_satuan: '' },
    ]);
    setNomorBaris((value) => value + 1);
  }

  function hapusAnggaran(id: number) {
    setAnggaran((rows) =>
      rows.length > 1 ? rows.filter((row) => row.id !== id) : rows,
    );
  }

  function simpanTanggalMulai(value: string) {
    setTanggalMulai(value);
    if (!rentangWaktu) setTanggalSelesai(value);
  }

  return (
    <form action={formAction} className="grid min-w-0 gap-6">
      <fieldset
        disabled={pending || Boolean(hasil.success)}
        className="grid min-w-0 gap-6 disabled:opacity-75"
      >
        <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-3 sm:p-6">
          <h2 className="text-lg font-semibold sm:col-span-3">
            Identitas Pastoral
          </h2>
          <p>
            <span className="block text-sm text-[var(--muted)]">Lembaga</span>
            <strong>{organisasi.lembaga}</strong>
          </p>
          <p>
            <span className="block text-sm text-[var(--muted)]">Bidang</span>
            <strong>{organisasi.bidang}</strong>
          </p>
          <p>
            <span className="block text-sm text-[var(--muted)]">Tim Kerja</span>
            <strong>{organisasi.tim}</strong>
          </p>
        </section>
        <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Jenis Program Kerja</h2>
          <label className="grid gap-1 font-medium">
            Jenis
            <select
              name="jenis"
              value={jenis}
              onChange={(event) => setJenis(event.target.value as JenisProker)}
              required
            >
              {active ? (
                <>
                  <option value="rutin">Rutin</option>
                  <option value="visioner" disabled={!visionerSiap}>
                    Visioner
                    {visionerSiap ? '' : ' (data Visi-Misi belum tersedia)'}
                  </option>
                </>
              ) : (
                <option value="aksidental">Aksidental</option>
              )}
            </select>
          </label>
          <p className="text-sm text-[var(--muted)]">
            {active
              ? `Tahun program: ${year}.`
              : 'Tahun program menggunakan tahun berjalan (Asia/Jakarta). Proker Aksidental berstatus Ditinjau saat dibuat.'}
          </p>
          {active && !visionerSiap && (
            <p className="text-sm text-[var(--muted)]">
              Visioner belum dapat dipilih karena data Visi, Misi, Outcomes,
              atau Milestone belum lengkap.
            </p>
          )}
        </section>

        {jenis === 'visioner' && (
          <section className="grid min-w-0 gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
            <h2 className="text-lg font-semibold">Program Visioner</h2>
            <div className="grid min-w-0 gap-1">
              <span className="font-medium">Visi</span>
              <p className="break-words rounded-lg border border-[var(--border)] p-3">
                {visi || 'Visi belum tersedia.'}
              </p>
            </div>
            <label className="grid gap-1 font-medium">
              Misi
              <select
                name="misi_id"
                value={misiId}
                onChange={(event) => {
                  setMisiId(event.target.value);
                  setMilestoneId('');
                }}
                required
                className="w-full min-w-0 max-w-full"
              >
                <option value="">Pilih Misi</option>
                {misi.map((item) => (
                  <option key={item.id} value={item.id}>
                    Misi {item.nomor} — {item.teks}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid min-w-0 gap-1">
              <span className="font-medium">Outcomes</span>
              <p className="break-words rounded-lg border border-[var(--border)] p-3">
                {misiDipilih?.outcome ||
                  'Outcomes akan terisi otomatis setelah Misi dipilih.'}
              </p>
            </div>
            <label className="grid gap-1 font-medium">
              Milestone
              <select
                name="milestone_id"
                value={milestoneId}
                onChange={(event) => setMilestoneId(event.target.value)}
                required
                disabled={!misiDipilih}
                className="w-full min-w-0 max-w-full"
              >
                <option value="">
                  {misiDipilih
                    ? misiDipilih.milestone.length
                      ? 'Pilih Milestone'
                      : 'Belum ada Milestone untuk Misi ini'
                    : 'Pilih Misi terlebih dahulu'}
                </option>
                {misiDipilih?.milestone.map((item) => (
                  <option key={item.id} value={item.id}>
                    Milestone {item.nomor} — {item.teks}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}

        <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Substansi dan Target</h2>
          <label className="grid gap-1 font-medium">
            Sasaran Program
            <textarea name="sasaran_program" required rows={3} />
          </label>
          <label className="grid gap-1 font-medium">
            Indikator Keberhasilan
            <textarea name="indikator_keberhasilan" required rows={3} />
          </label>
          <label className="grid gap-1 font-medium">
            Target
            <textarea name="target" required rows={3} />
          </label>
          <label className="grid gap-1 font-medium">
            Rincian / Nama Kegiatan
            <textarea name="nama_kegiatan" required rows={3} />
          </label>
        </section>

        <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Waktu Pelaksanaan</h2>
          <label className="flex min-h-10 items-center gap-3">
            <input
              type="checkbox"
              name="rentang_waktu"
              checked={rentangWaktu}
              onChange={(event) => setRentangWaktu(event.target.checked)}
              className="h-5 w-5"
            />
            Berlangsung lebih dari satu hari / dalam rentang waktu
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-medium">
              {rentangWaktu ? 'Tanggal mulai' : 'Tanggal pelaksanaan'}
              <input
                type="date"
                name="tanggal_mulai"
                value={tanggalMulai}
                onChange={(event) => simpanTanggalMulai(event.target.value)}
                required
              />
            </label>
            {rentangWaktu && (
              <label className="grid gap-1 font-medium">
                Tanggal selesai
                <input
                  type="date"
                  name="tanggal_selesai"
                  value={tanggalSelesai}
                  min={tanggalMulai || undefined}
                  onChange={(event) => setTanggalSelesai(event.target.value)}
                  required
                />
              </label>
            )}
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Rincian Biaya</h2>
            <p className="text-sm text-[var(--muted)]">
              Total dihitung dari jumlah item dikalikan harga satuan.
            </p>
          </div>
          <input
            type="hidden"
            name="anggaran"
            value={JSON.stringify(
              anggaran.map(({ nama, jumlah_item, harga_satuan }) => ({
                nama,
                jumlah_item,
                harga_satuan,
              })),
            )}
          />
          <div className="grid gap-3">
            {anggaran.map((item, index) => (
              <fieldset
                key={item.id}
                className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[minmax(0,2fr)_minmax(7rem,1fr)_minmax(9rem,1fr)_auto] sm:items-end"
              >
                <legend className="px-1 font-medium">Item {index + 1}</legend>
                <label className="grid gap-1">
                  Nama item
                  <input
                    value={item.nama}
                    onChange={(event) =>
                      ubahAnggaran(item.id, 'nama', event.target.value)
                    }
                    required
                  />
                </label>
                <label className="grid gap-1">
                  Jumlah item
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.jumlah_item}
                    onChange={(event) =>
                      ubahAnggaran(item.id, 'jumlah_item', event.target.value)
                    }
                    required
                  />
                </label>
                <label className="grid gap-1">
                  Harga satuan (Rp)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.harga_satuan}
                    onChange={(event) =>
                      ubahAnggaran(item.id, 'harga_satuan', event.target.value)
                    }
                    required
                  />
                </label>
                <button
                  type="button"
                  onClick={() => hapusAnggaran(item.id)}
                  disabled={anggaran.length === 1}
                  className="min-h-10 rounded-lg border border-[var(--border)] px-3 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Hapus
                </button>
              </fieldset>
            ))}
          </div>
          <button
            type="button"
            onClick={tambahAnggaran}
            className="min-h-10 justify-self-start rounded-lg bg-[#2563EB] px-4 text-white dark:bg-[#3B82F6]"
          >
            Tambah item biaya
          </button>
          <p className="text-right text-lg font-semibold">
            Total Anggaran: {totalTampilan}
          </p>
        </section>

        <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Akuntabilitas</h2>
          <label className="grid gap-1 font-medium">
            Penanggung Jawab (PJ)
            <textarea name="penanggung_jawab" required rows={2} />
          </label>
        </section>
      </fieldset>

      {hasil.error && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 p-3 text-red-700"
        >
          {hasil.error}
        </p>
      )}
      {hasil.success && (
        <p role="status" className="rounded-lg border border-green-300 p-3">
          {hasil.success} Total anggaran yang dihitung ulang di server:{' '}
          <strong>{hasil.total ? formatRupiah(hasil.total) : '—'}</strong>
        </p>
      )}
      <button
        type="submit"
        disabled={pending || Boolean(hasil.success)}
        className="min-h-11 justify-self-start rounded-lg bg-blue-700 px-5 font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Menyimpan…' : hasil.success ? 'Tersimpan' : 'Simpan Proker'}
      </button>
    </form>
  );
}
