-- db/migrations/0005_approver_roles_per_kind.sql
--
-- Each register gets its own list of approver positions ("Catatan
-- Pengesahan"): Prosedur ISMS keeps the existing ones, Working Standard gets a
-- separate, equally editable list (add / edit / delete in Approver Pengesahan).
--
-- 1. procedure_approver_roles.kind ('procedure' | 'working_standard'). The
--    code stays unique across both lists — approval steps, QR placements and
--    documents refer to a position by its code alone.
-- 2. Working Standard starts with the four boxes of its document header
--    (Prepared, Checked, Approved 1, Approved 2). Name and e-mail are left for
--    the ISM Admin to fill in; they can be renamed, removed or extended freely.
-- Safe to re-run: the starter positions are only added while Working Standard
-- has none at all.

ALTER TABLE procedure_approver_roles ADD COLUMN IF NOT EXISTS kind varchar(30) NOT NULL DEFAULT 'procedure';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'procedure_approver_roles_kind_check') THEN
    ALTER TABLE procedure_approver_roles ADD CONSTRAINT procedure_approver_roles_kind_check CHECK (kind IN ('procedure', 'working_standard'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS procedure_approver_roles_kind_idx ON procedure_approver_roles (kind, sort_order);

INSERT INTO procedure_approver_roles (code, kind, title, person_name, sort_order, is_default)
SELECT v.code, 'working_standard', v.title, 'Belum diisi', v.sort_order, true
FROM (VALUES
  ('WS-PREP', 'Prepared', 1),
  ('WS-CHK', 'Checked', 2),
  ('WS-APP1', 'Approved 1', 3),
  ('WS-APP2', 'Approved 2', 4)
) AS v(code, title, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM procedure_approver_roles WHERE kind = 'working_standard')
ON CONFLICT (code) DO NOTHING;
