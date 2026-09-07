-- Migrasi: kolom pembicara di kegiatan (teks bebas, bisa lebih dari satu nama)
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS pembicara text;
