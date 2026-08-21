-- Migrasi: kategori kalender untuk kegiatan (Meeting/Deadline/Event/Libur/Training)
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS calendar_type text DEFAULT 'event';

DO $$
DECLARE
  con text;
BEGIN
  SELECT con.conname INTO con
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'kegiatan' AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%calendar_type%';
  IF con IS NULL THEN
    ALTER TABLE kegiatan ADD CONSTRAINT kegiatan_calendar_type_check
      CHECK (calendar_type IN ('meeting', 'deadline', 'event', 'holiday', 'training'));
  END IF;
END $$;

UPDATE kegiatan SET calendar_type = 'event' WHERE calendar_type IS NULL;
