'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const get = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function simpanPeriode(form: FormData): Promise<{ error?: string; ok?: string }> {
  await requireRole(['admin', 'superadmin']);
  const id = get(form, 'id');
  const tahun_program = Number(get(form, 'tahun_program'));
  const tanggal_mulai = get(form, 'tanggal_mulai');
  const tanggal_selesai = get(form, 'tanggal_selesai');
  if (!Number.isInteger(tahun_program) || tahun_program < 2000 || tahun_program > 2100 || !validDate(tanggal_mulai) || !validDate(tanggal_selesai) || tanggal_selesai < tanggal_mulai) {
    return { error: 'Periksa tahun dan rentang tanggal. Tanggal selesai harus sama atau setelah tanggal mulai.' };
  }
  const supabase = createAdminClient();
  const result = id
    ? await supabase.from('periode_input').update({ tahun_program, tanggal_mulai, tanggal_selesai }).eq('id', id)
    : await supabase.from('periode_input').insert({ tahun_program, tanggal_mulai, tanggal_selesai });
  if (result.error) {
    if (result.error.code === '23P01') return { error: 'Rentang tanggal periode tidak boleh tumpang tindih.' };
    if (result.error.code === '23505') return { error: 'Tahun program tersebut sudah memiliki periode input.' };
    return { error: result.error.message };
  }
  revalidatePath('/periode');
  return { ok: id ? 'Periode diperbarui.' : 'Periode ditambahkan.' };
}
