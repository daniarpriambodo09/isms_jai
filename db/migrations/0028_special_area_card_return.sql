-- db/migrations/0028_special_area_card_return.sql
--
-- Izin Masuk Area Special: the ID card is scanned again when it comes back.
-- That moment becomes the exit time (to_at); the time written on the request
-- is kept in planned_to_at. Until then the card counts as out ("Kartu Sedang
-- Digunakan") — it no longer drops off by itself 12 hours after the planned
-- exit. Requests that ended before this existed are taken as returned at
-- their planned exit. Safe to re-run.

ALTER TABLE special_area_requests
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_by varchar(100),
  ADD COLUMN IF NOT EXISTS planned_to_at timestamptz;

UPDATE special_area_requests
SET returned_at = to_at
WHERE returned_at IS NULL AND to_at < now() - interval '12 hours';
