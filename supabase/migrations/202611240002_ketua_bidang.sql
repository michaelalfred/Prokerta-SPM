alter table profiles alter column tim_kerja_id drop not null;
alter table profiles drop constraint profiles_tim_kerja_id_key;
alter table profiles add column bidang_id uuid references bidang(id) on delete restrict;
alter table profiles add constraint profiles_scope_by_role check (
  (role = 'ketua_bidang' and tim_kerja_id is null and bidang_id is not null)
  or (role <> 'ketua_bidang' and tim_kerja_id is not null and bidang_id is null)
);
create unique index one_profile_per_team on profiles(tim_kerja_id) where tim_kerja_id is not null;
create unique index one_chair_per_division on profiles(bidang_id) where role = 'ketua_bidang';

create table ketua_bidang_izin (
  profile_id uuid not null references profiles(id) on delete cascade,
  bidang_id uuid not null references bidang(id) on delete restrict,
  primary key (profile_id, bidang_id)
);
alter table ketua_bidang_izin enable row level security;
create policy ketua_izin_read on ketua_bidang_izin for select to authenticated
  using (current_app_role() in ('admin','superadmin') or profile_id=auth.uid());
create policy ketua_izin_insert on ketua_bidang_izin for insert to authenticated
  with check (
    current_app_role() in ('admin','superadmin')
    and bidang_id is distinct from (select p.bidang_id from profiles p where p.id=profile_id and p.role='ketua_bidang')
    and exists(select 1 from profiles p where p.id=profile_id and p.role='ketua_bidang')
  );
create policy ketua_izin_delete on ketua_bidang_izin for delete to authenticated
  using (
    current_app_role() in ('admin','superadmin')
    and bidang_id is distinct from (select p.bidang_id from profiles p where p.id=profile_id and p.role='ketua_bidang')
    and exists(select 1 from profiles p where p.id=profile_id and p.role='ketua_bidang')
  );

create or replace function simpan_izin_ketua(p_profile_id uuid, p_bidang_ids uuid[]) returns void
language plpgsql security definer set search_path=public as $$
declare v_bidang_id uuid;
begin
  if current_app_role() not in ('admin','superadmin') then raise exception 'Tidak diizinkan.'; end if;
  if not exists(select 1 from profiles where id=p_profile_id and role='ketua_bidang') then raise exception 'Akun ketua bidang tidak ditemukan.'; end if;
  if coalesce(array_length(p_bidang_ids,1),0)>0 then
    foreach v_bidang_id in array p_bidang_ids loop
      if v_bidang_id=(select bidang_id from profiles where id=p_profile_id) then raise exception 'Bidang sendiri selalu diizinkan.'; end if;
    end loop;
  end if;
  delete from ketua_bidang_izin where profile_id=p_profile_id;
  insert into ketua_bidang_izin(profile_id,bidang_id)
    select p_profile_id, item from unnest(coalesce(p_bidang_ids,'{}'::uuid[])) item on conflict do nothing;
end $$;
revoke all on function simpan_izin_ketua(uuid,uuid[]) from public,anon;
grant execute on function simpan_izin_ketua(uuid,uuid[]) to authenticated;

create or replace function current_bidang_id() returns uuid
language sql stable security definer set search_path=public as $$
  select bidang_id from profiles where id=auth.uid()
$$;
revoke all on function current_bidang_id() from public,anon;
grant execute on function current_bidang_id() to authenticated;

create or replace function boleh_lihat_proker_tim(p_tim_kerja_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select case
    when current_app_role() in ('admin','superadmin') then true
    when current_app_role()='ketua_bidang' then exists(
      select 1 from tim_kerja tk
      where tk.id=p_tim_kerja_id and (
        tk.bidang_id=current_bidang_id()
        or exists(select 1 from ketua_bidang_izin i where i.profile_id=auth.uid() and i.bidang_id=tk.bidang_id)
      )
    )
    else p_tim_kerja_id=current_tim_kerja_id()
  end
$$;
revoke all on function boleh_lihat_proker_tim(uuid) from public,anon;
grant execute on function boleh_lihat_proker_tim(uuid) to authenticated;

create or replace function boleh_edit_proker_ketua(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select current_app_role()='ketua_bidang'
    and exists(
      select 1 from proker p join tim_kerja tk on tk.id=p.tim_kerja_id
      where p.id=p_id and tk.bidang_id=current_bidang_id()
        and proker_status_efektif(p.id) in ('menunggu','ditinjau','ditolak','direvisi')
    )
$$;
revoke all on function boleh_edit_proker_ketua(uuid) from public,anon;
grant execute on function boleh_edit_proker_ketua(uuid) to authenticated;

-- Trigger lama menjaga update langsung; RPC ini menjadi satu-satunya jalur edit ketua bidang.
create or replace function guard_proker_update() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if current_setting('app.proker_edit_rpc_id',true)=old.id::text
    and current_app_role()='ketua_bidang'
    and boleh_edit_proker_ketua(old.id) then
    return new;
  end if;
  if current_setting('app.status_rpc_id',true)=old.id::text and current_app_role() in ('admin','superadmin') then return new; end if;
  if current_app_role() in ('admin','superadmin') and old.tim_kerja_id=current_tim_kerja_id() and proker_status_efektif(old.id)='menunggu' then
    if new.status<>old.status or new.tim_kerja_id<>old.tim_kerja_id or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis then raise exception 'Perubahan proker tidak diizinkan'; end if;
  elsif current_app_role() in ('admin','superadmin') then
    if proker_status_efektif(old.id) not in ('ditinjau','ditolak','direvisi') or new.tim_kerja_id<>old.tim_kerja_id or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis then raise exception 'Perubahan proker tidak diizinkan'; end if;
    if new.status<>old.status and new.status<>'direvisi' then raise exception 'Perubahan status harus melalui fungsi set_proker_status'; end if;
    if new.status='direvisi' and new.status is distinct from old.status and (to_jsonb(new)-'status'-'updated_at')=(to_jsonb(old)-'status'-'updated_at') then raise exception 'Perubahan status harus melalui fungsi set_proker_status'; end if;
    if new.status<>'direvisi' then raise exception 'Proker yang diedit harus berstatus direvisi'; end if;
  elsif current_app_role()='user' and (old.tim_kerja_id<>current_tim_kerja_id() or proker_status_efektif(old.id)<>'menunggu' or new.status<>old.status or new.tahun_program<>old.tahun_program or new.jenis<>old.jenis or new.tim_kerja_id<>old.tim_kerja_id) then
    raise exception 'Perubahan proker tidak diizinkan';
  else
    raise exception 'Perubahan proker tidak diizinkan';
  end if;
  return new;
end $$;

drop policy proker_read on proker;
create policy proker_read on proker for select to authenticated
  using (boleh_lihat_proker_tim(tim_kerja_id));

drop policy proker_cost_read on proker_anggaran;
create policy proker_cost_read on proker_anggaran for select to authenticated
  using (exists(select 1 from proker p where p.id=proker_id and boleh_lihat_proker_tim(p.tim_kerja_id)));

drop policy eval_read on evaluasi;
create policy eval_read on evaluasi for select to authenticated
  using (exists(select 1 from proker p where p.id=proker_id and boleh_lihat_proker_tim(p.tim_kerja_id)));
drop policy eval_cost_read on evaluasi_anggaran;
create policy eval_cost_read on evaluasi_anggaran for select to authenticated
  using (exists(select 1 from evaluasi e join proker p on p.id=e.proker_id where e.id=evaluasi_id and boleh_lihat_proker_tim(p.tim_kerja_id)));
drop policy eval_file_read on evaluasi_file;
create policy eval_file_read on evaluasi_file for select to authenticated
  using (exists(select 1 from evaluasi e join proker p on p.id=e.proker_id where e.id=evaluasi_id and boleh_lihat_proker_tim(p.tim_kerja_id)));

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
language plpgsql security definer set search_path=public as $$
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
  v_status_efektif:=proker_status_efektif(p_id);

  if v_profile.role='ketua_bidang' then
    if not boleh_edit_proker_ketua(p_id) then raise exception 'Ketua bidang hanya dapat mengedit proker bidangnya yang belum disetujui.'; end if;
    v_status_baru:=case when v_status_efektif in ('ditinjau','ditolak') then 'direvisi'::status_proker else v_proker.status end;
  elsif v_status_efektif='menunggu' and v_proker.tim_kerja_id=v_profile.tim_kerja_id then
    v_status_baru:=v_proker.status;
  elsif v_profile.role in ('admin','superadmin') and v_status_efektif in ('ditinjau','ditolak','direvisi') then
    v_status_baru:='direvisi';
  else
    raise exception 'Anda tidak berhak mengubah proker ini.';
  end if;

  if coalesce(nullif(btrim(p_sasaran_program),''),null) is null
    or coalesce(nullif(btrim(p_indikator_keberhasilan),''),null) is null
    or coalesce(nullif(btrim(p_target),''),null) is null
    or coalesce(nullif(btrim(p_nama_kegiatan),''),null) is null
    or coalesce(nullif(btrim(p_penanggung_jawab),''),null) is null then raise exception 'Semua field proker wajib diisi.'; end if;
  if p_tanggal_mulai is null or p_tanggal_selesai is null
    or (p_rentang_waktu and p_tanggal_selesai<p_tanggal_mulai)
    or (not p_rentang_waktu and p_tanggal_selesai<>p_tanggal_mulai) then raise exception 'Periksa tanggal waktu pelaksanaan.'; end if;
  if p_anggaran is null or jsonb_typeof(p_anggaran) is distinct from 'array' or jsonb_array_length(p_anggaran)<1 then raise exception 'Rincian biaya minimal satu item.'; end if;

  if v_proker.jenis='visioner' then
    select visi into v_visi from visi_misi where singleton=true;
    if not found or nullif(btrim(v_visi),'') is null then raise exception 'Data Visi-Misi belum tersedia.'; end if;
    select * into v_misi from misi where id=p_misi_id;
    if not found or nullif(btrim(v_misi.teks),'') is null or nullif(btrim(v_misi.outcome),'') is null then raise exception 'Pilih Misi yang valid.'; end if;
    select * into v_milestone from milestone where id=p_milestone_id and misi_id=p_misi_id;
    if not found or nullif(btrim(v_milestone.teks),'') is null then raise exception 'Pilih Milestone dari Misi yang dipilih.'; end if;
  elsif p_misi_id is not null or p_milestone_id is not null then raise exception 'Misi dan Milestone hanya berlaku untuk proker Visioner.'; end if;

  perform set_config('app.proker_edit_rpc_id',p_id::text,true);
  update proker set
    misi_id=case when v_proker.jenis='visioner' then p_misi_id else null end,
    milestone_id=case when v_proker.jenis='visioner' then p_milestone_id else null end,
    visi_teks=case when v_proker.jenis='visioner' then v_visi else null end,
    misi_teks=case when v_proker.jenis='visioner' then v_misi.teks else null end,
    outcome_teks=case when v_proker.jenis='visioner' then v_misi.outcome else null end,
    milestone_teks=case when v_proker.jenis='visioner' then v_milestone.teks else null end,
    sasaran_program=btrim(p_sasaran_program),indikator_keberhasilan=btrim(p_indikator_keberhasilan),target=btrim(p_target),
    nama_kegiatan=btrim(p_nama_kegiatan),rentang_waktu=p_rentang_waktu,tanggal_mulai=p_tanggal_mulai,
    tanggal_selesai=p_tanggal_selesai,penanggung_jawab=btrim(p_penanggung_jawab),status=v_status_baru where id=p_id;

  delete from proker_anggaran where proker_id=p_id;
  for v_item,v_urutan in select value,ordinality from jsonb_array_elements(p_anggaran) with ordinality as biaya(value,ordinality) loop
    v_nama:=btrim(coalesce(v_item->>'nama','')); v_jumlah_text:=coalesce(v_item->>'jumlah_item',''); v_harga_satuan_text:=coalesce(v_item->>'harga_satuan','');
    if v_nama='' or v_jumlah_text !~ '^[0-9]+$' then raise exception 'Nama dan jumlah item anggaran wajib diisi dengan benar.'; end if;
    v_jumlah:=v_jumlah_text::integer; if v_jumlah<=0 then raise exception 'Jumlah item anggaran harus bilangan bulat lebih dari nol.'; end if;
    if v_harga_satuan_text !~ '^([0-9]+(\.[0-9]{0,2})?|\.[0-9]{1,2})$' then raise exception 'Harga satuan anggaran harus nol atau lebih, maksimal dua desimal.'; end if;
    v_harga_satuan:=v_harga_satuan_text::numeric(15,2);
    insert into proker_anggaran(proker_id,urutan,nama,jumlah_item,harga_satuan) values(p_id,v_urutan::integer-1,v_nama,v_jumlah,v_harga_satuan);
  end loop;
  return v_status_baru;
end $$;
revoke all on function ubah_proker_dengan_anggaran(uuid,text,text,text,text,boolean,date,date,text,jsonb,uuid,uuid) from public,anon;
grant execute on function ubah_proker_dengan_anggaran(uuid,text,text,text,text,boolean,date,date,text,jsonb,uuid,uuid) to authenticated;
