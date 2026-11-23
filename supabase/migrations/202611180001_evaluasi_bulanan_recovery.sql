-- Jalankan hanya jika proker.jenis_evaluasi sudah ada setelah percobaan migrasi yang gagal.
-- Refresh view lama agar kolom baru ikut diekspos; p.* pada CREATE VIEW tidak berkembang otomatis.
create or replace view proker_v with (security_invoker=true) as
select
  p.id,p.tim_kerja_id,p.created_by,p.tahun_program,p.jenis,p.status,
  p.misi_id,p.milestone_id,p.visi_teks,p.misi_teks,p.outcome_teks,p.milestone_teks,
  p.sasaran_program,p.indikator_keberhasilan,p.target,p.nama_kegiatan,
  p.rentang_waktu,p.tanggal_mulai,p.tanggal_selesai,p.penanggung_jawab,
  p.created_at,p.updated_at,
  case when p.status='menunggu' and pi.tanggal_selesai<hari_ini()
       then 'ditinjau'::status_proker else p.status end as status_efektif,
  p.jenis_evaluasi
from proker p
left join periode_input pi on pi.tahun_program=p.tahun_program;
create or replace view analisis_proker_dasar with (security_invoker=true) as
select p.id as proker_id,p.tahun_program,p.jenis,p.status_efektif,p.nama_kegiatan,p.tanggal_mulai,p.tanggal_selesai,
  p.misi_id,p.milestone_id,p.misi_teks,p.milestone_teks,tk.id as tim_kerja_id,tk.nama as tim_kerja,b.id as bidang_id,b.nama as bidang,l.id as lembaga_id,l.nama as lembaga,
  e.id as evaluasi_id,e.capaian_persen,p.jenis_evaluasi
from proker_v p join tim_kerja tk on tk.id=p.tim_kerja_id join bidang b on b.id=tk.bidang_id join lembaga l on l.id=b.lembaga_id
left join evaluasi e on e.proker_id=p.id and e.bulan_evaluasi is null;

create or replace function analisis_evaluasi_kepatuhan(p_tahun int,p_lembaga uuid default null)
returns table(lembaga_id uuid,lembaga text,bidang_id uuid,bidang text,tim_kerja_id uuid,tim_kerja text,disetujui bigint,sudah_dievaluasi bigint,belum_dievaluasi bigint,daftar_belum jsonb)
language plpgsql stable security definer set search_path=public as $$ begin
  perform assert_admin();
  return query select d.lembaga_id,d.lembaga,d.bidang_id,d.bidang,d.tim_kerja_id,d.tim_kerja,count(*) filter(where d.status_efektif='disetujui'),count(*) filter(where d.status_efektif='disetujui' and d.evaluasi_id is not null),count(*) filter(where d.status_efektif='disetujui' and d.evaluasi_id is null),
  coalesce(jsonb_agg(jsonb_build_object('proker_id',d.proker_id,'nama_kegiatan',d.nama_kegiatan,'tanggal_mulai',d.tanggal_mulai,'tanggal_selesai',d.tanggal_selesai) order by d.tanggal_selesai) filter(where d.status_efektif='disetujui' and d.evaluasi_id is null),'[]'::jsonb)
  from analisis_proker_dasar d where d.tahun_program=p_tahun and d.jenis_evaluasi='tahunan' and (p_lembaga is null or d.lembaga_id=p_lembaga) group by d.lembaga_id,d.lembaga,d.bidang_id,d.bidang,d.tim_kerja_id,d.tim_kerja order by d.lembaga,d.bidang,d.tim_kerja;
end $$;

create or replace function analisis_capaian(p_tahun int,p_lembaga uuid default null)
returns table(lembaga_id uuid,lembaga text,bidang_id uuid,bidang text,tim_kerja_id uuid,tim_kerja text,jumlah_evaluasi bigint,rata_rata numeric,rentang_0_49 bigint,rentang_50_79 bigint,rentang_80_100 bigint)
language plpgsql stable security definer set search_path=public as $$ begin
  perform assert_admin();
  return query select l.id,l.nama,b.id,b.nama,tk.id,tk.nama,count(d.evaluasi_id),avg(d.capaian_persen),count(d.evaluasi_id) filter(where d.capaian_persen between 0 and 49),count(d.evaluasi_id) filter(where d.capaian_persen between 50 and 79),count(d.evaluasi_id) filter(where d.capaian_persen between 80 and 100)
  from tim_kerja tk join bidang b on b.id=tk.bidang_id join lembaga l on l.id=b.lembaga_id left join analisis_proker_dasar d on d.tim_kerja_id=tk.id and d.tahun_program=p_tahun and d.evaluasi_id is not null and d.jenis_evaluasi='tahunan'
  where p_lembaga is null or l.id=p_lembaga group by l.id,l.nama,b.id,b.nama,tk.id,tk.nama order by l.nama,b.nama,tk.nama;
end $$;

create or replace function analisis_anggaran(p_tahun int,p_lembaga uuid default null)
returns table(lembaga_id uuid,lembaga text,bidang_id uuid,bidang text,tim_kerja_id uuid,tim_kerja text,proker_id uuid,nama_kegiatan text,evaluasi_id uuid,anggaran_rencana text,anggaran_realisasi text)
language plpgsql stable security definer set search_path=public as $$ begin
  perform assert_admin();
  return query select d.lembaga_id,d.lembaga,d.bidang_id,d.bidang,d.tim_kerja_id,d.tim_kerja,d.proker_id,d.nama_kegiatan,d.evaluasi_id,
    coalesce(rencana.total,0)::text,case when d.evaluasi_id is null then null else coalesce(realisasi.total,0)::text end
  from analisis_proker_dasar d
  left join lateral (select sum(a.jumlah_item*a.harga_satuan) total from proker_anggaran a where a.proker_id=d.proker_id) rencana on true
  left join lateral (select sum(a.jumlah_item*a.harga_satuan) total from evaluasi_anggaran a where a.evaluasi_id=d.evaluasi_id) realisasi on true
  where d.tahun_program=p_tahun and d.status_efektif='disetujui' and d.jenis_evaluasi='tahunan' and (p_lembaga is null or d.lembaga_id=p_lembaga)
  order by d.lembaga,d.bidang,d.tim_kerja,d.nama_kegiatan;
end $$;

create function analisis_evaluasi_kepatuhan_bulanan(p_tahun int,p_bulan date,p_lembaga uuid default null)
returns table(lembaga_id uuid,lembaga text,bidang_id uuid,bidang text,tim_kerja_id uuid,tim_kerja text,disetujui bigint,sudah_dievaluasi bigint,belum_dievaluasi bigint,daftar_belum jsonb)
language plpgsql stable security definer set search_path=public as $$ begin
  perform assert_admin();
  if p_bulan is null or date_trunc('month',p_bulan)::date<>p_bulan or extract(year from p_bulan)::integer<>p_tahun then raise exception 'Bulan analisis tidak valid.'; end if;
  return query select l.id,l.nama,b.id,b.nama,tk.id,tk.nama,count(p.id) filter(where p.status_efektif='disetujui'),count(p.id) filter(where p.status_efektif='disetujui' and e.id is not null),count(p.id) filter(where p.status_efektif='disetujui' and e.id is null),
  coalesce(jsonb_agg(jsonb_build_object('proker_id',p.id,'nama_kegiatan',p.nama_kegiatan,'tanggal_mulai',p.tanggal_mulai,'tanggal_selesai',p.tanggal_selesai,'bulan_evaluasi',p_bulan) order by p.nama_kegiatan) filter(where p.status_efektif='disetujui' and e.id is null),'[]'::jsonb)
  from tim_kerja tk join bidang b on b.id=tk.bidang_id join lembaga l on l.id=b.lembaga_id left join proker_v p on p.tim_kerja_id=tk.id and p.tahun_program=p_tahun and p.jenis_evaluasi='bulanan' left join evaluasi e on e.proker_id=p.id and e.bulan_evaluasi=p_bulan
  where p_lembaga is null or l.id=p_lembaga group by l.id,l.nama,b.id,b.nama,tk.id,tk.nama order by l.nama,b.nama,tk.nama;
end $$;

create function analisis_capaian_bulanan(p_tahun int,p_bulan date,p_lembaga uuid default null)
returns table(lembaga_id uuid,lembaga text,bidang_id uuid,bidang text,tim_kerja_id uuid,tim_kerja text,jumlah_evaluasi bigint,rata_rata numeric,rentang_0_49 bigint,rentang_50_79 bigint,rentang_80_100 bigint)
language plpgsql stable security definer set search_path=public as $$ begin
  perform assert_admin();
  if p_bulan is null or date_trunc('month',p_bulan)::date<>p_bulan or extract(year from p_bulan)::integer<>p_tahun then raise exception 'Bulan analisis tidak valid.'; end if;
  return query select l.id,l.nama,b.id,b.nama,tk.id,tk.nama,count(e.id),avg(e.capaian_persen),count(e.id) filter(where e.capaian_persen between 0 and 49),count(e.id) filter(where e.capaian_persen between 50 and 79),count(e.id) filter(where e.capaian_persen between 80 and 100)
  from tim_kerja tk join bidang b on b.id=tk.bidang_id join lembaga l on l.id=b.lembaga_id left join proker_v p on p.tim_kerja_id=tk.id and p.tahun_program=p_tahun and p.jenis_evaluasi='bulanan' left join evaluasi e on e.proker_id=p.id and e.bulan_evaluasi=p_bulan
  where p_lembaga is null or l.id=p_lembaga group by l.id,l.nama,b.id,b.nama,tk.id,tk.nama order by l.nama,b.nama,tk.nama;
end $$;

create function analisis_realisasi_bulanan(p_tahun int,p_bulan date,p_lembaga uuid default null)
returns table(lembaga_id uuid,lembaga text,bidang_id uuid,bidang text,tim_kerja_id uuid,tim_kerja text,proker_id uuid,nama_kegiatan text,evaluasi_id uuid,bulan_evaluasi date,realisasi text)
language plpgsql stable security definer set search_path=public as $$ begin
  perform assert_admin();
  if p_bulan is null or date_trunc('month',p_bulan)::date<>p_bulan or extract(year from p_bulan)::integer<>p_tahun then raise exception 'Bulan analisis tidak valid.'; end if;
  if p_bulan is null or date_trunc('month',p_bulan)::date<>p_bulan or extract(year from p_bulan)::integer<>p_tahun then raise exception 'Bulan analisis tidak valid.'; end if;
  return query select l.id,l.nama,b.id,b.nama,tk.id,tk.nama,p.id,p.nama_kegiatan,e.id,p_bulan,coalesce(sum(a.jumlah_item*a.harga_satuan),0)::text
  from evaluasi e join proker_v p on p.id=e.proker_id join tim_kerja tk on tk.id=p.tim_kerja_id join bidang b on b.id=tk.bidang_id join lembaga l on l.id=b.lembaga_id left join evaluasi_anggaran a on a.evaluasi_id=e.id
  where p.tahun_program=p_tahun and p.jenis_evaluasi='bulanan' and p.status_efektif='disetujui' and e.bulan_evaluasi=p_bulan and (p_lembaga is null or l.id=p_lembaga)
  group by l.id,l.nama,b.id,b.nama,tk.id,tk.nama,p.id,p.nama_kegiatan,e.id order by l.nama,b.nama,tk.nama,p.nama_kegiatan;
end $$;

revoke all on function analisis_evaluasi_kepatuhan_bulanan(int,date,uuid) from public,anon;
revoke all on function analisis_capaian_bulanan(int,date,uuid) from public,anon;
revoke all on function analisis_realisasi_bulanan(int,date,uuid) from public,anon;
grant execute on function analisis_evaluasi_kepatuhan_bulanan(int,date,uuid) to authenticated;
grant execute on function analisis_capaian_bulanan(int,date,uuid) to authenticated;
grant execute on function analisis_realisasi_bulanan(int,date,uuid) to authenticated;
