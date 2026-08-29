-- Jalankan sekali pada database isms_jai.
CREATE TABLE IF NOT EXISTS form_cs_documents (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category varchar(30) NOT NULL CHECK (category IN ('form-aplikasi', 'kontrol-cs')),
  control_no varchar(100) NOT NULL,
  title varchar(255) NOT NULL,
  language varchar(100) NOT NULL,
  file_path text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT form_cs_documents_category_control_no_key UNIQUE (category, control_no)
);

CREATE INDEX IF NOT EXISTS form_cs_documents_category_idx
  ON form_cs_documents (category, control_no);
