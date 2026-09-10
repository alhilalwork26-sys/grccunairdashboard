-- Migrasi: kolom emoji per to-do pribadi
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

ALTER TABLE personal_todos ADD COLUMN IF NOT EXISTS emoji text;
