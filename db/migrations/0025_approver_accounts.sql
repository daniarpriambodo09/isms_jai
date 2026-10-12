-- db/migrations/0025_approver_accounts.sql
--
-- Accounts for approvers ("Persetujuan Saya"): a fourth role beside
-- ism_admin / lobby / security. An approver account can only see and decide
-- the approval requests sent to its own e-mail address — it has no admin
-- rights anywhere (lib/auth.ts). Safe to re-run.

ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check
  CHECK (role IN ('ism_admin', 'lobby', 'security', 'approver'));
