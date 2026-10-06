-- db/migrations/0014_admin_notifications.sql
--
-- 1. admin_notifications: what happened in the portal, for the ISM Admin bell
--    ("Info" items until seen) and the "Riwayat Notifikasi" page (kept 90
--    days). Items that are shown live in the bell anyway (pending requests,
--    e-mails that failed, …) are written already seen — they are history only.
-- 2. photo_video_requests.requester_email: optional address the requester
--    gives to be told the decision; result_mailed_at records that it went out.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS admin_notifications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind varchar(40) NOT NULL,
  category varchar(20) NOT NULL,
  title varchar(255) NOT NULL,
  body text,
  href varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);
CREATE INDEX IF NOT EXISTS admin_notifications_created_idx ON admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_unseen_idx ON admin_notifications (created_at DESC) WHERE seen_at IS NULL;

ALTER TABLE IF EXISTS photo_video_requests
  ADD COLUMN IF NOT EXISTS requester_email varchar(255),
  ADD COLUMN IF NOT EXISTS result_mailed_at timestamptz;
