-- db/migrations/0015_special_area_escort.sql
--
-- Izin Masuk Area Special Security: the PIC Pendamping (the employee who
-- accompanies the guest inside the area). Filled in by Lobby / Pos Security —
-- when submitting, or later once it is known — and printed on the form PDF.
-- escort_set_by / escort_set_at record who filled it in and when.
-- Safe to re-run.

ALTER TABLE IF EXISTS special_area_requests
  ADD COLUMN IF NOT EXISTS escort_name varchar(150),
  ADD COLUMN IF NOT EXISTS escort_dept varchar(150),
  ADD COLUMN IF NOT EXISTS escort_set_by varchar(100),
  ADD COLUMN IF NOT EXISTS escort_set_at timestamptz;
