-- Migration: 0047_seed_form_foto_internal_karyawan.sql
-- Description: Daftarkan form pengajuan foto/video internal karyawan (ISMS-F-010-008) ke daftar Controlled Library Form Aplikasi

INSERT INTO form_cs_documents (
  category,
  control_no,
  title,
  language,
  file_path,
  keterangan_type,
  keterangan_note,
  file_variant,
  file_kind,
  sort_order
)
SELECT
  'form-aplikasi',
  'ISMS-F-010-008',
  'Form Pengajuan Pengambilan Foto, Video, dan Perekaman Suara (untuk Karyawan)',
  'IDN/JPN',
  'documents/template-isms-f-010-008-karyawan.pdf',
  'plain-note',
  'Tersedia Form Digital: ISMS FORM & CS > Izin Foto & Video Internal',
  'KARYAWAN',
  'pdf',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM form_cs_documents
  WHERE category = 'form-aplikasi'
    AND control_no = 'ISMS-F-010-008'
    AND (file_variant = 'KARYAWAN' OR title ILIKE '%Karyawan%')
);

INSERT INTO form_cs_documents (
  category,
  control_no,
  title,
  language,
  file_path,
  keterangan_type,
  keterangan_note,
  file_variant,
  file_kind,
  sort_order
)
SELECT
  'form-aplikasi',
  'ISMS-F-010-008',
  'Form Pengajuan Pengambilan Foto, Video, dan Perekaman Suara (untuk Tamu)',
  'IDN/JPN',
  'documents/template-isms-f-010-008-visitor.pdf',
  'plain-note',
  'Tersedia Form Digital: ISMS FORM & CS > Izin Foto & Video Visitor',
  'TAMU',
  'pdf',
  2
WHERE NOT EXISTS (
  SELECT 1 FROM form_cs_documents
  WHERE category = 'form-aplikasi'
    AND control_no = 'ISMS-F-010-008'
    AND (file_variant = 'TAMU' OR title ILIKE '%Tamu%')
);

