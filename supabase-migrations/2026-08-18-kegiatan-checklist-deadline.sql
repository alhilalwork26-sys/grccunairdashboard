-- Migrasi: tambah kolom deadline di checklist kegiatan
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

ALTER TABLE kegiatan_checklist ADD COLUMN IF NOT EXISTS deadline date;
