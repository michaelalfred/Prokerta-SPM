import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRupiah, hitungTotalAnggaran, validasiItemAnggaran, type ItemAnggaran } from './anggaran';

test('total mengalikan harga satuan dengan jumlah item', () => {
  const items: ItemAnggaran[] = [
    { nama: 'Bahan', harga_satuan: '1250000', jumlah_item: 4 },
    { nama: 'Konsumsi', harga_satuan: '500.25', jumlah_item: 8 },
  ];
  assert.equal(hitungTotalAnggaran(items), '5004002.00');
});

test('total rupiah akurat untuk pecahan desimal dan format Indonesia', () => {
  assert.equal(formatRupiah(hitungTotalAnggaran([{ harga_satuan: '0.1', jumlah_item: 2 }, { harga_satuan: '0.2', jumlah_item: 3 }])), 'Rp 0,80');
});

test('menolak harga_satuan negatif, terlalu besar, atau lebih dari dua desimal', () => {
  for (const harga_satuan of ['-1', '10000000000000', '1.234', '1e3', '']) {
    assert.throws(() => hitungTotalAnggaran([{ harga_satuan, jumlah_item: 1 }]), /Harga satuan/);
  }
});

test('menerima jumlah item dari input HTML yang dikirim sebagai teks angka', () => {
  assert.deepEqual(validasiItemAnggaran([{ nama: 'Konsumsi', jumlah_item: '12', harga_satuan: '50000' }]), [
    { nama: 'Konsumsi', jumlah_item: 12, harga_satuan: '50000' },
  ]);
});

test('menolak jumlah item teks yang kosong, pecahan, nol, atau bukan angka', () => {
  for (const jumlah_item of ['', '1.5', '0', 'abc', '2147483648']) {
    assert.equal(validasiItemAnggaran([{ nama: 'Bahan', jumlah_item, harga_satuan: '10' }]), null);
  }
});
