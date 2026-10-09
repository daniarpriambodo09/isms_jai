-- db/migrations/0018_approval_code.sql
--
-- Approval code: a 6-digit code sent in the body of each e-sign request
-- e-mail, which the approver types in when pressing Setujui — the link alone
-- is not enough to sign. Re-sending to the same address keeps the code (the
-- earlier e-mail stays valid); a new address or a new cycle gets a new one.
-- approval_code_attempts counts wrong entries; after 5 the step is locked
-- until the Admin ISM re-sends the e-mail (which issues a new code).
-- A step created before this (approval_code NULL) is approved without a code.
-- Safe to re-run.

ALTER TABLE IF EXISTS procedure_approvals ADD COLUMN IF NOT EXISTS approval_code varchar(6);
ALTER TABLE IF EXISTS procedure_approvals ADD COLUMN IF NOT EXISTS approval_code_attempts integer NOT NULL DEFAULT 0;
