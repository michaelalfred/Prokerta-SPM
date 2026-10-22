import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { currentProfile } from '@/lib/auth';
import { formatRupiah, hitungTotalAnggaran } from '@/lib/rules/anggaran';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function dateLabel(value:string){return new Date(`${value}T12:00:00+07:00`).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'long',year:'numeric'});}
export default async function EvaluationDetailPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const profile=await currentProfile(); if(profile.role==='user') redirect('/proker');
 const supabase=await createClient(); const {data:evaluation,error}=await supabase.from('evaluasi').select('*').eq('id',id).maybeSingle(); if(error||!evaluation) notFound();
 const [{data:proker},{data:budget},{data:files}]=await Promise.all([
  supabase.from('proker_v').select('*').eq('id',evaluation.proker_id).single(),
  supabase.from('evaluasi_anggaran').select('*').eq('evaluasi_id',id).order('urutan'),
  supabase.from('evaluasi_file').select('*').eq('evaluasi_id',id).order('created_at'),
 ]); if(!proker) notFound();
 const {data:rawTeam}=await supabase.from('tim_kerja').select('nama,bidang(nama,lembaga(nama))').eq('id',proker.tim_kerja_id).single();
 const team=rawTeam as unknown as {nama:string;bidang:{nama:string;lembaga:{nama:string}}}|null;
 const storage=createAdminClient().storage.from('bukti-evaluasi');
 const signed=await Promise.all((files??[]).map(async(file)=>({file,...((await storage.createSignedUrl(file.storage_path,60)).data??{})})));
 const totalRealisasi=hitungTotalAnggaran((budget??[]).map((item)=>({nominal:item.nominal})));
 return <article className="mx-auto grid min-w-0 max-w-4xl gap-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Detail Evaluasi</h1><Link href="/evaluasi" className="rounded-lg border border-[var(--border)] px-4 py-2">Kembali ke daftar</Link></div><section className="grid min-w-0 max-w-full gap-3 rounded-xl border border-[var(--border)] p-5 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Proker</h2><p className="break-words"><strong>Nama Kegiatan:</strong> {proker.nama_kegiatan}</p><p><strong>Tahun Program:</strong> {proker.tahun_program}</p><p className="break-words"><strong>Lembaga:</strong> {team?.bidang.lembaga.nama}</p><p className="break-words"><strong>Bidang:</strong> {team?.bidang.nama}</p><p className="break-words"><strong>Tim Kerja:</strong> {team?.nama}</p></section><section className="grid min-w-0 max-w-full gap-3 rounded-xl border border-[var(--border)] p-5"><h2 className="font-semibold">Hasil Evaluasi</h2><p className="break-words"><strong>Hasil Kegiatan:</strong><br/>{evaluation.hasil_kegiatan}</p><p><strong>Capaian:</strong> {evaluation.capaian_persen}%</p><p><strong>Waktu:</strong> {evaluation.rentang_waktu?`${dateLabel(evaluation.tanggal_mulai)} – ${dateLabel(evaluation.tanggal_selesai)}`:dateLabel(evaluation.tanggal_mulai)}</p>{evaluation.keterangan_tambahan&&<p className="break-words"><strong>Keterangan Tambahan:</strong><br/>{evaluation.keterangan_tambahan}</p>}<h3 className="font-medium">Realisasi Anggaran</h3>{(budget??[]).map((item)=><p key={item.id} className="break-words">{item.nama} · {item.jumlah_item} item · {formatRupiah(String(item.nominal))}</p>)}<p className="text-right font-semibold">Total Realisasi: {formatRupiah(totalRealisasi)}</p>{signed.length>0&&<><h3 className="font-medium">Foto / Bukti</h3><div className="grid gap-3 sm:grid-cols-2">{signed.map(({file,signedUrl})=>file.mime_type.startsWith('image/')&&signedUrl?<a key={file.id} href={signedUrl} target="_blank" rel="noreferrer"><Image unoptimized width={640} height={480} src={signedUrl} alt={file.nama_file} className="max-h-72 w-auto max-w-full rounded-lg object-contain"/></a>:signedUrl?<a key={file.id} href={signedUrl} target="_blank" rel="noreferrer" className="break-all text-blue-700 underline">Buka PDF: {file.nama_file}</a>:<p key={file.id}>{file.nama_file} (tidak dapat dibuka)</p>)}</div></>}</section></article>;
}
