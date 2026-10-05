-- db/migrations/0013_review_form.sql
--
-- "Form Review & Revisi Dokumen ISMS" (ISMS-F-001-001), filled in on the
-- portal and signed by e-sign: the generated PDF is a document of a fourth
-- kind, 'review_form', on the same approval engine as the registers.
--
-- 1. 'review_form' is allowed as a kind of document and of approver position.
-- 2. document_review_forms keeps what was filled in (to edit and regenerate
--    the PDF), one row per form document, removed with it.
-- 3. Starter positions for the form's three boxes — Prepared, Checked and
--    Approval. Checked / Approval take the holder of SSA / IAA from the
--    Prosedur ISMS list when those exist; all three can be edited freely.
-- Safe to re-run.

ALTER TABLE procedure_documents DROP CONSTRAINT IF EXISTS procedure_documents_kind_check;
ALTER TABLE procedure_documents ADD CONSTRAINT procedure_documents_kind_check CHECK (kind IN ('procedure', 'working_standard', 'tmmin_standard', 'review_form'));

ALTER TABLE procedure_approver_roles DROP CONSTRAINT IF EXISTS procedure_approver_roles_kind_check;
ALTER TABLE procedure_approver_roles ADD CONSTRAINT procedure_approver_roles_kind_check CHECK (kind IN ('procedure', 'working_standard', 'tmmin_standard', 'review_form'));

CREATE TABLE IF NOT EXISTS document_review_forms (
  document_id integer PRIMARY KEY REFERENCES procedure_documents(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(100)
);

INSERT INTO procedure_approver_roles (code, kind, title, person_name, email, sort_order, is_default)
SELECT v.code, 'review_form', v.title,
       COALESCE((SELECT person_name FROM procedure_approver_roles WHERE code = v.source), 'Belum diisi'),
       (SELECT email FROM procedure_approver_roles WHERE code = v.source),
       v.sort_order, true
FROM (VALUES
  ('FR-PREP', 'Prepared', NULL, 1),
  ('FR-CHK', 'Checked (SSA)', 'SSA', 2),
  ('FR-APP', 'Approval (IAA)', 'IAA', 3)
) AS v(code, title, source, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM procedure_approver_roles WHERE kind = 'review_form')
ON CONFLICT (code) DO NOTHING;
