-- db/migrations/0009_replaced_approval_links.sql
--
-- Approval links that were replaced by a newer one (the position changed
-- hands, or its e-mail address changed, so a fresh link went to the new
-- address). Kept only so that opening the old link says "this link was
-- replaced — use the newest e-mail" instead of "link not found". A replaced
-- link can't decide anything or open the document.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS procedure_approval_old_tokens (
  token varchar(64) PRIMARY KEY,
  approval_id integer NOT NULL REFERENCES procedure_approvals(id) ON DELETE CASCADE,
  replaced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS procedure_approval_old_tokens_approval_idx ON procedure_approval_old_tokens (approval_id);
