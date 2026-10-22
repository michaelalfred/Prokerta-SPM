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
  v_nominal_text text;
  v_nominal numeric(15,2);
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
    v_nominal_text := coalesce(v_item->>'nominal', '');
    if v_nama = '' or v_jumlah_text !~ '^[0-9]+$' then
      raise exception 'Nama dan jumlah item anggaran wajib diisi dengan benar.';
    end if;
    v_jumlah := v_jumlah_text::integer;
    if v_jumlah <= 0 then
      raise exception 'Jumlah item anggaran harus bilangan bulat lebih dari nol.';
    end if;
    if v_nominal_text !~ '^([0-9]+(\.[0-9]{0,2})?|\.[0-9]{1,2})$' then
      raise exception 'Nominal anggaran harus nol atau lebih, maksimal dua desimal.';
    end if;
    v_nominal := v_nominal_text::numeric(15,2);
    insert into proker_anggaran(proker_id, urutan, nama, jumlah_item, nominal)
    values (v_proker_id, v_urutan::integer - 1, v_nama, v_jumlah, v_nominal);
  end loop;

  return v_proker_id;
end;
$$;

revoke all on function buat_proker_dengan_anggaran(jenis_proker, text, text, text, text, boolean, date, date, text, jsonb, uuid, uuid) from public, anon;
grant execute on function buat_proker_dengan_anggaran(jenis_proker, text, text, text, text, boolean, date, date, text, jsonb, uuid, uuid) to authenticated;
