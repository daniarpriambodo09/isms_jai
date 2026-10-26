-- db/migrations/0034_registration_ids_and_id_check.sql
--
-- 1) registration_ids: extra people (name + ID number) registered together
--    with one guest, so a group is entered in a single registration.
-- 2) KTP check by Pos Security: when the identity cards were verified and
--    when they were handed back. A visit closed with a verified card that was
--    never handed back is flagged "KTP belum dikembalikan". Safe to re-run.

CREATE TABLE IF NOT EXISTS registration_ids (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_id integer NOT NULL REFERENCES vendor_registrations(id) ON DELETE CASCADE,
  name character varying(255) NOT NULL,
  id_no character varying(255) NOT NULL
);
CREATE INDEX IF NOT EXISTS registration_ids_registration_idx ON registration_ids (registration_id);

ALTER TABLE vendor_registrations
  ADD COLUMN IF NOT EXISTS id_verified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS id_verified_by character varying(50),
  ADD COLUMN IF NOT EXISTS id_returned_at timestamp with time zone;
