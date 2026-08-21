-- Migrasi: dukungan Program CSSL (batch dengan 4 sesi + pembicara)
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

-- Tag program khusus di kegiatan (nullable -- kegiatan biasa tetap null)
ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS program text;

-- Sesi per batch CSSL
CREATE TABLE IF NOT EXISTS kegiatan_sesi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kegiatan_id uuid NOT NULL REFERENCES kegiatan(id) ON DELETE CASCADE,
  sesi_ke int NOT NULL,
  tanggal date NOT NULL,
  waktu_mulai time,
  waktu_selesai time,
  pembicara text,
  topik text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kegiatan_sesi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kegiatan_sesi_all_authenticated" ON kegiatan_sesi;
CREATE POLICY "kegiatan_sesi_all_authenticated" ON kegiatan_sesi
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
