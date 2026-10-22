import test from 'node:test';
import assert from 'node:assert/strict';
import { jenisProkerTersedia, periodeAktif, tanggalJakarta, tahunJakarta, type InputPeriod } from './periode';

const period: InputPeriod = { tahun_program: 2026, tanggal_mulai: '2026-10-22', tanggal_selesai: '2026-11-10' };

test('hari mulai periode inklusif di zona Asia/Jakarta', () => {
  const start = new Date('2026-10-21T17:00:00.000Z');
  assert.equal(tanggalJakarta(start), '2026-10-22');
  assert.deepEqual(periodeAktif([period], start), period);
});

test('hari selesai periode inklusif sampai akhir hari Jakarta', () => {
  const end = new Date('2026-11-10T16:59:59.999Z');
  assert.deepEqual(periodeAktif([period], end), period);
  assert.equal(periodeAktif([period], new Date('2026-11-10T17:00:00.000Z')), null);
});

test('tanpa periode aktif hanya Aksidental dan memakai tahun Jakarta', () => {
  const afterMidnight = new Date('2026-12-31T17:30:00.000Z');
  assert.equal(tanggalJakarta(afterMidnight), '2027-01-01');
  assert.equal(tahunJakarta(afterMidnight), 2027);
  assert.deepEqual(jenisProkerTersedia([], afterMidnight), [{ jenis: 'aksidental', tahun_program: 2027 }]);
});

test('periode aktif menyediakan Rutin dan Visioner dengan tahun programnya', () => {
  assert.deepEqual(jenisProkerTersedia([period], new Date('2026-10-22T05:00:00.000Z')), [
    { jenis: 'rutin', tahun_program: 2026 },
    { jenis: 'visioner', tahun_program: 2026 },
  ]);
});
