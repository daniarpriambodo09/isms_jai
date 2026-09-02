-- Jalankan sekali pada database isms_jai.
CREATE TABLE IF NOT EXISTS photo_video_requests (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_type varchar(20) NOT NULL CHECK (request_type IN ('internal', 'visitor')),
  nik varchar(50),
  requester_name varchar(255) NOT NULL,
  dept_or_company varchar(255) NOT NULL,
  dept varchar(255),
  dept_pic_kamera varchar(255),
  from_at timestamp with time zone NOT NULL,
  to_at timestamp with time zone NOT NULL,
  location varchar(255) NOT NULL,
  objective text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  decided_at timestamp with time zone,
  decided_by varchar(255),
  decision_note text,
  CONSTRAINT photo_video_requests_dates_check CHECK (to_at >= from_at)
);

CREATE INDEX IF NOT EXISTS photo_video_requests_status_idx ON photo_video_requests (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS photo_video_requests_type_idx ON photo_video_requests (request_type, submitted_at DESC);
