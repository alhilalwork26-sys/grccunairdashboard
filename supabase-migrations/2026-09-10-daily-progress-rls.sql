-- Migrasi: batasi siapa yang bisa melihat isi Daily Progress orang lain
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).
--
-- Sebelumnya tabel daily_progress kemungkinan memakai policy longgar
-- (USING(true)) sehingga siapa pun yang login bisa membaca rencana pagi/
-- update sore milik orang lain langsung lewat API, walau UI-nya sudah
-- tidak menampilkan bagian "Progress Tim". Sekarang: isi Daily Progress
-- milik orang lain hanya bisa dibaca oleh pemiliknya sendiri, atau oleh
-- super_admin/manager. Menulis/mengubah/menghapus tetap hanya untuk diri
-- sendiri.

-- Hapus semua policy lama di tabel ini (nama lama tidak diketahui pasti).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'daily_progress' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON daily_progress', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE daily_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_progress_select" ON daily_progress
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "daily_progress_insert" ON daily_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_progress_update" ON daily_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_progress_delete" ON daily_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
