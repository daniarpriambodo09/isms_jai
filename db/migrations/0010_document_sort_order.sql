-- db/migrations/0010_document_sort_order.sql
--
-- An order the ISM Admin sets by hand (drag a row, or move it up / down) for
-- the registers that used to list by upload date: department documents and
-- Education & Training. A new document goes to the bottom instead of jumping
-- to the top.
--
-- sort_order is a position within its list: per department + section for
-- `documents`, one list for `education_documents`. Existing rows get the
-- order they are shown in today (newest upload first), so nothing moves.
-- Safe to re-run.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS sort_order integer;
UPDATE documents d
SET sort_order = s.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY department_id, section_id ORDER BY uploaded_at DESC, id DESC) AS rn
  FROM documents
) s
WHERE s.id = d.id AND d.sort_order IS NULL;
CREATE INDEX IF NOT EXISTS documents_sort_idx ON documents (department_id, section_id, sort_order);

ALTER TABLE education_documents ADD COLUMN IF NOT EXISTS sort_order integer;
UPDATE education_documents e
SET sort_order = s.rn
FROM (
  SELECT id, row_number() OVER (ORDER BY uploaded_at DESC, id DESC) AS rn
  FROM education_documents
) s
WHERE s.id = e.id AND e.sort_order IS NULL;
