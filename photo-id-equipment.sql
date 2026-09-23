-- Jalankan sekali pada database isms_jai.
-- Roster "No. ID Photography" per departemen/seksi, dikelola dari halaman
-- /kelola-kamera (bersama Kontrol No. Kamera) — sama seperti camera_equipment,
-- supaya form Internal bisa pakai dropdown dari daftar terdaftar.

CREATE TABLE IF NOT EXISTS photo_id_equipment (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(50) NOT NULL,
  department_id integer REFERENCES departments(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (code, department_id)
);

CREATE INDEX IF NOT EXISTS photo_id_equipment_department_id_idx ON photo_id_equipment (department_id);
