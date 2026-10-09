-- db/migrations/0019_signature_slots_primary_key.sql
--
-- procedure_signature_slots had no primary key: its first one, (document_id,
-- role_code), was dropped when a position could get several QR spots (seq),
-- and only the uniqueness of (document_id, role_code, seq) was left — as a
-- plain unique index on some databases, as a UNIQUE constraint on others,
-- both named procedure_signature_slots_role_seq. That becomes the primary key
-- here, under the same name, so ensureApprovalSchema (lib/procedure-approval.ts)
-- — which creates that index "if not exists" and drops only the old "_pkey" —
-- leaves it alone, in this build and the ones before it. Nothing else changes.
-- Safe to re-run.

DO $$
DECLARE
  existing "char";
BEGIN
  IF to_regclass('procedure_signature_slots') IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'procedure_signature_slots'::regclass AND contype = 'p') THEN RETURN; END IF;

  SELECT contype INTO existing FROM pg_constraint
  WHERE conrelid = 'procedure_signature_slots'::regclass AND conname = 'procedure_signature_slots_role_seq';

  IF existing = 'u' THEN
    -- a UNIQUE constraint: replaced by the primary key under the same name (one statement)
    ALTER TABLE procedure_signature_slots
      DROP CONSTRAINT procedure_signature_slots_role_seq,
      ADD CONSTRAINT procedure_signature_slots_role_seq PRIMARY KEY (document_id, role_code, seq);
  ELSE
    -- a plain unique index (or none yet): it becomes the primary key
    CREATE UNIQUE INDEX IF NOT EXISTS procedure_signature_slots_role_seq ON procedure_signature_slots (document_id, role_code, seq);
    ALTER TABLE procedure_signature_slots
      ADD CONSTRAINT procedure_signature_slots_role_seq PRIMARY KEY USING INDEX procedure_signature_slots_role_seq;
  END IF;
END $$;
