export type Status = 'menunggu' | 'ditinjau' | 'disetujui' | 'ditolak' | 'direvisi';
export type StatusTeam = { lembaga_id: string; lembaga: string; bidang_id: string; bidang: string; tim_kerja_id: string; tim_kerja: string } & Record<Status | 'total', number | string>;
export type ComplianceTeam = { lembaga_id: string; lembaga: string; bidang_id: string; bidang: string; tim_kerja_id: string; tim_kerja: string; disetujui: number | string; sudah_dievaluasi: number | string; belum_dievaluasi: number | string };
export type AchievementTeam = { lembaga_id: string; lembaga: string; bidang_id: string; bidang: string; tim_kerja_id: string; tim_kerja: string; jumlah_evaluasi: number | string; rata_rata: number | string | null; rentang_0_49: number | string; rentang_50_79: number | string; rentang_80_100: number | string };
export type MissionAnalysisRow = { di_luar_set: boolean; misi_id: string | null; milestone_id: string | null; misi_teks: string; milestone_teks: string | null };

const n = (v: number | string | null | undefined) => Number(v ?? 0);
export function sumStatus(rows: StatusTeam[]) {
  return rows.reduce((a, r) => ({ menunggu: a.menunggu+n(r.menunggu), ditinjau:a.ditinjau+n(r.ditinjau), disetujui:a.disetujui+n(r.disetujui), ditolak:a.ditolak+n(r.ditolak), direvisi:a.direvisi+n(r.direvisi), total:a.total+n(r.total) }), {menunggu:0,ditinjau:0,disetujui:0,ditolak:0,direvisi:0,total:0});
}
export function sumCompliance(rows: ComplianceTeam[]) {
  return rows.reduce((a,r)=>({approved:a.approved+n(r.disetujui),done:a.done+n(r.sudah_dievaluasi),pending:a.pending+n(r.belum_dievaluasi)}),{approved:0,done:0,pending:0});
}
export function groupByDivision<T extends { bidang_id: string; bidang: string }>(rows: T[]) {
  const map = new Map<string, { id: string; nama: string; rows: T[] }>();
  for (const row of rows) { const item = map.get(row.bidang_id) ?? {id:row.bidang_id,nama:row.bidang,rows:[]}; item.rows.push(row); map.set(row.bidang_id,item); }
  return [...map.values()];
}
export function compliancePercent(sudah: number | string, disetujui: number | string): number | null { const den=n(disetujui); return den === 0 ? null : Math.round(n(sudah)*100/den); }
export function combineAchievement(rows: AchievementTeam[]) {
  const count=rows.reduce((s,r)=>s+n(r.jumlah_evaluasi),0);
  const weighted=rows.reduce((s,r)=>s+n(r.jumlah_evaluasi)*n(r.rata_rata),0);
  return { count, average: count ? weighted/count : null,
    ranges:[rows.reduce((s,r)=>s+n(r.rentang_0_49),0),rows.reduce((s,r)=>s+n(r.rentang_50_79),0),rows.reduce((s,r)=>s+n(r.rentang_80_100),0)] as [number,number,number] };
}
export function groupMissionRows<T extends MissionAnalysisRow>(rows: T[]) {
  const groups=new Map<string,T[]>();
  for(const row of rows){
    const key=row.di_luar_set?`snapshot:${row.misi_teks}\u0000${row.milestone_teks??''}`:`ids:${row.misi_id??'∅'}:${row.milestone_id??'∅'}`;
    groups.set(key,[...(groups.get(key)??[]),row]);
  }
  return [...groups.entries()].map(([key,items])=>({key,items}));
}
