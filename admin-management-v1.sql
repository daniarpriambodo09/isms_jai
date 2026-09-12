-- Audit trail: who did what, when — covers admin account changes and every
-- delete across the app (documents, schedules, vendor registrations, etc).
CREATE TABLE IF NOT EXISTS activity_log (
  id serial PRIMARY KEY,
  actor_username varchar(100) NOT NULL,
  actor_role varchar(20) NOT NULL,
  action varchar(30) NOT NULL,
  entity_type varchar(60) NOT NULL,
  entity_id varchar(60),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON activity_log (created_at DESC);
