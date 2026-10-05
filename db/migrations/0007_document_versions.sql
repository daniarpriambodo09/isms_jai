-- db/migrations/0007_document_versions.sql
--
-- Revision history for documents that go through e-sign approval, so the
-- approvers and the ISM Admin can compare a fixed file with the one the
-- revision was asked on.
--
-- 1. procedure_document_versions: every file that was replaced by a new
--    upload (it used to be deleted). Removed with its document.
-- 2. procedure_approvals.file_path: the file an approver decided on — a
--    "Minta Revisi" is shown on the very file its marks were made on.
--    Decisions already taken on the current file (made after it was
--    uploaded) get it filled in; older ones point at files that are gone.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS procedure_document_versions (
  id serial PRIMARY KEY,
  document_id integer NOT NULL REFERENCES procedure_documents(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  file_path text NOT NULL,
  uploaded_at timestamptz,
  replaced_at timestamptz NOT NULL DEFAULT now(),
  replaced_by varchar(100)
);
CREATE INDEX IF NOT EXISTS procedure_document_versions_document_idx ON procedure_document_versions (document_id, replaced_at);

ALTER TABLE IF EXISTS procedure_approvals ADD COLUMN IF NOT EXISTS file_path text;

UPDATE procedure_approvals a
SET file_path = d.file_path
FROM procedure_documents d
WHERE a.document_id = d.id
  AND a.file_path IS NULL
  AND a.decided_at IS NOT NULL
  AND a.revision = d.revision
  AND a.decided_at >= d.uploaded_at;
