-- db/migrations/0016_approver_initials.sql
--
-- The approver's initials (the 2–4 letters printed under a signature box on
-- the Working Standard sheet: TWC, MRA, HMA, ISR …):
-- - procedure_approver_roles.initials: set per position in Approver Pengesahan;
--   empty = the first three letters of the name.
-- - procedure_approvals.approver_initials: snapshot on each signing step, like
--   approver_name, so an old document keeps the initials of whoever signed it.
-- Safe to re-run.

ALTER TABLE IF EXISTS procedure_approver_roles ADD COLUMN IF NOT EXISTS initials varchar(5);
ALTER TABLE IF EXISTS procedure_approvals ADD COLUMN IF NOT EXISTS approver_initials varchar(5);
