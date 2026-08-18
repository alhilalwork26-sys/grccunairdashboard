-- Migrasi: ubah modul Training menjadi Kegiatan
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent) kecuali bagian UPDATE status (lihat catatan di bawah).

-- 1. Rename tabel & kolom inti
ALTER TABLE training_sessions RENAME TO kegiatan;
ALTER TABLE kegiatan RENAME COLUMN trainer_id TO pic_id;
ALTER TABLE kegiatan RENAME COLUMN date TO deadline;

-- 2. Rename foreign key constraint supaya konsisten dengan nama baru
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_sessions_trainer_id_fkey') THEN
    ALTER TABLE kegiatan RENAME CONSTRAINT training_sessions_trainer_id_fkey TO kegiatan_pic_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_sessions_created_by_fkey') THEN
    ALTER TABLE kegiatan RENAME CONSTRAINT training_sessions_created_by_fkey TO kegiatan_created_by_fkey;
  END IF;
END $$;

-- 3. Status disederhanakan jadi belum/sudah
--    (upcoming/ongoing -> belum, done -> sudah, cancelled -> belum)
DO $$
DECLARE
  con text;
BEGIN
  SELECT con.conname INTO con
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'kegiatan' AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE kegiatan DROP CONSTRAINT %I', con);
  END IF;
END $$;

UPDATE kegiatan SET status = CASE WHEN status = 'done' THEN 'sudah' ELSE 'belum' END
WHERE status NOT IN ('belum', 'sudah');

ALTER TABLE kegiatan ALTER COLUMN status SET DEFAULT 'belum';
ALTER TABLE kegiatan ADD CONSTRAINT kegiatan_status_check CHECK (status IN ('belum', 'sudah'));

-- 4. Tabel baru untuk lampiran multi-file (upload folder)
CREATE TABLE IF NOT EXISTS kegiatan_lampiran (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id uuid NOT NULL REFERENCES kegiatan(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kegiatan_lampiran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kegiatan_lampiran_all_authenticated" ON kegiatan_lampiran;
CREATE POLICY "kegiatan_lampiran_all_authenticated" ON kegiatan_lampiran
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Storage policies untuk bucket kegiatan-lampiran (upload file dari browser)
DROP POLICY IF EXISTS "kegiatan_lampiran_storage_select" ON storage.objects;
CREATE POLICY "kegiatan_lampiran_storage_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'kegiatan-lampiran');

DROP POLICY IF EXISTS "kegiatan_lampiran_storage_insert" ON storage.objects;
CREATE POLICY "kegiatan_lampiran_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kegiatan-lampiran');

DROP POLICY IF EXISTS "kegiatan_lampiran_storage_delete" ON storage.objects;
CREATE POLICY "kegiatan_lampiran_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'kegiatan-lampiran');

-- Catatan:
-- - Kolom lama yang sudah tidak dipakai UI baru (start_time, end_time, location,
--   max_participants, materials) SENGAJA TIDAK dihapus, supaya data lama tidak hilang.
--   Bisa di-drop manual belakangan kalau memang tidak diperlukan lagi.
-- - Tabel training_participants juga tidak dihapus (jadi tidak terpakai lagi, aman
--   dibiarkan atau di-drop manual: DROP TABLE training_participants;)
