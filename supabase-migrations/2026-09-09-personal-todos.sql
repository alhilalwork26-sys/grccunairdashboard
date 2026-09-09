-- Migrasi: tabel to-do pribadi (terpisah dari Rencana Pagi/Update Sore harian)
-- Jalankan sekali di Supabase SQL Editor: https://supabase.com/dashboard/project/turtsegyvhqrbbxzzkuj/sql/new
-- Aman dijalankan ulang (idempotent).

CREATE TABLE IF NOT EXISTS personal_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE personal_todos ENABLE ROW LEVEL SECURITY;

-- Milik pribadi: hanya pemiliknya yang boleh melihat/mengubah, bukan tim/manager.
DROP POLICY IF EXISTS "personal_todos_owner_only" ON personal_todos;
CREATE POLICY "personal_todos_owner_only" ON personal_todos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
