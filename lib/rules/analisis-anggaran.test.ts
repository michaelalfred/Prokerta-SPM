import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSelisihRupiah, sortBudgetRows, summarizeBudget, type BudgetAnalysisRow } from './analisis-anggaran';

const base: BudgetAnalysisRow = {
  lembaga_id: 'l', lembaga: 'Lembaga', bidang_id: 'b', bidang: 'Bidang', tim_kerja_id: 't', tim_kerja: 'Tim',
  proker_id: 'p', nama_kegiatan: 'Kegiatan', evaluasi_id: 'e', anggaran_rencana: '100.00', anggaran_realisasi: '120.00',
};

test('ringkasan menjumlahkan rencana dan realisasi secara tepat sampai dua desimal', () => {
  const rows = [base, { ...base, proker_id: 'p2', nama_kegiatan: 'Kegiatan 2', anggaran_rencana: '50.25', anggaran_realisasi: '25.10' }];
  assert.deepEqual(summarizeBudget(rows), { rencana: '150.25', realisasi: '145.10', selisih: '-5.15', serapan: 96.57 });
  assert.equal(formatSelisihRupiah('-0.50'), '−Rp 0,50');
});

test('rencana nol menampilkan serapan kosong', () => {
  assert.equal(summarizeBudget([{ ...base, anggaran_rencana: '0.00', anggaran_realisasi: '20.00' }]).serapan, null);
});

test('daftar proker dapat diurutkan menurut selisih dan serapan dengan nilai tanpa rencana di belakang', () => {
  const rows = [
    { ...base, proker_id: 'a', nama_kegiatan: 'A', anggaran_rencana: '100', anggaran_realisasi: '120' },
    { ...base, proker_id: 'b', nama_kegiatan: 'B', anggaran_rencana: '100', anggaran_realisasi: '50' },
    { ...base, proker_id: 'c', nama_kegiatan: 'C', anggaran_rencana: '0', anggaran_realisasi: '20' },
  ];
  assert.deepEqual(sortBudgetRows(rows, 'selisih-desc').map((row) => row.proker_id), ['a', 'c', 'b']);
  assert.deepEqual(sortBudgetRows(rows, 'serapan-desc').map((row) => row.proker_id), ['a', 'b', 'c']);
});
