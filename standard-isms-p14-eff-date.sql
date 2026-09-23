-- Jalankan sekali pada database isms_jai.
-- Menambahkan Eff Date (tanggal efektif) pada dokumen Standard Requirement
-- TMMIN, menyamakan dengan Prosedur ISMS yang sudah punya tanggal serupa.

ALTER TABLE standard_isms_p14_documents
  ADD COLUMN IF NOT EXISTS eff_date date;

UPDATE standard_isms_p14_documents
  SET eff_date = uploaded_at::date
  WHERE eff_date IS NULL;

ALTER TABLE standard_isms_p14_documents
  ALTER COLUMN eff_date SET NOT NULL;
