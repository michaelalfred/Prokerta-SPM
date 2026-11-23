import { randomInt } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';

type Account = { lembaga: string; bidang: string; username: string };

async function main() {
  loadEnvConfig(process.cwd());
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    const missing = [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean).join(', ');
    throw new Error(`Env Supabase belum lengkap. Variabel yang belum tersedia: ${missing}. Isi di .env.local atau environment terminal.`);
  }
  const doc = readFileSync(path.join(process.cwd(), 'docs/06-seed-data.md'), 'utf8');
  const table = doc.split('## 2. Akun Ketua Bidang')[1] ?? '';
  const accounts: Account[] = table.split(/\r?\n/).filter((line) => line.startsWith('|') && !line.includes('---') && !line.includes('Lembaga |'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim().replaceAll('`', '')))
    .filter((row) => row.length === 3).map(([lembaga, bidang, username]) => ({ lembaga, bidang, username }));
  if (accounts.length !== 8) throw new Error(`Dokumen memiliki ${accounts.length} akun ketua; seed dibatalkan.`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const passwordFile = path.join(process.cwd(), 'supabase/seed/passwords-ketua-bidang.csv');
  let created = 0;
  for (const account of accounts) {
    const { data: institution, error: institutionError } = await supabase.from('lembaga').select('id').eq('nama', account.lembaga).maybeSingle();
    if (institutionError) throw new Error(`Lembaga ${account.lembaga} tidak dapat dibaca: ${institutionError.message}`);
    if (!institution) throw new Error(`Lembaga ${account.lembaga} belum ada di database. Pastikan seed struktur awal sudah dijalankan pada proyek Supabase yang sama.`);
    const { data: division, error: divisionError } = await supabase.from('bidang').select('id').eq('lembaga_id', institution.id).eq('nama', account.bidang).maybeSingle();
    if (divisionError) throw new Error(`Bidang ${account.bidang} tidak dapat dibaca: ${divisionError.message}`);
    if (!division) throw new Error(`Bidang ${account.bidang} belum ada di database. Pastikan seed struktur awal sudah dijalankan pada proyek Supabase yang sama.`);
    const { data: chair, error: chairError } = await supabase.from('profiles').select('id,username,role').eq('bidang_id', division.id).eq('role', 'ketua_bidang').maybeSingle();
    if (chairError) throw chairError;
    if (chair) {
      if (chair.username !== account.username) throw new Error(`${account.bidang} sudah memiliki akun ketua ${chair.username}; tidak diubah.`);
      continue;
    }
    const { data: usernameTaken, error: usernameError } = await supabase.from('profiles').select('id').eq('username', account.username).maybeSingle();
    if (usernameError) throw usernameError;
    if (usernameTaken) throw new Error(`Username ${account.username} sudah digunakan akun lain.`);
    const password = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const email = `${account.username}@${process.env.AUTH_EMAIL_DOMAIN || 'prokerta.local'}`;
    const { data: auth, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError || !auth.user) throw authError ?? new Error(`Auth ${account.username} gagal dibuat.`);
    const { error: profileError } = await supabase.from('profiles').insert({ id: auth.user.id, username: account.username, role: 'ketua_bidang', tim_kerja_id: null, bidang_id: division.id, nama_koordinator: null });
    if (profileError) {
      await supabase.auth.admin.deleteUser(auth.user.id);
      throw profileError;
    }
    const line = `${account.username},${password}\n`;
    if (!existsSync(passwordFile)) writeFileSync(passwordFile, `username,password\n${line}`, { flag: 'wx', mode: 0o600 });
    else appendFileSync(passwordFile, line, { mode: 0o600 });
    created++;
  }
  console.log(`${created} akun ketua bidang baru dibuat. Password ada di supabase/seed/passwords-ketua-bidang.csv hanya untuk akun baru.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
