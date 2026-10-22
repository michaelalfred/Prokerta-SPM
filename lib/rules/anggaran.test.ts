import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRupiah, hitungTotalAnggaran, validasiItemAnggaran, type ItemAnggaran } from './anggaran';

test('total menjumlah nominal tiap item tanpa mengalikan jumlah item', () => {
  const items: ItemAnggaran[] = [
    { nama: 'Bahan', nominal: '1250000', jumlah_item: 4 },
    { nama: 'Konsumsi', nominal: '500.25', jumlah_item: 8 },
  ];
  assert.equal(hitungTotalAnggaran(items), '1250500.25');
});

test('total rupiah akurat untuk pecahan desimal dan format Indonesia', () => {
  assert.equal(formatRupiah(hitungTotalAnggaran([{ nominal: '0.1' }, { nominal: '0.2' }])), 'Rp 0,30');
});

test('menolak nominal negatif, terlalu besar, atau lebih dari dua desimal', () => {
  for (const nominal of ['-1', '10000000000000', '1.234', '1e3', '']) {
    assert.throws(() => hitungTotalAnggaran([{ nominal }]), /Nominal/);
  }
});

test('menerima jumlah item dari input HTML yang dikirim sebagai teks angka', () => {
  assert.deepEqual(validasiItemAnggaran([{ nama: 'Konsumsi', jumlah_item: '12', nominal: '50000' }]), [
    { nama: 'Konsumsi', jumlah_item: 12, nominal: '50000' },
  ]);
});

test('menolak jumlah item teks yang kosong, pecahan, nol, atau bukan angka', () => {
  for (const jumlah_item of ['', '1.5', '0', 'abc', '2147483648']) {
    assert.equal(validasiItemAnggaran([{ nama: 'Bahan', jumlah_item, nominal: '10' }]), null);
  }
});
