-- Jalankan sekali pada database isms_jai.
-- Menambah kolom role ke admins (akun lama otomatis jadi 'ism_admin', perilaku tidak berubah),
-- lalu membuat 2 akun baru: admin_lobby dan admin_possecurity.

ALTER TABLE admins ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'ism_admin'
  CHECK (role IN ('ism_admin', 'lobby', 'security'));

-- Password sementara, tolong ganti setelah testing pertama:
--   admin_lobby       / Lobby#2026
--   admin_possecurity / Security#2026
INSERT INTO admins (username, email, password_hash, role) VALUES
  ('admin_lobby', NULL, '$2b$10$ANrk450FPjkFhEotsuTYM.zE1064asQXkj9zRiZ0/E.O.mlCdJstC', 'lobby'),
  ('admin_possecurity', NULL, '$2b$10$Z/CqsNOIp.aLtqinn.Z5aub/1t/pPruLZypYladiKlITuD9JfnFLW', 'security');
