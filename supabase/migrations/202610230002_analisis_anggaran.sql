create or replace function analisis_anggaran(p_tahun int, p_lembaga uuid default null)
returns table(
  lembaga_id uuid,
  lembaga text,
  bidang_id uuid,
  bidang text,
  tim_kerja_id uuid,
  tim_kerja text,
  proker_id uuid,
  nama_kegiatan text,
  evaluasi_id uuid,
  anggaran_rencana text,
  anggaran_realisasi text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query
  select d.lembaga_id, d.lembaga, d.bidang_id, d.bidang, d.tim_kerja_id, d.tim_kerja,
    d.proker_id, d.nama_kegiatan, d.evaluasi_id,
    coalesce(rencana.total, 0)::text,
    case when d.evaluasi_id is null then null else coalesce(realisasi.total, 0)::text end
  from analisis_proker_dasar d
  left join lateral (
    select sum(a.jumlah_item * a.harga_satuan) as total
    from proker_anggaran a where a.proker_id = d.proker_id
  ) rencana on true
  left join lateral (
    select sum(a.jumlah_item * a.harga_satuan) as total
    from evaluasi_anggaran a where a.evaluasi_id = d.evaluasi_id
  ) realisasi on true
  where d.tahun_program = p_tahun
    and d.status_efektif = 'disetujui'
    and (p_lembaga is null or d.lembaga_id = p_lembaga)
  order by d.lembaga, d.bidang, d.tim_kerja, d.nama_kegiatan;
end $$;

revoke all on function analisis_anggaran(int, uuid) from public, anon;
grant execute on function analisis_anggaran(int, uuid) to authenticated;
