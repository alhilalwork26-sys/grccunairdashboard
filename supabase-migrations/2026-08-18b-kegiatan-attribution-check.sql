-- Migrasi: cegah spoofing created_by/uploaded_by di checklist & lampiran kegiatan
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).
--
-- Sebelumnya policy "FOR ALL USING(true) WITH CHECK(true)" mengizinkan siapa saja
-- yang login mengisi created_by/uploaded_by dengan id user LAIN (memalsukan siapa
-- yang menambahkan). Sekarang WITH CHECK memaksa nilainya harus = auth.uid() sendiri.
-- SELECT/UPDATE/DELETE tetap terbuka untuk semua authenticated (sesuai kebutuhan app
-- ini yang memang kolaboratif dalam satu tim).

-- kegiatan_checklist
DROP POLICY IF EXISTS "kegiatan_checklist_all_authenticated" ON kegiatan_checklist;

CREATE POLICY "kegiatan_checklist_select" ON kegiatan_checklist
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kegiatan_checklist_insert" ON kegiatan_checklist
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "kegiatan_checklist_update" ON kegiatan_checklist
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "kegiatan_checklist_delete" ON kegiatan_checklist
  FOR DELETE TO authenticated USING (true);

-- kegiatan_lampiran
DROP POLICY IF EXISTS "kegiatan_lampiran_all_authenticated" ON kegiatan_lampiran;

CREATE POLICY "kegiatan_lampiran_select" ON kegiatan_lampiran
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kegiatan_lampiran_insert" ON kegiatan_lampiran
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "kegiatan_lampiran_delete" ON kegiatan_lampiran
  FOR DELETE TO authenticated USING (true);
