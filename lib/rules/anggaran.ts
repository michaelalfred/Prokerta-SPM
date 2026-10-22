export type ItemAnggaran = { nama: string; jumlah_item: number; harga_satuan: string | number };

export function validasiItemAnggaran(value: unknown): ItemAnggaran[] | null {
  if (!Array.isArray(value) || value.length < 1) return null;
  const items: ItemAnggaran[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    if (typeof row.nama !== 'string' || !row.nama.trim()) return null;
    if (typeof row.harga_satuan !== 'string' && typeof row.harga_satuan !== 'number') return null;
    const jumlahText = String(row.jumlah_item ?? '').trim();
    if (!/^\d+$/.test(jumlahText)) return null;
    const jumlah = Number(jumlahText);
    if (!Number.isSafeInteger(jumlah) || jumlah <= 0 || jumlah > 2147483647) return null;
    items.push({ nama: row.nama.trim(), jumlah_item: jumlah, harga_satuan: String(row.harga_satuan).trim() });
  }
  try {
    hitungTotalAnggaran(items);
  } catch {
    return null;
  }
  return items;
}

function keSen(harga_satuan: string | number): bigint {
  const teks = String(harga_satuan).trim();
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(teks)) {
    throw new Error('Harga satuan harus berupa angka maksimal dua desimal.');
  }
  const [rupiah, pecahan = ''] = teks.split('.');
  const nilaiRupiah = BigInt(rupiah || '0');
  if (nilaiRupiah > BigInt('9999999999999')) throw new Error('Harga satuan melebihi batas kolom anggaran.');
  return nilaiRupiah * BigInt(100) + BigInt((pecahan + '00').slice(0, 2));
}

export function hitungTotalAnggaran(items: Pick<ItemAnggaran, 'jumlah_item' | 'harga_satuan'>[]): string {
  const seratus = BigInt(100);
  const totalSen = items.reduce((total, item) => total + BigInt(item.jumlah_item ?? 1) * keSen(item.harga_satuan), BigInt(0));
  return `${totalSen / seratus}.${String(totalSen % seratus).padStart(2, '0')}`;
}

export function formatRupiah(total: string): string {
  const [rupiah, pecahan = '00'] = total.split('.');
  const terformat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(BigInt(rupiah));
  return `Rp ${terformat}${pecahan === '00' ? '' : `,${pecahan}`}`;
}
