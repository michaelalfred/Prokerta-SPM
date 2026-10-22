# Prokerta SPM

Aplikasi pendataan dan evaluasi program kerja Paroki Santa Maria Purworejo.

## Kebutuhan

- Node.js 20 atau lebih baru dan npm.
- Proyek Supabase.
- Bucket privat `bukti-evaluasi` dibuat oleh migration awal.

## Menjalankan secara lokal

1. Pasang dependensi: `npm install`.
2. Salin `.env.example` menjadi `.env.local` dan isi:

   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: publishable/anon key.
   - `SUPABASE_SERVICE_ROLE_KEY`: secret/service role key; hanya dipakai proses server dan skrip seed.
   - `AUTH_EMAIL_DOMAIN`: domain email internal Auth, default `prokerta.local`.

3. Jalankan migration SQL sesuai urutan di bagian Database.
4. Pastikan akun usulan pada `docs/06-seed-data.md` sudah disetujui sebelum menjalankan seed. Jalankan `npm run seed`. Password awal ditulis satu kali ke `supabase/seed/passwords.csv`; bagikan dengan aman lalu hapus file lokal tersebut.
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000`.

## Database Supabase melalui dashboard web

Di Supabase Dashboard, buka **SQL Editor**. Untuk setiap berkas di bawah, buat query baru, salin seluruh isinya, jalankan, dan pastikan hasilnya berhasil sebelum lanjut ke berkas berikutnya:

1. `supabase/migrations/202610220001_initial.sql`
2. `supabase/migrations/202610220002_proker_submission.sql`
3. `supabase/migrations/202610220003_proker_edit.sql`
4. `supabase/migrations/202610220004_evaluasi_submission.sql`

Jangan menjalankan migration awal pada database yang sudah memiliki tabel aplikasi. Migration di atas dirancang untuk dijalankan berurutan pada proyek yang sudah menjalankan tahap sebelumnya.

## Pemeriksaan lokal

- `npx tsc --noEmit` — pemeriksaan TypeScript.
- `npm run lint` — ESLint.
- `npm run test:periode`, `npm run test:anggaran`, `npm run test:proker` — unit test aturan periode, total anggaran, status, dan otorisasi.
- `npm run build` — build Next.js.

Uji hak akses database perlu dilakukan memakai akun tiap peran pada proyek Supabase. Uji unggah berkas 10 MB sesuai Tahap 9 perlu dilakukan pada preview deployment.

## Deploy ke Vercel

1. Impor repositori ke Vercel dan pilih Next.js.
2. Tambahkan empat environment variable di atas ke Preview dan Production. Jangan menaruh service role key pada variabel `NEXT_PUBLIC_*`.
3. Deploy Preview dan jalankan uji lintas peran, tampilan 360/768/1280 px, formulir dan aksesibilitas dasar, serta unggah 10 MB.
4. Setelah pemeriksaan preview lulus, deploy ke Production.
5. Di Supabase Auth, matikan pendaftaran publik dan tetapkan panjang password minimum 6 karakter. Pastikan konfigurasi zona waktu/perhitungan aplikasi memakai `Asia/Jakarta`.

## Catatan

- Seluruh akses aplikasi menggunakan Supabase Auth dan RLS; service role hanya berada di server.
- Bukti evaluasi tersimpan di bucket privat dan dibuka memakai signed URL berumur pendek.
- Unduh Excel belum termasuk cakupan aplikasi.
