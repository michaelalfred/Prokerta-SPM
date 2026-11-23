-- Jalankan berkas ini sendiri dan tunggu sukses/commit sebelum menjalankan
-- 202611240002_ketua_bidang.sql. Nilai enum baru tidak boleh dipakai dalam
-- transaksi yang sama dengan ALTER TYPE pada Postgres.
alter type app_role add value if not exists 'ketua_bidang';
