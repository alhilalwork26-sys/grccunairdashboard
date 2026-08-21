-- Migrasi: kegiatan/pelatihan multi-hari (tanggal mulai + tanggal selesai)
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).
--
-- "deadline" tetap dipakai sebagai tanggal mulai. "end_date" baru untuk
-- tanggal selesai -- default sama dengan deadline (kegiatan 1 hari).

ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS end_date date;
UPDATE kegiatan SET end_date = deadline WHERE end_date IS NULL;
