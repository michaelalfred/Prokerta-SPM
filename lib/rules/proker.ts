import { tanggalJakarta } from './periode';

export type StatusProker = 'menunggu' | 'ditinjau' | 'disetujui' | 'ditolak' | 'direvisi';
export type PeranProker = 'user' | 'admin' | 'superadmin' | 'ketua_bidang';
export type StatusManual = Exclude<StatusProker, 'menunggu'>;

export function statusEfektif(status: StatusProker, tanggalSelesaiPeriode: string | null, hariIni = tanggalJakarta()): StatusProker {
  return status === 'menunggu' && tanggalSelesaiPeriode !== null && tanggalSelesaiPeriode < hariIni ? 'ditinjau' : status;
}

export function bolehEditProker(peran: PeranProker, status: StatusProker, pemilik: boolean): boolean {
  if (peran === 'ketua_bidang') return pemilik && ['menunggu', 'ditinjau', 'ditolak', 'direvisi'].includes(status);
  if (status === 'menunggu') return pemilik;
  return peran !== 'user' && ['ditinjau', 'ditolak', 'direvisi'].includes(status);
}

export function bolehHapusProker(peran: PeranProker, status: StatusProker, pemilik: boolean): boolean {
  return peran !== 'ketua_bidang' && pemilik && status === 'menunggu';
}

export function bolehUbahStatus(peran: PeranProker, status: StatusProker): boolean {
  return (peran === 'admin' || peran === 'superadmin') && ['ditinjau', 'ditolak', 'direvisi'].includes(status);
}

export function bolehIsiEvaluasi(status: StatusProker, pemilik: boolean, sudahAdaEvaluasi: boolean): boolean {
  return pemilik && status === 'disetujui' && !sudahAdaEvaluasi;
}

export function statusSetelahDiedit(peran: PeranProker, status: StatusProker, pemilik: boolean): StatusProker | null {
  if (!bolehEditProker(peran, status, pemilik)) return null;
  return status === 'menunggu' || (peran === 'ketua_bidang' && status === 'direvisi') ? status : 'direvisi';
}
