-- db/migrations/0040_it_equipment_requests_checked_cols.sql
-- Menambahkan kolom verifikasi & persetujuan Tahap 2 oleh Divisi IT (System Security Administrator)
-- pada tabel it_equipment_requests (ISMS-F-03-00-001 & ISMS-F-03-00-002)

ALTER TABLE it_equipment_requests
  ADD COLUMN IF NOT EXISTS it_checked_by VARCHAR(150),
  ADD COLUMN IF NOT EXISTS it_checked_title VARCHAR(150),
  ADD COLUMN IF NOT EXISTS it_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS it_check_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_it_equipment_requests_it_checked_at ON it_equipment_requests (it_checked_at);

