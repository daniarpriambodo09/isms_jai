-- Jalankan sekali pada database isms_jai, setelah form-cs.sql.
-- Menambah kolom untuk tampilan register bergaya spreadsheet (KETERANGAN, FILE, varian file A-D, judul dengan bagian miring)
-- dan tabel baris grup statis (mis. "GENERAL/BUSINESS SECURITY AREA ENTRANCE RECORD").

ALTER TABLE form_cs_documents ADD COLUMN IF NOT EXISTS keterangan_type varchar(30) NOT NULL DEFAULT 'none'
  CHECK (keterangan_type IN ('none', 'plain-note', 'web-base-approval', 'list-all-daftar'));
ALTER TABLE form_cs_documents ADD COLUMN IF NOT EXISTS keterangan_note text;
ALTER TABLE form_cs_documents ADD COLUMN IF NOT EXISTS file_variant varchar(10);
ALTER TABLE form_cs_documents ADD COLUMN IF NOT EXISTS file_kind varchar(10) NOT NULL DEFAULT 'pdf'
  CHECK (file_kind IN ('pdf', 'xls'));
ALTER TABLE form_cs_documents ADD COLUMN IF NOT EXISTS title_emphasis_from int;

-- Izinkan beberapa baris berbagi control_no yang sama selama file_variant berbeda (mis. PDF(A)/PDF(B)).
ALTER TABLE form_cs_documents DROP CONSTRAINT IF EXISTS form_cs_documents_category_control_no_key;
ALTER TABLE form_cs_documents ADD CONSTRAINT form_cs_documents_category_control_no_variant_key
  UNIQUE (category, control_no, file_variant);

CREATE TABLE IF NOT EXISTS form_cs_group_headers (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category varchar(30) NOT NULL CHECK (category IN ('form-aplikasi', 'kontrol-cs')),
  sort_order integer NOT NULL DEFAULT 0,
  label varchar(255) NOT NULL,
  control_no_prefix varchar(100)
);

CREATE INDEX IF NOT EXISTS form_cs_group_headers_category_idx
  ON form_cs_group_headers (category, sort_order);
