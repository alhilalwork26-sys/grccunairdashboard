-- Migrasi: tabel checklist/rincian tugas per Kegiatan
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

CREATE TABLE IF NOT EXISTS kegiatan_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id uuid NOT NULL REFERENCES kegiatan(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  pic text,
  status text NOT NULL DEFAULT 'belum' CHECK (status IN ('belum', 'sudah')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kegiatan_checklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kegiatan_checklist_all_authenticated" ON kegiatan_checklist;
CREATE POLICY "kegiatan_checklist_all_authenticated" ON kegiatan_checklist
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
