-- db/migrations/0026_password_resets.sql
--
-- "Lupa password": a one-off link e-mailed to the account's own address
-- (lib/password-reset.ts). Only the hash of the token is kept, it works once,
-- and for one hour. Safe to re-run.

CREATE TABLE IF NOT EXISTS password_resets (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id integer NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS password_resets_admin_idx ON password_resets (admin_id, created_at DESC);
