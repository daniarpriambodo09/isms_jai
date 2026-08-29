-- Jalankan sekali pada database isms_jai.
CREATE TABLE IF NOT EXISTS procedure_documents (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  control_no varchar(100) NOT NULL UNIQUE,
  title varchar(255) NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  elf_date date NOT NULL,
  file_path text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procedure_documents_control_no_idx
  ON procedure_documents (control_no);
