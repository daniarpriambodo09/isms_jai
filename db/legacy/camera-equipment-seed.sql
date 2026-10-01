-- Seed data awal untuk camera_equipment, sesuai "LIST MATRIX ALAT-ALAT PEREKAM FOTO/VIDEO".
-- Jalankan sekali pada database isms_jai (setelah photo-video-camera-equipment.sql).
-- Kolom department_id merujuk pada tabel departments yang sudah ada.

INSERT INTO camera_equipment (code, department_id) VALUES
  ('WHS-CAM-01', (SELECT id FROM departments WHERE slug = 'ppic-whs')),
  ('EXIM-CAM-03', (SELECT id FROM departments WHERE slug = 'fatp-exim')),
  ('EXIM-CAM-04', (SELECT id FROM departments WHERE slug = 'fatp-exim')),
  ('PROD-HCAM-01', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PROD-CAM-02', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PROD-CAM-03', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PROD-CAM-05', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('TRN-CAM-01', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('TRN-CAM-02', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('TRN-CAM-03', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('TRN-HDY-01', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('TRN-HDY-02', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('TRN-GOP-01', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('QA-CAM-01', (SELECT id FROM departments WHERE slug = 'qa')),
  ('QA-STD-HANDYCAMP-001', (SELECT id FROM departments WHERE slug = 'qa')),
  ('QA-CAM-03', (SELECT id FROM departments WHERE slug = 'qa')),
  ('ENG-CAM-04', (SELECT id FROM departments WHERE slug = 'nys-pp')),
  ('PP-CAM-05', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PP-CAM-06', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PP-CAM-07', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PP-CAM-08', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PP-HAND-02', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PP-HAND-03', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PP-CAM-09', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('PP-CAM-10', (SELECT id FROM departments WHERE slug = 'produksi')),
  ('NYS-HC-001', (SELECT id FROM departments WHERE slug = 'nys-pp')),
  ('NYS-CAM-001', (SELECT id FROM departments WHERE slug = 'nys-pp')),
  ('GA-CAM-01', (SELECT id FROM departments WHERE slug = 'pga')),
  ('GA-CAM-02', (SELECT id FROM departments WHERE slug = 'pga')),
  ('GA-CAM-03', (SELECT id FROM departments WHERE slug = 'pga')),
  ('GA-HANCAM-01', (SELECT id FROM departments WHERE slug = 'pga'))
ON CONFLICT (code, department_id) DO NOTHING;
