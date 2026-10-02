-- db/migrations/0003_procedure_public_visible.sql
--
-- ISM Admin chooses which procedures visitors see. A procedure is public when
-- it is final (fully approved, or needs no approval) AND public_visible.
-- Existing documents stay visible, as before.

ALTER TABLE procedure_documents ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT true;
