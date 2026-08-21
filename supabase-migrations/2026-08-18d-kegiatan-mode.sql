-- Migrasi: mode online/offline untuk kegiatan
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).
--
-- Kolom "location" sudah ada dari sebelumnya (bekas tabel training_sessions,
-- tidak dipakai lagi) -- dipakai ulang untuk simpan link Zoom/GMeet (kalau
-- online) atau lokasi acara (kalau offline).

ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS mode text DEFAULT 'offline';

DO $$
DECLARE
  con text;
BEGIN
  SELECT con.conname INTO con
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'kegiatan' AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%mode%';
  IF con IS NULL THEN
    ALTER TABLE kegiatan ADD CONSTRAINT kegiatan_mode_check CHECK (mode IN ('online', 'offline'));
  END IF;
END $$;

UPDATE kegiatan SET mode = 'offline' WHERE mode IS NULL;
