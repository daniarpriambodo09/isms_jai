-- Migration 0032: Add USB Equipment roster and return tracking for Photo/Video requests
-- Allows ISMS Admin to manage USB equipment and tracks actual camera/USB return timestamp.

CREATE TABLE IF NOT EXISTS usb_equipment (
  id serial PRIMARY KEY,
  code character varying(50) NOT NULL,
  department_id integer REFERENCES departments(id) ON DELETE CASCADE,
  section_id integer REFERENCES sections(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS usb_equipment_code_dept_section_idx
  ON usb_equipment (code, department_id, section_id);

CREATE INDEX IF NOT EXISTS usb_equipment_department_id_idx
  ON usb_equipment (department_id);

ALTER TABLE IF EXISTS photo_video_requests
  ADD COLUMN IF NOT EXISTS usb_control_no character varying(50),
  ADD COLUMN IF NOT EXISTS returned_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS returned_by character varying(255),
  ADD COLUMN IF NOT EXISTS return_notes text;

CREATE INDEX IF NOT EXISTS photo_video_requests_returned_at_idx
  ON photo_video_requests (returned_at);
