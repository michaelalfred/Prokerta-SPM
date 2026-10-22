-- Ganti tahun dan kedua UUID dengan tahun program serta UUID profile di proyek Supabase.
begin;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'GANTI_DENGAN_UUID_USER', true);
do $$
begin
  perform count(*) from public.analisis_anggaran(2026, null);
  raise exception 'GAGAL: user biasa seharusnya ditolak';
exception when sqlstate '42501' then
  raise notice 'LULUS: user biasa ditolak dengan 42501';
end $$;

select set_config('request.jwt.claim.sub', 'GANTI_DENGAN_UUID_ADMIN_ATAU_SUPERADMIN', true);
select count(*) as jumlah_proker_disetujui
from public.analisis_anggaran(2026, null);

rollback;
