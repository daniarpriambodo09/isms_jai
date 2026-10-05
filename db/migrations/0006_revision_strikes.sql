-- db/migrations/0006_revision_strikes.sql
--
-- "Minta Revisi": besides numbered markers, an approver can now strike words
-- out (a line drawn across them, like on a hardcopy) and write the
-- replacement. A strike is a revision note with a second point: the line
-- runs from (x, y) to (x2, y2), same page, same 0–1 fractions. Notes with
-- x2/y2 NULL stay plain markers.
-- Safe to re-run.

ALTER TABLE IF EXISTS procedure_revision_notes
  ADD COLUMN IF NOT EXISTS x2 real,
  ADD COLUMN IF NOT EXISTS y2 real;
