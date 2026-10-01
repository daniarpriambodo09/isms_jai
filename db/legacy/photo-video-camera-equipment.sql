-- Jalankan sekali pada database isms_jai.
-- "Kontrol No. Kamera" per departemen/seksi (mis. TRN-CAM-01, TRN-GOPRO-01),
-- dan "No ID Photography" dicatat saat admin menyetujui pengajuan — meniru
-- alur approval di sistem lama (adm_trn/approve.cgi).

CREATE TABLE IF NOT EXISTS camera_equipment (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(50) NOT NULL,
  department_id integer REFERENCES departments(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (code, department_id)
);

CREATE INDEX IF NOT EXISTS camera_equipment_department_id_idx ON camera_equipment (department_id);

ALTER TABLE photo_video_requests
  ADD COLUMN IF NOT EXISTS camera_control_no varchar(50),
  ADD COLUMN IF NOT EXISTS photo_id_no varchar(100);
