-- db/migrations/0008_tmmin_standard_esign.sql
--
-- E-sign approval ("Catatan Pengesahan") for Standard Requirement TMMIN, the
-- same way as Prosedur ISMS and Working Standard: its documents move into
-- procedure_documents as a third kind, 'tmmin_standard'.
--
-- 1. 'tmmin_standard' is allowed as a kind of document and of approver position.
-- 2. Existing documents of standard_isms_p14_documents are copied in once, as
--    documents that need no approval ('none') — exactly as visible as before.
--    A control number already taken within the kind gets "-2", "-3", … so no
--    document is lost. The old table stays as an archive and is no longer read.
-- 3. Starter approver positions (Prepared / Checked / Approved), NOT ticked by
--    default: a new TMMIN standard needs no approval unless positions are
--    chosen. Name and e-mail are left for the ISM Admin.
-- Safe to re-run.

ALTER TABLE procedure_documents DROP CONSTRAINT IF EXISTS procedure_documents_kind_check;
ALTER TABLE procedure_documents ADD CONSTRAINT procedure_documents_kind_check CHECK (kind IN ('procedure', 'working_standard', 'tmmin_standard'));

ALTER TABLE procedure_approver_roles DROP CONSTRAINT IF EXISTS procedure_approver_roles_kind_check;
ALTER TABLE procedure_approver_roles ADD CONSTRAINT procedure_approver_roles_kind_check CHECK (kind IN ('procedure', 'working_standard', 'tmmin_standard'));

DO $$
DECLARE
  r record;
  candidate text;
  n integer;
BEGIN
  IF to_regclass('standard_isms_p14_documents') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT * FROM standard_isms_p14_documents ORDER BY id LOOP
    -- already copied (same file)?
    CONTINUE WHEN EXISTS (SELECT 1 FROM procedure_documents WHERE kind = 'tmmin_standard' AND file_path = r.file_path);
    candidate := upper(r.control_no);
    n := 1;
    WHILE EXISTS (SELECT 1 FROM procedure_documents WHERE kind = 'tmmin_standard' AND control_no = candidate) LOOP
      n := n + 1;
      candidate := upper(r.control_no) || '-' || n;
    END LOOP;
    INSERT INTO procedure_documents (kind, control_no, title, revision, elf_date, file_path, uploaded_at, approval_roles, approval_status, public_visible)
    VALUES ('tmmin_standard', candidate, r.title, GREATEST(r.revision, 1), r.eff_date, r.file_path, r.uploaded_at, '{}', 'none', true);
  END LOOP;
END $$;

INSERT INTO procedure_approver_roles (code, kind, title, person_name, sort_order, is_default)
SELECT v.code, 'tmmin_standard', v.title, 'Belum diisi', v.sort_order, false
FROM (VALUES
  ('TM-PREP', 'Prepared', 1),
  ('TM-CHK', 'Checked', 2),
  ('TM-APP', 'Approved', 3)
) AS v(code, title, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM procedure_approver_roles WHERE kind = 'tmmin_standard')
ON CONFLICT (code) DO NOTHING;
