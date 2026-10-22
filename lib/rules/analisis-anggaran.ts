import { formatRupiah } from './anggaran';

export type BudgetAnalysisRow = {
  lembaga_id: string;
  lembaga: string;
  bidang_id: string;
  bidang: string;
  tim_kerja_id: string;
  tim_kerja: string;
  proker_id: string;
  nama_kegiatan: string;
  evaluasi_id: string | null;
  anggaran_rencana: string;
  anggaran_realisasi: string | null;
};

export type BudgetSummary = {
  rencana: string;
  realisasi: string;
  selisih: string;
  serapan: number | null;
};

export type BudgetSort = 'selisih-desc' | 'selisih-asc' | 'serapan-desc' | 'serapan-asc';

function toCents(value: string | null): bigint {
  const text = value ?? '0';
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Nilai anggaran tidak valid.');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const cents = BigInt(whole) * BigInt(100) + BigInt((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}

function fromCents(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  return `${negative ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
}

export function summarizeBudget(rows: BudgetAnalysisRow[]): BudgetSummary {
  const rencana = rows.reduce((sum, row) => sum + toCents(row.anggaran_rencana), BigInt(0));
  const realisasi = rows.reduce((sum, row) => sum + toCents(row.anggaran_realisasi), BigInt(0));
  const selisih = realisasi - rencana;
  const serapan = rencana === BigInt(0) ? null : Number((realisasi * BigInt(10000)) / rencana) / 100;
  return { rencana: fromCents(rencana), realisasi: fromCents(realisasi), selisih: fromCents(selisih), serapan };
}

export function formatSelisihRupiah(value: string): string {
  return value.startsWith('-') ? `−${formatRupiah(value.slice(1))}` : formatRupiah(value);
}

export function sortBudgetRows(rows: BudgetAnalysisRow[], sort: BudgetSort): BudgetAnalysisRow[] {
  return [...rows].sort((left, right) => {
    let order = 0;
    if (sort.startsWith('selisih')) {
      const a = summarizeBudget([left]).selisih;
      const b = summarizeBudget([right]).selisih;
      const ac = toCents(a);
      const bc = toCents(b);
      order = ac < bc ? -1 : ac > bc ? 1 : 0;
      if (sort === 'selisih-desc') order *= -1;
    } else {
      const a = summarizeBudget([left]).serapan;
      const b = summarizeBudget([right]).serapan;
      if (a === null && b !== null) return 1;
      if (b === null && a !== null) return -1;
      order = (a ?? 0) - (b ?? 0);
      if (sort === 'serapan-desc') order *= -1;
    }
    return order || left.nama_kegiatan.localeCompare(right.nama_kegiatan, 'id');
  });
}
