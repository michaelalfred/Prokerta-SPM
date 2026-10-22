import assert from 'node:assert/strict';
import test from 'node:test';
import { bolehEditProker, bolehHapusProker, bolehIsiEvaluasi, bolehUbahStatus, statusEfektif, statusSetelahDiedit, type PeranProker, type StatusProker } from './proker';

const roles: PeranProker[] = ['user', 'admin', 'superadmin'];
const statuses: StatusProker[] = ['menunggu', 'ditinjau', 'disetujui', 'ditolak', 'direvisi'];

test('status menunggu menjadi ditinjau hanya setelah tanggal selesai periode berlalu', () => {
  assert.equal(statusEfektif('menunggu', '2026-10-21', '2026-10-22'), 'ditinjau');
  assert.equal(statusEfektif('menunggu', '2026-10-22', '2026-10-22'), 'menunggu');
  assert.equal(statusEfektif('menunggu', null, '2026-10-22'), 'menunggu');
  assert.equal(statusEfektif('disetujui', '2026-10-01', '2026-10-22'), 'disetujui');
});

test('matriks edit dan hapus untuk setiap status, peran, dan kepemilikan', () => {
  for (const role of roles) for (const status of statuses) for (const own of [false, true]) {
    const expectedEdit = status === 'menunggu' ? own : role !== 'user' && ['ditinjau', 'ditolak', 'direvisi'].includes(status);
    const expectedDelete = own && status === 'menunggu';
    assert.equal(bolehEditProker(role, status, own), expectedEdit, `edit: ${role}/${status}/pemilik=${own}`);
    assert.equal(bolehHapusProker(role, status, own), expectedDelete, `hapus: ${role}/${status}/pemilik=${own}`);
  }
});

test('matriks perubahan status dan penyelesaian revisi', () => {
  for (const role of roles) for (const status of statuses) {
    assert.equal(bolehUbahStatus(role, status), role !== 'user' && ['ditinjau', 'ditolak', 'direvisi'].includes(status));
  }
  assert.equal(statusSetelahDiedit('admin', 'ditinjau', false), 'direvisi');
  assert.equal(statusSetelahDiedit('superadmin', 'ditolak', false), 'direvisi');
  assert.equal(statusSetelahDiedit('admin', 'direvisi', false), 'direvisi');
  assert.equal(statusSetelahDiedit('user', 'menunggu', true), 'menunggu');
  assert.equal(statusSetelahDiedit('user', 'disetujui', true), null);
});

test('evaluasi hanya untuk proker disetujui milik tim tanpa evaluasi', () => {
  assert.equal(bolehIsiEvaluasi('disetujui', true, false), true);
  assert.equal(bolehIsiEvaluasi('disetujui', false, false), false);
  assert.equal(bolehIsiEvaluasi('disetujui', true, true), false);
  for (const status of statuses.filter((value) => value !== 'disetujui')) assert.equal(bolehIsiEvaluasi(status, true, false), false);
});
