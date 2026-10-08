-- db/migrations/0017_photo_escort.sql
--
-- Ijin Foto/Video: the PIC Pendamping (the employee who accompanies the person
-- taking the photos), like the one on an Izin Area Special (0015). Picked by
-- Lobby / Pos Security — when they fill in the request, or later in the recap.
-- escort_set_by / escort_set_at record who picked them and when.
-- Safe to re-run.

ALTER TABLE IF EXISTS photo_video_requests
  ADD COLUMN IF NOT EXISTS escort_name varchar(150),
  ADD COLUMN IF NOT EXISTS escort_dept varchar(150),
  ADD COLUMN IF NOT EXISTS escort_set_by varchar(100),
  ADD COLUMN IF NOT EXISTS escort_set_at timestamptz;
