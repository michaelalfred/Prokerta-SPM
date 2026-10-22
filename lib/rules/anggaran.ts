export type ItemAnggaran = { nama: string; jumlah_item: number; nominal: string | number };

export function validasiItemAnggaran(value: unknown): ItemAnggaran[] | null {
  if (!Array.isArray(value) || value.length < 1) return null;
  const items: ItemAnggaran[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    if (typeof row.nama !== 'string' || !row.nama.trim()) return null;
    if (typeof row.nominal !== 'string' && typeof row.nominal !== 'number') return null;
    const jumlahText = String(row.jumlah_item ?? '').trim();
    if (!/^\d+$/.test(jumlahText)) return null;
    const jumlah = Number(jumlahText);
    if (!Number.isSafeInteger(jumlah) || jumlah <= 0 || jumlah > 2147483647) return null;
    items.push({ nama: row.nama.trim(), jumlah_item: jumlah, nominal: String(row.nominal).trim() });
  }
  try {
    hitungTotalAnggaran(items);
  } catch {
    return null;
  }
  return items;
}

function keSen(nominal: string | number): bigint {
  const teks = String(nominal).trim();
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(teks)) {
    throw new Error('Nominal harus berupa angka maksimal dua desimal.');
  }
  const [rupiah, pecahan = ''] = teks.split('.');
  const nilaiRupiah = BigInt(rupiah || '0');
  if (nilaiRupiah > BigInt('9999999999999')) throw new Error('Nominal melebihi batas kolom anggaran.');
  return nilaiRupiah * BigInt(100) + BigInt((pecahan + '00').slice(0, 2));
}

export function hitungTotalAnggaran(items: Pick<ItemAnggaran, 'nominal'>[]): string {
  const seratus = BigInt(100);
  const totalSen = items.reduce((total, item) => total + keSen(item.nominal), BigInt(0));
  return `${totalSen / seratus}.${String(totalSen % seratus).padStart(2, '0')}`;
}

export function formatRupiah(total: string): string {
  const [rupiah, pecahan = '00'] = total.split('.');
  const terformat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(BigInt(rupiah));
  return `Rp ${terformat}${pecahan === '00' ? '' : `,${pecahan}`}`;
}
