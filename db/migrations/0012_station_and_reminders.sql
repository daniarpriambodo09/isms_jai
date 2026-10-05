-- db/migrations/0012_station_and_reminders.sql
--
-- 1. vendor_registrations.registered_station: the kiosk a guest was registered
--    at ('lobby' | 'security'). Pos Security now has the same menus as Admin
--    Lobby and issues cards directly, so entry_path (which describes the card
--    flow) no longer tells the two apart — the "Asal" column and the per-post
--    recap read this instead. Existing rows take it from entry_path.
-- 2. procedure_approvals.reminded_at / reminder_count: reminders sent to an
--    approver who has not opened a pending request (see lib/jobs.ts).
-- Safe to re-run.

ALTER TABLE vendor_registrations ADD COLUMN IF NOT EXISTS registered_station varchar(20);
UPDATE vendor_registrations
SET registered_station = CASE WHEN entry_path = 'security' THEN 'security' ELSE 'lobby' END
WHERE registered_station IS NULL;

ALTER TABLE IF EXISTS procedure_approvals
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;
