-- db/migrations/0020_document_review_form_file.sql
--
-- A Prosedur ISMS / Standard Requirement TMMIN document can carry its Form
-- Review & Revisi Dokumen (ISMS-F-001-001) as a second PDF, uploaded with it
-- and shown beside it in the register. The same approval signs both: one
-- Setujui puts the approver's QR on the document and on the form.
-- NULL = no form attached. Safe to re-run.

ALTER TABLE IF EXISTS procedure_documents ADD COLUMN IF NOT EXISTS review_form_path text;
