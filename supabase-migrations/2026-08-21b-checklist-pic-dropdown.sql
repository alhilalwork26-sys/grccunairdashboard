-- Migrasi: PIC checklist jadi pilihan akun terdaftar (bukan teks bebas lagi)
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).
--
-- Kolom "pic" (teks bebas lama) TIDAK dihapus -- item checklist lama yang
-- masih pakai teks bebas ("Leni, Bita, dan Tita", dll) tetap tampil apa
-- adanya. Item baru akan pakai pic_id (dropdown akun terdaftar).

ALTER TABLE kegiatan_checklist ADD COLUMN IF NOT EXISTS pic_id uuid REFERENCES profiles(id);
