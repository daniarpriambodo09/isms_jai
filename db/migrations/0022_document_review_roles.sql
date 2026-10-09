-- db/migrations/0022_document_review_roles.sql
--
-- The Form Review beside a Prosedur ISMS / TMMIN document is signed by its
-- own positions — the Form Review ones of Approver Pengesahan (Prepared,
-- Checked, Approval) — not by the document's. review_roles lists them for
-- the document; they sign first, then the document's approvers. Empty on a
-- document whose form was signed by the document's approvers (before this).
-- Safe to re-run.

ALTER TABLE IF EXISTS procedure_documents ADD COLUMN IF NOT EXISTS review_roles text[] NOT NULL DEFAULT '{}';
