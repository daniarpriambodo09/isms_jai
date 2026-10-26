-- db/migrations/0033_guest_visit_date.sql
--
-- Planned visit date, entered by Pos Security ahead of the visit (H-1) so the
-- post can prepare. NULL = walk-in / not scheduled. Safe to re-run.

ALTER TABLE vendor_registrations
  ADD COLUMN IF NOT EXISTS visit_date date;
