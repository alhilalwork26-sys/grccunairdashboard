-- Migrasi: tambah kolom opsional di tabel kegiatan
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS virtual_background_url text;
ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS absensi_url            text;
ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS materi_url             text;
ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS record_zoom_url        text;
ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS ujian_url              text;
ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS dokumentasi_url        text;
ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS modul_url              text;
ALTER TABLE kegiatan ADD COLUMN IF NOT EXISTS rundown_url            text;
