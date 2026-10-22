create or replace function assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if current_app_role() not in ('admin','superadmin') then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
end $$;
revoke all on function assert_admin() from public, anon;
grant execute on function assert_admin() to authenticated;

create or replace view analisis_proker_dasar with (security_invoker = true) as
select p.id as proker_id, p.tahun_program, p.jenis, p.status_efektif,
       p.nama_kegiatan, p.tanggal_mulai, p.tanggal_selesai,
       p.misi_id, p.milestone_id, p.misi_teks, p.milestone_teks,
       tk.id as tim_kerja_id, tk.nama as tim_kerja,
       b.id as bidang_id, b.nama as bidang,
       l.id as lembaga_id, l.nama as lembaga,
       e.id as evaluasi_id, e.capaian_persen
from proker_v p
join tim_kerja tk on tk.id = p.tim_kerja_id
join bidang b on b.id = tk.bidang_id
join lembaga l on l.id = b.lembaga_id
left join evaluasi e on e.proker_id = p.id;

create or replace function analisis_status(p_tahun int, p_lembaga uuid default null)
returns table(lembaga_id uuid, lembaga text, bidang_id uuid, bidang text, tim_kerja_id uuid, tim_kerja text,
  menunggu bigint, ditinjau bigint, disetujui bigint, ditolak bigint, direvisi bigint, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query select d.lembaga_id,d.lembaga,d.bidang_id,d.bidang,d.tim_kerja_id,d.tim_kerja,
    count(*) filter(where d.status_efektif='menunggu'), count(*) filter(where d.status_efektif='ditinjau'),
    count(*) filter(where d.status_efektif='disetujui'), count(*) filter(where d.status_efektif='ditolak'),
    count(*) filter(where d.status_efektif='direvisi'), count(d.proker_id)
  from analisis_proker_dasar d where d.tahun_program=p_tahun and (p_lembaga is null or d.lembaga_id=p_lembaga)
  group by d.lembaga_id,d.lembaga,d.bidang_id,d.bidang,d.tim_kerja_id,d.tim_kerja
  order by d.lembaga,d.bidang,d.tim_kerja;
end $$;

create or replace function analisis_evaluasi_kepatuhan(p_tahun int, p_lembaga uuid default null)
returns table(lembaga_id uuid, lembaga text, bidang_id uuid, bidang text, tim_kerja_id uuid, tim_kerja text,
  disetujui bigint, sudah_dievaluasi bigint, belum_dievaluasi bigint, daftar_belum jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query select d.lembaga_id,d.lembaga,d.bidang_id,d.bidang,d.tim_kerja_id,d.tim_kerja,
    count(*) filter(where d.status_efektif='disetujui'), count(*) filter(where d.status_efektif='disetujui' and d.evaluasi_id is not null),
    count(*) filter(where d.status_efektif='disetujui' and d.evaluasi_id is null),
    coalesce(jsonb_agg(jsonb_build_object('proker_id',d.proker_id,'nama_kegiatan',d.nama_kegiatan,'tanggal_mulai',d.tanggal_mulai,'tanggal_selesai',d.tanggal_selesai)
      order by d.tanggal_selesai asc) filter(where d.status_efektif='disetujui' and d.evaluasi_id is null),'[]'::jsonb)
  from analisis_proker_dasar d where d.tahun_program=p_tahun and (p_lembaga is null or d.lembaga_id=p_lembaga)
  group by d.lembaga_id,d.lembaga,d.bidang_id,d.bidang,d.tim_kerja_id,d.tim_kerja
  order by d.lembaga,d.bidang,d.tim_kerja;
end $$;

create or replace function analisis_capaian(p_tahun int, p_lembaga uuid default null)
returns table(lembaga_id uuid, lembaga text, bidang_id uuid, bidang text, tim_kerja_id uuid, tim_kerja text,
  jumlah_evaluasi bigint, rata_rata numeric, rentang_0_49 bigint, rentang_50_79 bigint, rentang_80_100 bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query select l.id,l.nama,b.id,b.nama,tk.id,tk.nama,count(d.evaluasi_id),avg(d.capaian_persen),
    count(d.evaluasi_id) filter(where d.capaian_persen between 0 and 49),
    count(d.evaluasi_id) filter(where d.capaian_persen between 50 and 79),
    count(d.evaluasi_id) filter(where d.capaian_persen between 80 and 100)
  from tim_kerja tk join bidang b on b.id=tk.bidang_id join lembaga l on l.id=b.lembaga_id
  left join analisis_proker_dasar d on d.tim_kerja_id=tk.id and d.tahun_program=p_tahun and d.evaluasi_id is not null
  where p_lembaga is null or l.id=p_lembaga
  group by l.id,l.nama,b.id,b.nama,tk.id,tk.nama order by l.nama,b.nama,tk.nama;
end $$;

create or replace function analisis_misi_milestone(p_tahun int, p_lembaga uuid default null)
returns table(level text, di_luar_set boolean, misi_id uuid, nomor_misi int, misi_teks text, outcome text,
  milestone_id uuid, nomor_milestone int, milestone_teks text, jumlah_proker bigint, tim_kerja_list jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_admin();
  return query
  with eligible as (
    select d.* from analisis_proker_dasar d where d.tahun_program=p_tahun and d.jenis='visioner'
      and d.status_efektif<>'ditolak' and (p_lembaga is null or d.lembaga_id=p_lembaga)
  ), mission_rows as (
    select 'misi'::text lvl,false::boolean outside_set,m.id mid,m.nomor mn,m.teks mt,m.outcome oc,
      null::uuid msid,null::int msn,null::text mst,count(distinct e.proker_id)::bigint cnt,'[]'::jsonb teams
    from misi m left join eligible e on e.misi_id=m.id group by m.id,m.nomor,m.teks,m.outcome
  ), milestone_rows as (
    select 'milestone'::text lvl,false::boolean outside_set,m.id mid,m.nomor mn,m.teks mt,m.outcome oc,
      s.id msid,s.nomor msn,s.teks mst,count(distinct e.proker_id)::bigint cnt,
      coalesce(jsonb_agg(distinct jsonb_build_object('id',e.tim_kerja_id,'nama',e.tim_kerja)) filter(where e.proker_id is not null),'[]'::jsonb) teams
    from misi m join milestone s on s.misi_id=m.id left join eligible e on e.misi_id=m.id and e.milestone_id=s.id
    group by m.id,m.nomor,m.teks,m.outcome,s.id,s.nomor,s.teks
  ), outside_rows as (
    select 'milestone'::text lvl,true::boolean outside_set,e.misi_id mid,null::int mn,
      coalesce(e.misi_teks,'Misi tidak tersedia') mt,null::text oc,e.milestone_id msid,null::int msn,
      coalesce(e.milestone_teks,'Milestone tidak tersedia') mst,count(distinct e.proker_id)::bigint cnt,
      coalesce(jsonb_agg(distinct jsonb_build_object('id',e.tim_kerja_id,'nama',e.tim_kerja)),'[]'::jsonb) teams
    from eligible e left join misi m on m.id=e.misi_id left join milestone s on s.id=e.milestone_id
    where (e.misi_id is not null and m.id is null) or (e.milestone_id is not null and s.id is null) or e.misi_id is null or e.milestone_id is null
    group by e.misi_id,e.misi_teks,e.milestone_id,e.milestone_teks
  )
  select lvl,outside_set,mid,mn,mt,oc,msid,msn,mst,cnt,teams from mission_rows
  union all select lvl,outside_set,mid,mn,mt,oc,msid,msn,mst,cnt,teams from milestone_rows
  union all select lvl,outside_set,mid,mn,mt,oc,msid,msn,mst,cnt,teams from outside_rows
  order by 2, 4 nulls last, 8 nulls last;
end $$;

revoke all on function analisis_status(int,uuid) from public, anon;
revoke all on function analisis_evaluasi_kepatuhan(int,uuid) from public, anon;
revoke all on function analisis_capaian(int,uuid) from public, anon;
revoke all on function analisis_misi_milestone(int,uuid) from public, anon;
grant execute on function analisis_status(int,uuid) to authenticated;
grant execute on function analisis_evaluasi_kepatuhan(int,uuid) to authenticated;
grant execute on function analisis_capaian(int,uuid) to authenticated;
grant execute on function analisis_misi_milestone(int,uuid) to authenticated;
