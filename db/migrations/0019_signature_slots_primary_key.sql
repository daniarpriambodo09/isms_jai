-- db/migrations/0019_signature_slots_primary_key.sql
--
-- procedure_signature_slots had no primary key: its first one, (document_id,
-- role_code), was dropped when a position could get several QR spots (seq),
-- and only the unique index on (document_id, role_code, seq) was left. That
-- index becomes the primary key here. The constraint keeps the index's own
-- name, so ensureApprovalSchema (lib/procedure-approval.ts) — which creates
-- that index "if not exists" and drops only the old "_pkey" — leaves it alone,
-- in this build and the ones before it. Nothing else changes.
-- Safe to re-run.

DO $$
BEGIN
  IF to_regclass('procedure_signature_slots') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'procedure_signature_slots'::regclass AND contype = 'p') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS procedure_signature_slots_role_seq ON procedure_signature_slots (document_id, role_code, seq);
    ALTER TABLE procedure_signature_slots
      ADD CONSTRAINT procedure_signature_slots_role_seq PRIMARY KEY USING INDEX procedure_signature_slots_role_seq;
  END IF;
END $$;
