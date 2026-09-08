-- Migrasi: ubah Daily Progress menjadi To Do List (pagi isi, sore centang)
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

ALTER TABLE daily_progress ADD COLUMN IF NOT EXISTS todos jsonb DEFAULT '[]'::jsonb;
