import test from 'node:test';
import assert from 'node:assert/strict';
import { combineAchievement, compliancePercent, groupByDivision, groupMissionRows, sumCompliance, sumStatus, type AchievementTeam, type ComplianceTeam, type StatusTeam } from './analisis';

const base={lembaga_id:'l',lembaga:'L',bidang_id:'b',bidang:'B'};
test('status menjumlahkan tim untuk tingkat bidang/lembaga',()=>{
 const rows=[{...base,tim_kerja_id:'t1',tim_kerja:'T1',menunggu:1,ditinjau:0,disetujui:2,ditolak:0,direvisi:0,total:3},{...base,tim_kerja_id:'t2',tim_kerja:'T2',menunggu:0,ditinjau:1,disetujui:1,ditolak:0,direvisi:0,total:2}] as StatusTeam[];
 assert.equal(sumStatus(rows).total,5); assert.equal(sumStatus(rows).disetujui,3); assert.equal(groupByDivision(rows).length,1);
});
test('persentase kepatuhan dan pembagian nol',()=>{assert.equal(compliancePercent(3,4),75);assert.equal(compliancePercent(0,0),null);const rows=[{...base,tim_kerja_id:'t',tim_kerja:'T',disetujui:4,sudah_dievaluasi:3,belum_dievaluasi:1}] as ComplianceTeam[];assert.deepEqual(sumCompliance(rows),{approved:4,done:3,pending:1});});
test('capaian menggabungkan rata-rata berbobot evaluasi dan rentang',()=>{const rows=[{...base,tim_kerja_id:'1',tim_kerja:'A',jumlah_evaluasi:2,rata_rata:40,rentang_0_49:2,rentang_50_79:0,rentang_80_100:0},{...base,tim_kerja_id:'2',tim_kerja:'B',jumlah_evaluasi:1,rata_rata:100,rentang_0_49:0,rentang_50_79:0,rentang_80_100:1}] as AchievementTeam[];assert.deepEqual(combineAchievement(rows),{count:3,average:60,ranges:[2,0,1]});assert.equal(combineAchievement([]).average,null);});
test('peta misi mengelompokkan dengan ID dan snapshot untuk rujukan di luar set',()=>{const rows=[{di_luar_set:false,misi_id:'same',milestone_id:'m1',misi_teks:'Sama',milestone_teks:'Langkah'},{di_luar_set:false,misi_id:'same',milestone_id:'m2',misi_teks:'Sama',milestone_teks:'Langkah'},{di_luar_set:true,misi_id:null,milestone_id:null,misi_teks:'Snapshot',milestone_teks:'Lama'}];const groups=groupMissionRows(rows);assert.equal(groups.length,3);});
