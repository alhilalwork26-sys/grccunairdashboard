-- Migrasi: file bukti per item checklist kegiatan
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

ALTER TABLE kegiatan_checklist ADD COLUMN IF NOT EXISTS file_url  text;
ALTER TABLE kegiatan_checklist ADD COLUMN IF NOT EXISTS file_name text;
