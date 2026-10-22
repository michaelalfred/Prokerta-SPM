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
  v_nominal_text text;
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
    v_nama:=btrim(coalesce(v_item->>'nama','')); v_qty:=coalesce(v_item->>'jumlah_item',''); v_nominal_text:=coalesce(v_item->>'nominal','');
    if v_nama='' or v_qty !~ '^[0-9]+$' then raise exception 'Nama dan jumlah item realisasi anggaran wajib diisi dengan benar.'; end if;
    if v_qty::numeric<=0 or v_qty::numeric>2147483647 then raise exception 'Nama dan jumlah item realisasi anggaran wajib diisi dengan benar.'; end if;
    if v_nominal_text !~ '^([0-9]+(\.[0-9]{0,2})?|\.[0-9]{1,2})$' then raise exception 'Nominal anggaran harus nol atau lebih, maksimal dua desimal.'; end if;
    if v_nominal_text::numeric>9999999999999.99 then raise exception 'Nominal anggaran harus nol atau lebih, maksimal dua desimal.'; end if;
    insert into evaluasi_anggaran(evaluasi_id,urutan,nama,jumlah_item,nominal) values(p_id,v_ord::integer-1,v_nama,v_qty::integer,v_nominal_text::numeric(15,2));
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
