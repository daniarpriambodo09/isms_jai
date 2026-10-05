-- db/migrations/0011_register_sort_order.sql
--
-- The remaining registers also get an order the ISM Admin sets by hand
-- (drag a row, or up / down): Prosedur ISMS, Working Standard and Standard
-- Requirement TMMIN (procedure_documents, one list per kind) and Application
-- Form / CS Control (form_cs_documents, one list per category).
--
-- Existing rows keep the order they are shown in today (by control number),
-- so nothing moves; a new document goes to the bottom of its list.
-- Safe to re-run.

ALTER TABLE procedure_documents ADD COLUMN IF NOT EXISTS sort_order integer;
UPDATE procedure_documents d
SET sort_order = s.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY kind ORDER BY control_no ASC, id ASC) AS rn
  FROM procedure_documents
) s
WHERE s.id = d.id AND d.sort_order IS NULL;
CREATE INDEX IF NOT EXISTS procedure_documents_sort_idx ON procedure_documents (kind, sort_order);

ALTER TABLE form_cs_documents ADD COLUMN IF NOT EXISTS sort_order integer;
UPDATE form_cs_documents d
SET sort_order = s.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY category ORDER BY control_no ASC, file_variant ASC NULLS FIRST, id ASC) AS rn
  FROM form_cs_documents
) s
WHERE s.id = d.id AND d.sort_order IS NULL;
