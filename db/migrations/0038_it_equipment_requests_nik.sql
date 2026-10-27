-- db/migrations/0038_it_equipment_requests_nik.sql
-- Tambahkan kolom applicant_nik pada it_equipment_requests untuk pemohon internal (form keluar ISMS-F-03-00-002)

ALTER TABLE it_equipment_requests ADD COLUMN IF NOT EXISTS applicant_nik VARCHAR(50);
