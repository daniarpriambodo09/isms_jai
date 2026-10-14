-- db/migrations/0029_registration_manual_close.sql
--
-- "Tutup Manual" at Admin Lobby / Pos Security: a visit whose card can't be
-- scanned back (lost, the guest left with it, a wrong number recorded) is
-- closed by hand instead of deleting the record. The reason, and who closed
-- it, is kept on the row. Safe to re-run.

ALTER TABLE vendor_registrations
  ADD COLUMN IF NOT EXISTS closed_note text;
