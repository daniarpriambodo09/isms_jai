-- db/migrations/0004_working_standard_esign.sql
--
-- E-sign approval ("Catatan Pengesahan") for Working Standards.
-- Working standards join the procedures in procedure_documents, told apart by
-- a new `kind` column, so the whole approval engine (approval steps, QR
-- placements, e-mail links, verification, signed PDF) works for both.
--
-- 1. procedure_documents.kind ('procedure' | 'working_standard').
-- 2. A control number must be unique within its kind (it used to be unique
--    across the table, which would stop a working standard from sharing a
--    number with a procedure).
-- 3. Existing working standards are copied in once, as documents that need no
--    approval ('none') — exactly as visible as before. The old table
--    working_standard_documents is left in place as an archive and is no
--    longer read.
-- Safe to re-run.

ALTER TABLE procedure_documents ADD COLUMN IF NOT EXISTS kind varchar(30) NOT NULL DEFAULT 'procedure';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'procedure_documents_kind_check') THEN
    ALTER TABLE procedure_documents ADD CONSTRAINT procedure_documents_kind_check CHECK (kind IN ('procedure', 'working_standard'));
  END IF;
END $$;

ALTER TABLE procedure_documents DROP CONSTRAINT IF EXISTS procedure_documents_control_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS procedure_documents_kind_control_no_key ON procedure_documents (kind, control_no);
CREATE INDEX IF NOT EXISTS procedure_documents_kind_idx ON procedure_documents (kind);

DO $$
BEGIN
  IF to_regclass('working_standard_documents') IS NOT NULL THEN
    INSERT INTO procedure_documents (kind, control_no, title, revision, elf_date, file_path, uploaded_at, approval_roles, approval_status, public_visible)
    SELECT 'working_standard', upper(w.control_no), w.title, GREATEST(w.revision, 1),
           COALESCE(w.effective_date, (w.uploaded_at AT TIME ZONE 'Asia/Jakarta')::date),
           w.file_path, w.uploaded_at, '{}', 'none', true
    FROM working_standard_documents w
    WHERE NOT EXISTS (
      SELECT 1 FROM procedure_documents p
      WHERE p.kind = 'working_standard' AND (p.file_path = w.file_path OR p.control_no = upper(w.control_no))
    );
  END IF;
END $$;
