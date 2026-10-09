-- db/migrations/0021_document_approver_overrides.sql
--
-- Who approves a document can differ from the position's usual holder (Approver
-- Pengesahan): someone stands in, or one document goes to another person in
-- the same position than the next. Per document, a position's code can map to
-- the person who approves it there: { "SSA": { "name": "…", "email": "…" } }.
-- Positions not listed use their usual holder. Safe to re-run.

ALTER TABLE IF EXISTS procedure_documents ADD COLUMN IF NOT EXISTS approver_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
