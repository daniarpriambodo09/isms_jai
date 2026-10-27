-- Migration 0037: Add Smart Device equipment roster for Photo/Video requests
-- Allows ISMS Admin to manage Smart Device equipment (tablets, smartphones) and tracks smart device loan.

CREATE TABLE IF NOT EXISTS smart_device_equipment (
  id serial PRIMARY KEY,
  code character varying(50) NOT NULL,
  department_id integer REFERENCES departments(id) ON DELETE CASCADE,
  section_id integer REFERENCES sections(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS smart_device_equipment_code_dept_section_idx
  ON smart_device_equipment (code, department_id, section_id);

CREATE INDEX IF NOT EXISTS smart_device_equipment_department_id_idx
  ON smart_device_equipment (department_id);

ALTER TABLE IF EXISTS photo_video_requests
  ADD COLUMN IF NOT EXISTS smart_device_control_no character varying(50);
