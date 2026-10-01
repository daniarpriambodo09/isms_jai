-- db/migrations/0002_review_ack.sql
--
-- 1. procedure_approvals.token_issued_at — approval links expire 30 days
--    after they're issued (lib/procedure-approval.ts, APPROVAL_LINK_DAYS).
-- 2. policy_acknowledgements — employees confirm they read & understood the
--    ISMS basic policy (per policy version).
-- All statements are safe to re-run.

-- ─── 1. approval link age ───
ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS token_issued_at timestamptz;
-- Links already out there count from when they were sent (or created).
UPDATE procedure_approvals
   SET token_issued_at = COALESCE(notified_at, created_at)
 WHERE token IS NOT NULL AND token_issued_at IS NULL;

-- ─── 2. policy acknowledgements ───
CREATE TABLE IF NOT EXISTS policy_acknowledgements (
  id serial PRIMARY KEY,
  policy_version varchar(40) NOT NULL,
  nik varchar(50) NOT NULL,
  full_name varchar(150) NOT NULL,
  department varchar(150) NOT NULL,
  section varchar(150),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  ip varchar(64)
);
CREATE UNIQUE INDEX IF NOT EXISTS policy_acknowledgements_version_nik_idx
  ON policy_acknowledgements (policy_version, lower(nik));
CREATE INDEX IF NOT EXISTS policy_acknowledgements_department_idx
  ON policy_acknowledgements (policy_version, department);
