export type InputPeriod = { tahun_program: number; tanggal_mulai: string; tanggal_selesai: string };
export type JenisProker = 'rutin' | 'visioner' | 'aksidental';

export function tanggalJakarta(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function tahunJakarta(now = new Date()): number {
  return Number(tanggalJakarta(now).slice(0, 4));
}

export function periodeAktif(periods: InputPeriod[], now = new Date()): InputPeriod | null {
  const today = tanggalJakarta(now);
  return periods.find((period) => period.tanggal_mulai <= today && today <= period.tanggal_selesai) ?? null;
}

export function jenisProkerTersedia(periods: InputPeriod[], now = new Date()): { jenis: JenisProker; tahun_program: number }[] {
  const active = periodeAktif(periods, now);
  return active
    ? [{ jenis: 'rutin', tahun_program: active.tahun_program }, { jenis: 'visioner', tahun_program: active.tahun_program }]
    : [{ jenis: 'aksidental', tahun_program: tahunJakarta(now) }];
}
