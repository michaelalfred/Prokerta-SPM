-- Semua proker lama tetap tahunan. Proker aksidental juga selalu tahunan.
alter table proker add column jenis_evaluasi text not null default 'tahunan'
  check (jenis_evaluasi in ('tahunan','bulanan'));
alter table proker add constraint proker_aksidental_evaluasi_tahunan
  check (jenis <> 'aksidental' or jenis_evaluasi = 'tahunan');

-- proker_v memakai daftar kolom yang ditetapkan saat view dibuat. Refresh
-- definisinya agar kolom baru terbaca, sambil mempertahankan urutan kolom lama.
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

alter table evaluasi drop constraint evaluasi_proker_id_key;
alter table evaluasi add column bulan_evaluasi date;
alter table evaluasi add constraint evaluasi_bulan_awal check (
  bulan_evaluasi is null or date_trunc('month', bulan_evaluasi)::date = bulan_evaluasi
);
create unique index evaluasi_tahunan_satu_per_proker on evaluasi(proker_id) where bulan_evaluasi is null;
create unique index evaluasi_bulanan_satu_per_proker_per_bulan on evaluasi(proker_id, bulan_evaluasi) where bulan_evaluasi is not null;

create or replace function check_evaluasi_insert() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_proker proker%rowtype;
begin
  select * into v_proker from proker where id=new.proker_id;
  if not found or v_proker.status <> 'disetujui' then raise exception 'Evaluasi hanya untuk proker disetujui'; end if;
  if v_proker.jenis_evaluasi = 'tahunan' then
    if new.bulan_evaluasi is not null then raise exception 'Evaluasi tahunan tidak memakai bulan evaluasi.'; end if;
  else
    if new.bulan_evaluasi is null
      or date_trunc('month',new.bulan_evaluasi)::date <> new.bulan_evaluasi
      or extract(year from new.bulan_evaluasi)::integer <> v_proker.tahun_program
      or new.tanggal_mulai < new.bulan_evaluasi
      or new.tanggal_selesai >= (new.bulan_evaluasi + interval '1 month')::date then
      raise exception 'Bulan evaluasi dan waktu pelaksanaan harus berada dalam bulan yang sama pada tahun program.';
    end if;
  end if;
  return new;
end $$;

-- RPC menerima evaluasi tahunan atau bulan terpilih. Indeks unik menjadi lapisan
-- akhir agar dua pengiriman bersamaan tidak dapat membuat evaluasi ganda.
drop function if exists buat_evaluasi_dengan_anggaran(uuid,uuid,text,integer,boolean,date,date,text,jsonb,jsonb);
create function buat_evaluasi_dengan_anggaran(
  p_id uuid, p_proker_id uuid, p_hasil_kegiatan text, p_capaian_persen integer,
  p_rentang_waktu boolean, p_tanggal_mulai date, p_tanggal_selesai date,
  p_keterangan_tambahan text, p_anggaran jsonb, p_files jsonb, p_bulan_evaluasi date default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_team uuid; v_proker proker%rowtype; v_item jsonb; v_ord bigint;
  v_nama text; v_qty text; v_harga_satuan_text text; v_file jsonb;
  v_path text; v_size bigint; v_mime text;
begin
  if auth.uid() is null then raise exception 'Silakan masuk untuk mengisi evaluasi.'; end if;
  select tim_kerja_id into v_team from profiles where id=auth.uid();
  select * into v_proker from proker where id=p_proker_id and tim_kerja_id=v_team and proker_status_efektif(id)='disetujui';
  if v_team is null or not found then raise exception 'Evaluasi hanya dapat diisi untuk proker disetujui milik tim Anda.'; end if;
  if (v_proker.jenis_evaluasi='tahunan' and p_bulan_evaluasi is not null)
    or (v_proker.jenis_evaluasi='bulanan' and (p_bulan_evaluasi is null or date_trunc('month',p_bulan_evaluasi)::date<>p_bulan_evaluasi or extract(year from p_bulan_evaluasi)::integer<>v_proker.tahun_program)) then
    raise exception 'Periode evaluasi tidak sesuai dengan jenis evaluasi proker.';
  end if;
  if exists(select 1 from evaluasi where proker_id=p_proker_id and bulan_evaluasi is not distinct from p_bulan_evaluasi) then raise exception 'Evaluasi pada periode ini sudah pernah dikirim.'; end if;
  if nullif(btrim(p_hasil_kegiatan),'') is null or p_capaian_persen not between 0 and 100 then raise exception 'Isi hasil kegiatan dan capaian 0 sampai 100.'; end if;
  if p_tanggal_mulai is null or p_tanggal_selesai is null or (p_rentang_waktu and p_tanggal_selesai<p_tanggal_mulai) or (not p_rentang_waktu and p_tanggal_selesai<>p_tanggal_mulai) then raise exception 'Periksa tanggal pelaksanaan.'; end if;
  if p_bulan_evaluasi is not null and (p_tanggal_mulai<p_bulan_evaluasi or p_tanggal_selesai >= (p_bulan_evaluasi + interval '1 month')::date) then raise exception 'Waktu pelaksanaan harus berada dalam bulan evaluasi.'; end if;
  if p_anggaran is null or jsonb_typeof(p_anggaran) is distinct from 'array' or jsonb_array_length(p_anggaran)<1 then raise exception 'Realisasi anggaran minimal satu item.'; end if;
  if p_files is null or jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files)>10 then raise exception 'Daftar bukti tidak valid atau melebihi 10 file.'; end if;

  insert into evaluasi(id,proker_id,created_by,hasil_kegiatan,capaian_persen,rentang_waktu,tanggal_mulai,tanggal_selesai,keterangan_tambahan,bulan_evaluasi)
  values(p_id,p_proker_id,auth.uid(),btrim(p_hasil_kegiatan),p_capaian_persen,p_rentang_waktu,p_tanggal_mulai,p_tanggal_selesai,nullif(btrim(p_keterangan_tambahan),''),p_bulan_evaluasi);

  for v_item,v_ord in select value,ordinality from jsonb_array_elements(p_anggaran) with ordinality as biaya(value,ordinality) loop
    v_nama:=btrim(coalesce(v_item->>'nama','')); v_qty:=coalesce(v_item->>'jumlah_item',''); v_harga_satuan_text:=coalesce(v_item->>'harga_satuan','');
    if v_nama='' or v_qty !~ '^[0-9]+$' then raise exception 'Nama dan jumlah item realisasi anggaran wajib diisi dengan benar.'; end if;
    if v_qty::numeric<=0 or v_qty::numeric>2147483647 then raise exception 'Nama dan jumlah item realisasi anggaran wajib diisi dengan benar.'; end if;
    if v_harga_satuan_text !~ '^([0-9]+(\.[0-9]{0,2})?|\.[0-9]{1,2})$' then raise exception 'Harga satuan anggaran harus nol atau lebih, maksimal dua desimal.'; end if;
    if v_harga_satuan_text::numeric>9999999999999.99 then raise exception 'Harga satuan anggaran harus nol atau lebih, maksimal dua desimal.'; end if;
    insert into evaluasi_anggaran(evaluasi_id,urutan,nama,jumlah_item,harga_satuan) values(p_id,v_ord::integer-1,v_nama,v_qty::integer,v_harga_satuan_text::numeric(15,2));
  end loop;

  for v_file in select value from jsonb_array_elements(p_files) loop
    v_path:=coalesce(v_file->>'storage_path','');
    if v_path !~ ('^'||v_team::text||'/'||p_id::text||'/[A-Za-z0-9-]+\.(jpg|png|pdf)$') then raise exception 'Path file bukti tidak valid.'; end if;
    select (metadata->>'size')::bigint,metadata->>'mimetype' into v_size,v_mime from storage.objects where bucket_id='bukti-evaluasi' and name=v_path;
    if not found or v_size is null or v_size<1 or v_size>10485760 or v_mime not in ('image/jpeg','image/png','application/pdf') then raise exception 'File bukti tidak ditemukan atau tidak valid.'; end if;
    insert into evaluasi_file(evaluasi_id,storage_path,nama_file,mime_type,ukuran_bytes) values(p_id,v_path,btrim(coalesce(v_file->>'nama_file','bukti')),v_mime,v_size);
  end loop;
  return p_id;
end $$;
revoke all on function buat_evaluasi_dengan_anggaran(uuid,uuid,text,integer,boolean,date,date,text,jsonb,jsonb,date) from public,anon;
grant execute on function buat_evaluasi_dengan_anggaran(uuid,uuid,text,integer,boolean,date,date,text,jsonb,jsonb,date) to authenticated;

drop function if exists buat_proker_dengan_anggaran(jenis_proker,text,text,text,text,boolean,date,date,text,jsonb,uuid,uuid);
create or replace function buat_proker_dengan_anggaran(
  p_jenis jenis_proker, p_sasaran_program text, p_indikator_keberhasilan text,
  p_target text, p_nama_kegiatan text, p_rentang_waktu boolean,
  p_tanggal_mulai date, p_tanggal_selesai date, p_penanggung_jawab text,
  p_anggaran jsonb, p_misi_id uuid default null, p_milestone_id uuid default null,
  p_jenis_evaluasi text default 'tahunan'
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile profiles%rowtype; v_periode periode_input%rowtype; v_ada_periode boolean;
  v_tahun_program integer; v_status status_proker; v_visi text; v_misi misi%rowtype;
  v_milestone milestone%rowtype; v_proker_id uuid; v_item jsonb; v_urutan bigint;
  v_nama text; v_jumlah_text text; v_jumlah integer; v_harga_satuan_text text; v_harga_satuan numeric(15,2);
begin
  if auth.uid() is null then raise exception 'Silakan masuk untuk menyimpan proker.'; end if;
  select * into v_profile from profiles where id=auth.uid();
  if not found then raise exception 'Profil akun tidak ditemukan.'; end if;
  if p_jenis_evaluasi not in ('tahunan','bulanan') or (p_jenis='aksidental' and p_jenis_evaluasi<>'tahunan') then raise exception 'Jenis evaluasi tidak sesuai dengan jenis proker.'; end if;
  if coalesce(nullif(btrim(p_sasaran_program),''),null) is null or coalesce(nullif(btrim(p_indikator_keberhasilan),''),null) is null or coalesce(nullif(btrim(p_target),''),null) is null or coalesce(nullif(btrim(p_nama_kegiatan),''),null) is null or coalesce(nullif(btrim(p_penanggung_jawab),''),null) is null then raise exception 'Semua field proker wajib diisi.'; end if;
  if p_tanggal_mulai is null or p_tanggal_selesai is null or (p_rentang_waktu and p_tanggal_selesai<p_tanggal_mulai) or (not p_rentang_waktu and p_tanggal_selesai<>p_tanggal_mulai) then raise exception 'Periksa tanggal waktu pelaksanaan.'; end if;
  select * into v_periode from periode_aktif() limit 1; v_ada_periode:=found;
  if v_ada_periode then
    if p_jenis not in ('rutin','visioner') then raise exception 'Dalam periode input, jenis proker hanya Rutin atau Visioner.'; end if;
    v_tahun_program:=v_periode.tahun_program; v_status:='menunggu';
  else
    if p_jenis<>'aksidental' then raise exception 'Di luar periode input, jenis proker hanya Aksidental.'; end if;
    v_tahun_program:=extract(year from hari_ini())::integer; v_status:='ditinjau';
  end if;
  if p_jenis='visioner' then
    select visi into v_visi from visi_misi where singleton=true;
    if not found or nullif(btrim(v_visi),'') is null then raise exception 'Data Visi-Misi belum tersedia. Hubungi superadmin.'; end if;
    select * into v_misi from misi where id=p_misi_id;
    if not found or nullif(btrim(v_misi.teks),'') is null or nullif(btrim(v_misi.outcome),'') is null then raise exception 'Pilih Misi yang memiliki teks dan Outcomes.'; end if;
    select * into v_milestone from milestone where id=p_milestone_id and misi_id=p_misi_id;
    if not found or nullif(btrim(v_milestone.teks),'') is null then raise exception 'Pilih Milestone dari Misi yang dipilih.'; end if;
  elsif p_misi_id is not null or p_milestone_id is not null then raise exception 'Misi dan Milestone hanya berlaku untuk proker Visioner.';
  end if;
  if p_anggaran is null or jsonb_typeof(p_anggaran) is distinct from 'array' or jsonb_array_length(p_anggaran)<1 then raise exception 'Rincian biaya minimal satu item.'; end if;
  insert into proker(tim_kerja_id,created_by,tahun_program,jenis,jenis_evaluasi,status,misi_id,milestone_id,visi_teks,misi_teks,outcome_teks,milestone_teks,sasaran_program,indikator_keberhasilan,target,nama_kegiatan,rentang_waktu,tanggal_mulai,tanggal_selesai,penanggung_jawab)
  values(v_profile.tim_kerja_id,auth.uid(),v_tahun_program,p_jenis,p_jenis_evaluasi,v_status,case when p_jenis='visioner' then p_misi_id end,case when p_jenis='visioner' then p_milestone_id end,case when p_jenis='visioner' then v_visi end,case when p_jenis='visioner' then v_misi.teks end,case when p_jenis='visioner' then v_misi.outcome end,case when p_jenis='visioner' then v_milestone.teks end,btrim(p_sasaran_program),btrim(p_indikator_keberhasilan),btrim(p_target),btrim(p_nama_kegiatan),p_rentang_waktu,p_tanggal_mulai,p_tanggal_selesai,btrim(p_penanggung_jawab)) returning id into v_proker_id;
  for v_item,v_urutan in select value,ordinality from jsonb_array_elements(p_anggaran) with ordinality as biaya(value,ordinality) loop
    v_nama:=btrim(coalesce(v_item->>'nama','')); v_jumlah_text:=coalesce(v_item->>'jumlah_item',''); v_harga_satuan_text:=coalesce(v_item->>'harga_satuan','');
    if v_nama='' or v_jumlah_text !~ '^[0-9]+$' then raise exception 'Nama dan jumlah item anggaran wajib diisi dengan benar.'; end if;
    v_jumlah:=v_jumlah_text::integer; if v_jumlah<=0 then raise exception 'Jumlah item anggaran harus bilangan bulat lebih dari nol.'; end if;
    if v_harga_satuan_text !~ '^([0-9]+(\.[0-9]{0,2})?|\.[0-9]{1,2})$' then raise exception 'Harga satuan anggaran harus nol atau lebih, maksimal dua desimal.'; end if;
    v_harga_satuan:=v_harga_satuan_text::numeric(15,2);
    insert into proker_anggaran(proker_id,urutan,nama,jumlah_item,harga_satuan) values(v_proker_id,v_urutan::integer-1,v_nama,v_jumlah,v_harga_satuan);
  end loop;
  return v_proker_id;
end $$;
revoke all on function buat_proker_dengan_anggaran(jenis_proker,text,text,text,text,boolean,date,date,text,jsonb,uuid,uuid,text) from public,anon;
grant execute on function buat_proker_dengan_anggaran(jenis_proker,text,text,text,text,boolean,date,date,text,jsonb,uuid,uuid,text) to authenticated;

create or replace function guard_proker_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if current_setting('app.status_rpc_id',true)=old.id::text and current_app_role() in ('admin','superadmin') then return new; end if;
  if current_setting('app.proker_edit_rpc_id',true)=old.id::text then return new; end if;
  if new.jenis_evaluasi is distinct from old.jenis_evaluasi then raise exception 'Jenis evaluasi proker tidak dapat diubah setelah dibuat.'; end if;
  if current_app_role() in ('admin','superadmin') and old.tim_kerja_id=current_tim_kerja_id() and proker_status_efektif(old.id)='menunggu' then
    if new.status<>old.status or new.tim_kerja_id<>old.tim_kerja_id or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis then raise exception 'Perubahan proker tidak diizinkan'; end if;
  elsif current_app_role() in ('admin','superadmin') then
    if proker_status_efektif(old.id) not in ('ditinjau','ditolak','direvisi') or new.tim_kerja_id<>old.tim_kerja_id or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis then raise exception 'Perubahan proker tidak diizinkan'; end if;
    if new.status<>old.status and new.status<>'direvisi' then raise exception 'Perubahan status harus melalui fungsi set_proker_status'; end if;
    if new.status='direvisi' and new.status is distinct from old.status and (to_jsonb(new)-'status'-'updated_at')=(to_jsonb(old)-'status'-'updated_at') then raise exception 'Perubahan status harus melalui fungsi set_proker_status'; end if;
    if new.status<>'direvisi' then raise exception 'Proker yang diedit harus berstatus direvisi'; end if;
  elsif old.tim_kerja_id<>current_tim_kerja_id() or proker_status_efektif(old.id)<>'menunggu' or new.status<>old.status or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis or new.tim_kerja_id<>old.tim_kerja_id then raise exception 'Perubahan proker tidak diizinkan';
  end if;
  return new;
end $$;

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
