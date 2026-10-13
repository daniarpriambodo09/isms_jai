-- db/migrations/0027_signature_date_only.sql
--
-- A signature placement can be the approval date alone: no_qr = true keeps
-- the row (and its date box) but prints no QR. Until now the date box only
-- existed as a companion of a QR box, so removing the QR removed the date.
-- Safe to re-run.

ALTER TABLE procedure_signature_slots ADD COLUMN IF NOT EXISTS no_qr boolean NOT NULL DEFAULT false;
