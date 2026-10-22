-- O1: harga satuan dikalikan kuantitas untuk total item. Nilai tersimpan dipertahankan dan ditafsirkan sebagai harga satuan.

alter table proker_anggaran rename column nominal to harga_satuan;
alter table evaluasi_anggaran rename column nominal to harga_satuan;

create or replace function buat_proker_dengan_anggaran(
  p_jenis jenis_proker,
  p_sasaran_program text,
  p_indikator_keberhasilan text,
  p_target text,
  p_nama_kegiatan text,
  p_rentang_waktu boolean,
  p_tanggal_mulai date,
  p_tanggal_selesai date,
  p_penanggung_jawab text,
  p_anggaran jsonb,
  p_misi_id uuid default null,
  p_milestone_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_periode periode_input%rowtype;
  v_ada_periode boolean;
  v_tahun_program integer;
  v_status status_proker;
  v_visi text;
  v_misi misi%rowtype;
  v_milestone milestone%rowtype;
  v_proker_id uuid;
  v_item jsonb;
  v_urutan bigint;
  v_nama text;
  v_jumlah_text text;
  v_jumlah integer;
  v_harga_satuan_text text;
  v_harga_satuan numeric(15,2);
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk untuk menyimpan proker.';
  end if;

  select * into v_profile from profiles where id = auth.uid();
  if not found then
    raise exception 'Profil akun tidak ditemukan.';
  end if;

  if coalesce(nullif(btrim(p_sasaran_program), ''), null) is null
    or coalesce(nullif(btrim(p_indikator_keberhasilan), ''), null) is null
    or coalesce(nullif(btrim(p_target), ''), null) is null
    or coalesce(nullif(btrim(p_nama_kegiatan), ''), null) is null
    or coalesce(nullif(btrim(p_penanggung_jawab), ''), null) is null then
    raise exception 'Semua field proker wajib diisi.';
  end if;

  if p_tanggal_mulai is null or p_tanggal_selesai is null
    or (p_rentang_waktu and p_tanggal_selesai < p_tanggal_mulai)
    or (not p_rentang_waktu and p_tanggal_selesai <> p_tanggal_mulai) then
    raise exception 'Periksa tanggal waktu pelaksanaan.';
  end if;

  select * into v_periode from periode_aktif() limit 1;
  v_ada_periode := found;
  if v_ada_periode then
    if p_jenis not in ('rutin', 'visioner') then
      raise exception 'Dalam periode input, jenis proker hanya Rutin atau Visioner.';
    end if;
    v_tahun_program := v_periode.tahun_program;
    v_status := 'menunggu';
  else
    if p_jenis <> 'aksidental' then
      raise exception 'Di luar periode input, jenis proker hanya Aksidental.';
    end if;
    v_tahun_program := extract(year from hari_ini())::integer;
    v_status := 'ditinjau';
  end if;

  if p_jenis = 'visioner' then
    select visi into v_visi from visi_misi where singleton = true;
    if not found or nullif(btrim(v_visi), '') is null then
      raise exception 'Data Visi-Misi belum tersedia. Hubungi superadmin.';
    end if;
    select * into v_misi from misi where id = p_misi_id;
    if not found or nullif(btrim(v_misi.teks), '') is null or nullif(btrim(v_misi.outcome), '') is null then
      raise exception 'Pilih Misi yang memiliki teks dan Outcomes.';
    end if;
    select * into v_milestone from milestone where id = p_milestone_id and misi_id = p_misi_id;
    if not found or nullif(btrim(v_milestone.teks), '') is null then
      raise exception 'Pilih Milestone dari Misi yang dipilih.';
    end if;
  elsif p_misi_id is not null or p_milestone_id is not null then
    raise exception 'Misi dan Milestone hanya berlaku untuk proker Visioner.';
  end if;

  if p_anggaran is null or jsonb_typeof(p_anggaran) is distinct from 'array' then
    raise exception 'Rincian biaya harus berupa daftar item.';
  end if;
  if jsonb_array_length(p_anggaran) < 1 then
    raise exception 'Rincian biaya minimal satu item.';
  end if;

  insert into proker (
    tim_kerja_id, created_by, tahun_program, jenis, status,
    misi_id, milestone_id, visi_teks, misi_teks, outcome_teks, milestone_teks,
    sasaran_program, indikator_keberhasilan, target, nama_kegiatan,
    rentang_waktu, tanggal_mulai, tanggal_selesai, penanggung_jawab
  ) values (
    v_profile.tim_kerja_id, auth.uid(), v_tahun_program, p_jenis, v_status,
    case when p_jenis = 'visioner' then p_misi_id else null end,
    case when p_jenis = 'visioner' then p_milestone_id else null end,
    case when p_jenis = 'visioner' then v_visi else null end,
    case when p_jenis = 'visioner' then v_misi.teks else null end,
    case when p_jenis = 'visioner' then v_misi.outcome else null end,
    case when p_jenis = 'visioner' then v_milestone.teks else null end,
    btrim(p_sasaran_program), btrim(p_indikator_keberhasilan), btrim(p_target), btrim(p_nama_kegiatan),
    p_rentang_waktu, p_tanggal_mulai, p_tanggal_selesai, btrim(p_penanggung_jawab)
  ) returning id into v_proker_id;

  for v_item, v_urutan in
    select value, ordinality from jsonb_array_elements(p_anggaran) with ordinality as biaya(value, ordinality)
  loop
    v_nama := btrim(coalesce(v_item->>'nama', ''));
    v_jumlah_text := coalesce(v_item->>'jumlah_item', '');
    v_harga_satuan_text := coalesce(v_item->>'harga_satuan', '');
    if v_nama = '' or v_jumlah_text !~ '^[0-9]+$' then
      raise exception 'Nama dan jumlah item anggaran wajib diisi dengan benar.';
    end if;
    v_jumlah := v_jumlah_text::integer;
    if v_jumlah <= 0 then
      raise exception 'Jumlah item anggaran harus bilangan bulat lebih dari nol.';
    end if;
    if v_harga_satuan_text !~ '^([0-9]+(\.[0-9]{0,2})?|\.[0-9]{1,2})$' then
      raise exception 'Harga satuan anggaran harus nol atau lebih, maksimal dua desimal.';
    end if;
    v_harga_satuan := v_harga_satuan_text::numeric(15,2);
    insert into proker_anggaran(proker_id, urutan, nama, jumlah_item, harga_satuan)
    values (v_proker_id, v_urutan::integer - 1, v_nama, v_jumlah, v_harga_satuan);
  end loop;

  return v_proker_id;
end;
$$;

revoke all on function buat_proker_dengan_anggaran(jenis_proker, text, text, text, text, boolean, date, date, text, jsonb, uuid, uuid) from public, anon;
grant execute on function buat_proker_dengan_anggaran(jenis_proker, text, text, text, text, boolean, date, date, text, jsonb, uuid, uuid) to authenticated;

create or replace function guard_proker_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.status_rpc_id', true) = old.id::text and current_app_role() in ('admin','superadmin') then
    return new;
  end if;
  if current_setting('app.proker_edit_rpc_id', true) = old.id::text then
    return new;
  end if;
  if current_app_role() in ('admin','superadmin') and old.tim_kerja_id=current_tim_kerja_id() and proker_status_efektif(old.id)='menunggu' then
    if new.status<>old.status or new.tim_kerja_id<>old.tim_kerja_id or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis then raise exception 'Perubahan proker tidak diizinkan'; end if;
  elsif current_app_role() in ('admin','superadmin') then
    if proker_status_efektif(old.id) not in ('ditinjau','ditolak','direvisi') or new.tim_kerja_id<>old.tim_kerja_id or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis then raise exception 'Perubahan proker tidak diizinkan'; end if;
    if new.status<>old.status and new.status<>'direvisi' then raise exception 'Perubahan status harus melalui fungsi set_proker_status'; end if;
    if new.status='direvisi' and new.status is distinct from old.status and (to_jsonb(new)-'status'-'updated_at')=(to_jsonb(old)-'status'-'updated_at') then raise exception 'Perubahan status harus melalui fungsi set_proker_status'; end if;
    if new.status<>'direvisi' then raise exception 'Proker yang diedit harus berstatus direvisi'; end if;
  elsif old.tim_kerja_id<>current_tim_kerja_id() or proker_status_efektif(old.id)<>'menunggu' or new.status<>old.status or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis or new.tim_kerja_id<>old.tim_kerja_id then
    raise exception 'Perubahan proker tidak diizinkan';
  end if;
  return new;
end $$;

create or replace function ubah_proker_dengan_anggaran(
  p_id uuid,
  p_sasaran_program text,
  p_indikator_keberhasilan text,
  p_target text,
  p_nama_kegiatan text,
  p_rentang_waktu boolean,
  p_tanggal_mulai date,
  p_tanggal_selesai date,
  p_penanggung_jawab text,
  p_anggaran jsonb,
  p_misi_id uuid default null,
  p_milestone_id uuid default null
) returns status_proker
language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles%rowtype;
  v_proker proker%rowtype;
  v_status_efektif status_proker;
  v_status_baru status_proker;
  v_visi text;
  v_misi misi%rowtype;
  v_milestone milestone%rowtype;
  v_item jsonb;
  v_urutan bigint;
  v_nama text;
  v_jumlah_text text;
  v_jumlah integer;
  v_harga_satuan_text text;
  v_harga_satuan numeric(15,2);
begin
  if auth.uid() is null then raise exception 'Silakan masuk untuk mengubah proker.'; end if;
  select * into v_profile from profiles where id=auth.uid();
  if not found then raise exception 'Profil akun tidak ditemukan.'; end if;
  select * into v_proker from proker where id=p_id;
  if not found then raise exception 'Proker tidak ditemukan.'; end if;
  v_status_efektif := proker_status_efektif(p_id);

  if v_status_efektif='menunggu' and v_proker.tim_kerja_id=v_profile.tim_kerja_id then
    v_status_baru := v_proker.status;
  elsif v_profile.role in ('admin','superadmin') and v_status_efektif in ('ditinjau','ditolak','direvisi') then
    v_status_baru := 'direvisi';
  else
    raise exception 'Anda tidak berhak mengubah proker ini.';
  end if;

  if coalesce(nullif(btrim(p_sasaran_program), ''), null) is null
    or coalesce(nullif(btrim(p_indikator_keberhasilan), ''), null) is null
    or coalesce(nullif(btrim(p_target), ''), null) is null
    or coalesce(nullif(btrim(p_nama_kegiatan), ''), null) is null
    or coalesce(nullif(btrim(p_penanggung_jawab), ''), null) is null then
    raise exception 'Semua field proker wajib diisi.';
  end if;
  if p_tanggal_mulai is null or p_tanggal_selesai is null
    or (p_rentang_waktu and p_tanggal_selesai < p_tanggal_mulai)
    or (not p_rentang_waktu and p_tanggal_selesai <> p_tanggal_mulai) then
    raise exception 'Periksa tanggal waktu pelaksanaan.';
  end if;
  if p_anggaran is null or jsonb_typeof(p_anggaran) is distinct from 'array' then
    raise exception 'Rincian biaya minimal satu item.';
  end if;
  if jsonb_array_length(p_anggaran) < 1 then
    raise exception 'Rincian biaya minimal satu item.';
  end if;

  if v_proker.jenis='visioner' then
    select visi into v_visi from visi_misi where singleton=true;
    if not found or nullif(btrim(v_visi),'') is null then raise exception 'Data Visi-Misi belum tersedia.'; end if;
    select * into v_misi from misi where id=p_misi_id;
    if not found or nullif(btrim(v_misi.teks),'') is null or nullif(btrim(v_misi.outcome),'') is null then raise exception 'Pilih Misi yang valid.'; end if;
    select * into v_milestone from milestone where id=p_milestone_id and misi_id=p_misi_id;
    if not found or nullif(btrim(v_milestone.teks),'') is null then raise exception 'Pilih Milestone dari Misi yang dipilih.'; end if;
  elsif p_misi_id is not null or p_milestone_id is not null then
    raise exception 'Misi dan Milestone hanya berlaku untuk proker Visioner.';
  end if;

  perform set_config('app.proker_edit_rpc_id',p_id::text,true);
  update proker set
    misi_id=case when v_proker.jenis='visioner' then p_misi_id else null end,
    milestone_id=case when v_proker.jenis='visioner' then p_milestone_id else null end,
    visi_teks=case when v_proker.jenis='visioner' then v_visi else null end,
    misi_teks=case when v_proker.jenis='visioner' then v_misi.teks else null end,
    outcome_teks=case when v_proker.jenis='visioner' then v_misi.outcome else null end,
    milestone_teks=case when v_proker.jenis='visioner' then v_milestone.teks else null end,
    sasaran_program=btrim(p_sasaran_program), indikator_keberhasilan=btrim(p_indikator_keberhasilan),
    target=btrim(p_target), nama_kegiatan=btrim(p_nama_kegiatan), rentang_waktu=p_rentang_waktu,
    tanggal_mulai=p_tanggal_mulai, tanggal_selesai=p_tanggal_selesai,
    penanggung_jawab=btrim(p_penanggung_jawab), status=v_status_baru
  where id=p_id;

  delete from proker_anggaran where proker_id=p_id;
  for v_item, v_urutan in
    select value, ordinality from jsonb_array_elements(p_anggaran) with ordinality as biaya(value, ordinality)
  loop
    v_nama := btrim(coalesce(v_item->>'nama',''));
    v_jumlah_text := coalesce(v_item->>'jumlah_item','');
    v_harga_satuan_text := coalesce(v_item->>'harga_satuan','');
    if v_nama='' or v_jumlah_text !~ '^[0-9]+$' then raise exception 'Nama dan jumlah item anggaran wajib diisi dengan benar.'; end if;
    v_jumlah := v_jumlah_text::integer;
    if v_jumlah<=0 then raise exception 'Jumlah item anggaran harus bilangan bulat lebih dari nol.'; end if;
    if v_harga_satuan_text !~ '^([0-9]+(\.[0-9]{0,2})?|\.[0-9]{1,2})$' then raise exception 'Harga satuan anggaran harus nol atau lebih, maksimal dua desimal.'; end if;
    v_harga_satuan := v_harga_satuan_text::numeric(15,2);
    insert into proker_anggaran(proker_id,urutan,nama,jumlah_item,harga_satuan)
    values (p_id,v_urutan::integer-1,v_nama,v_jumlah,v_harga_satuan);
  end loop;
  return v_status_baru;
end $$;

revoke all on function ubah_proker_dengan_anggaran(uuid,text,text,text,text,boolean,date,date,text,jsonb,uuid,uuid) from public, anon;
grant execute on function ubah_proker_dengan_anggaran(uuid,text,text,text,text,boolean,date,date,text,jsonb,uuid,uuid) to authenticated;

create or replace function buat_evaluasi_dengan_anggaran(
  p_id uuid, p_proker_id uuid, p_hasil_kegiatan text, p_capaian_persen integer,
  p_rentang_waktu boolean, p_tanggal_mulai date, p_tanggal_selesai date,
  p_keterangan_tambahan text, p_anggaran jsonb, p_files jsonb
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  v_team uuid;
  v_item jsonb;
  v_ord bigint;
  v_nama text;
  v_qty text;
  v_harga_satuan_text text;
  v_file jsonb;
  v_path text;
  v_size bigint;
  v_mime text;
begin
  if auth.uid() is null then raise exception 'Silakan masuk untuk mengisi evaluasi.'; end if;
  select tim_kerja_id into v_team from profiles where id=auth.uid();
  if v_team is null or not exists(select 1 from proker where id=p_proker_id and tim_kerja_id=v_team and proker_status_efektif(id)='disetujui') then raise exception 'Evaluasi hanya dapat diisi untuk proker disetujui milik tim Anda.'; end if;
  if exists(select 1 from evaluasi where proker_id=p_proker_id) then raise exception 'Evaluasi sudah pernah dikirim.'; end if;
  if nullif(btrim(p_hasil_kegiatan),'') is null or p_capaian_persen not between 0 and 100 then raise exception 'Isi hasil kegiatan dan capaian 0 sampai 100.'; end if;
  if p_tanggal_mulai is null or p_tanggal_selesai is null or (p_rentang_waktu and p_tanggal_selesai<p_tanggal_mulai) or (not p_rentang_waktu and p_tanggal_selesai<>p_tanggal_mulai) then raise exception 'Periksa tanggal pelaksanaan.'; end if;
  if p_anggaran is null or jsonb_typeof(p_anggaran) is distinct from 'array' then raise exception 'Realisasi anggaran minimal satu item.'; end if;
  if jsonb_array_length(p_anggaran)<1 then raise exception 'Realisasi anggaran minimal satu item.'; end if;
  if p_files is null or jsonb_typeof(p_files) is distinct from 'array' then raise exception 'Daftar bukti tidak valid.'; end if;
  if jsonb_array_length(p_files)>10 then raise exception 'Maksimal 10 file bukti.'; end if;

  insert into evaluasi(id,proker_id,created_by,hasil_kegiatan,capaian_persen,rentang_waktu,tanggal_mulai,tanggal_selesai,keterangan_tambahan)
  values(p_id,p_proker_id,auth.uid(),btrim(p_hasil_kegiatan),p_capaian_persen,p_rentang_waktu,p_tanggal_mulai,p_tanggal_selesai,nullif(btrim(p_keterangan_tambahan),''));

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
    select (metadata->>'size')::bigint, metadata->>'mimetype' into v_size,v_mime from storage.objects where bucket_id='bukti-evaluasi' and name=v_path;
    if not found or v_size is null or v_size<1 or v_size>10485760 or v_mime not in ('image/jpeg','image/png','application/pdf') then raise exception 'File bukti tidak ditemukan atau tidak valid.'; end if;
    insert into evaluasi_file(evaluasi_id,storage_path,nama_file,mime_type,ukuran_bytes) values(p_id,v_path,btrim(coalesce(v_file->>'nama_file','bukti')),v_mime,v_size);
  end loop;
  return p_id;
end $$;

revoke all on function buat_evaluasi_dengan_anggaran(uuid,uuid,text,integer,boolean,date,date,text,jsonb,jsonb) from public,anon;
grant execute on function buat_evaluasi_dengan_anggaran(uuid,uuid,text,integer,boolean,date,date,text,jsonb,jsonb) to authenticated;
