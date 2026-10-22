import { randomInt } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Sumber data akun adalah dokumen pemilik; username selain dua akun resmi tetap usulan O2.
const doc = readFileSync(path.join(process.cwd(), 'docs/06-seed-data.md'), 'utf8');
const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
const passwordFile = path.join(process.cwd(), 'supabase/seed/passwords.csv');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Env Supabase belum lengkap.');

type Account = { lembaga: string; bidang: string; tim: string; role: 'superadmin' | 'admin' | 'user'; username: string };
const accounts: Account[] = [];
let lembaga = '';
let bidang = '';
let section = '';
for (const line of doc.split(/\r?\n/)) {
  const heading = line.match(/^### Lembaga: (.+)$/);
  if (heading) { lembaga = heading[1]; bidang = ''; section = heading[0]; continue; }
  if (line.startsWith('### ')) { section = line; continue; }
  if (section !== '### Lembaga: Pastor Paroki' && section !== '### Lembaga: Dewan Pastoral Paroki (DPP)' && section !== '### Lembaga: Dewan Keuangan Paroki (DKP)') continue;
  if (!line.startsWith('|') || line.includes('---') || line.includes('Bidang |')) continue;
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  if (cells.length !== 4) continue;
  if (cells[0]) bidang = cells[0];
  const team = cells[1];
  const role = cells[2].replaceAll('*', '');
  const username = cells[3].replaceAll('`', '');
  if (!team || !username || !['user', 'admin', 'superadmin'].includes(role)) continue;
  accounts.push({ lembaga, bidang, tim: team, role: role as Account['role'], username });
}

async function main() {
  if (accounts.length !== 37) throw new Error(`Data akun di docs berjumlah ${accounts.length}, seharusnya 37. Seed dibatalkan.`);
  let newPasswordCount = 0;
  for (const [index, account] of accounts.entries()) {
    const institutionResult = await admin.from('lembaga').select('id').eq('nama', account.lembaga).maybeSingle();
    let institution = institutionResult.data;
    if (institutionResult.error) throw institutionResult.error;
    if (!institution) {
      const result = await admin.from('lembaga').insert({ nama: account.lembaga, urutan: index }).select('id').single();
      if (result.error) throw result.error;
      institution = result.data;
    }
    const divisionResult = await admin.from('bidang').select('id').eq('lembaga_id', institution.id).eq('nama', account.bidang).maybeSingle();
    let division = divisionResult.data;
    if (divisionResult.error) throw divisionResult.error;
    if (!division) {
      const result = await admin.from('bidang').insert({ lembaga_id: institution.id, nama: account.bidang, urutan: index }).select('id').single();
      if (result.error) throw result.error;
      division = result.data;
    }
    const teamResult = await admin.from('tim_kerja').select('id').eq('bidang_id', division.id).eq('nama', account.tim).maybeSingle();
    let team = teamResult.data;
    if (teamResult.error) throw teamResult.error;
    if (!team) {
      const result = await admin.from('tim_kerja').insert({ bidang_id: division.id, nama: account.tim, urutan: index }).select('id').single();
      if (result.error) throw result.error;
      team = result.data;
    }
    const { data: existing } = await admin.from('profiles').select('id').eq('username', account.username).maybeSingle();
    let userId = existing?.id;
    let password = '';
    if (!userId) {
      password = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const result = await admin.auth.admin.createUser({ email: `${account.username}@${process.env.AUTH_EMAIL_DOMAIN || 'prokerta.local'}`, password, email_confirm: true });
      if (result.error) throw result.error;
      userId = result.data.user.id;
      const profile = await admin.from('profiles').insert({ id: userId, username: account.username, role: account.role, tim_kerja_id: team.id, nama_koordinator: null });
      if (profile.error) throw profile.error;
      const csvLine = `${account.username},${password}\n`;
      if (!existsSync(passwordFile)) writeFileSync(passwordFile, `username,password\n${csvLine}`, { flag: 'wx', mode: 0o600 });
      else appendFileSync(passwordFile, csvLine, { mode: 0o600 });
      newPasswordCount++;
    } else {
      const profile = await admin.from('profiles').update({ role: account.role, tim_kerja_id: team.id }).eq('id', userId);
      if (profile.error) throw profile.error;
    }
  }
  const vision = doc.match(/\*\*Visi\*\*\s+([\s\S]*?)\r?\n\r?\n\*\*Misi 1\*\*/)?.[1]?.trim();
  if (!vision) throw new Error('Teks Visi tidak ditemukan pada dokumen seed.');
  const visionResult = await admin.from('visi_misi').upsert({ singleton: true, visi: vision }, { onConflict: 'singleton' });
  if (visionResult.error) throw visionResult.error;
  for (let number = 1; number <= 7; number++) {
    const sectionText = doc.match(new RegExp(`\\*\\*Misi ${number}\\*\\*([\\s\\S]*?)(?=\\n\\n\\*\\*Misi ${number + 1}\\*\\*|\\n\\n### Perubahan yang dibuat|$)`))?.[1];
    if (!sectionText) throw new Error(`Misi ${number} tidak ditemukan.`);
    const missionText = sectionText.match(/—\s*(.+)/)?.[1]?.trim();
    const outcome = sectionText.match(/- Outcomes:\s*(.+)/)?.[1]?.trim();
    const milestones = [...sectionText.matchAll(/^\s*(?:-\s*)?(\d+)\.\s+(.+)$/gm)].map((match) => ({ nomor: Number(match[1]), teks: match[2].trim() }));
    if (!missionText || !outcome || milestones.length === 0) throw new Error(`Isi Misi ${number} tidak lengkap.`);
    let { data: mission } = await admin.from('misi').select('id').eq('nomor', number).maybeSingle();
    if (mission) {
      const updated = await admin.from('misi').update({ teks: missionText, outcome }).eq('id', mission.id);
      if (updated.error) throw updated.error;
    } else {
      const created = await admin.from('misi').insert({ nomor: number, teks: missionText, outcome }).select('id').single();
      if (created.error) throw created.error;
      mission = created.data;
    }
    const deleted = await admin.from('milestone').delete().eq('misi_id', mission.id);
    if (deleted.error) throw deleted.error;
    const inserted = await admin.from('milestone').insert(milestones.map((item) => ({ ...item, misi_id: mission.id })));
    if (inserted.error) throw inserted.error;
  }
  if (newPasswordCount > 0) {
    console.log(`Password baru ditulis sekali ke ${passwordFile}. Bagikan kepada pemilik lalu hapus file ini.`);
  } else {
    console.log('Semua akun sudah ada; tidak ada password baru yang dibuat.');
  }
  console.log('Seed struktur, Visi-Misi, dan akun selesai.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
