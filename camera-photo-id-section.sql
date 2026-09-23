-- Jalankan sekali pada database isms_jai.
-- Menambahkan Section (bukan cuma Department) pada roster Kontrol No.
-- Kamera dan No. ID Photography, supaya bisa dipersempit sampai level
-- seksi, tidak cuma departemen.

ALTER TABLE camera_equipment
  ADD COLUMN IF NOT EXISTS section_id integer REFERENCES sections(id) ON DELETE SET NULL;

ALTER TABLE photo_id_equipment
  ADD COLUMN IF NOT EXISTS section_id integer REFERENCES sections(id) ON DELETE SET NULL;

-- Longgarkan unique constraint lama (code, department_id) supaya kode yang
-- sama boleh dipakai di section berbeda dalam departemen yang sama.
ALTER TABLE camera_equipment DROP CONSTRAINT IF EXISTS camera_equipment_code_department_id_key;
ALTER TABLE photo_id_equipment DROP CONSTRAINT IF EXISTS photo_id_equipment_code_department_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS camera_equipment_code_dept_section_idx
  ON camera_equipment (code, department_id, section_id);
CREATE UNIQUE INDEX IF NOT EXISTS photo_id_equipment_code_dept_section_idx
  ON photo_id_equipment (code, department_id, section_id);
