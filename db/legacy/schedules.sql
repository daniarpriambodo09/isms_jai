-- Jalankan sekali pada database isms_jai, setelah hero-slides.sql.
CREATE TABLE IF NOT EXISTS audit_schedule (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  start_date date NOT NULL,
  end_date date NOT NULL,
  period_label varchar(50),
  title varchar(255) NOT NULL,
  scope varchar(255),
  pic varchar(255),
  status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_schedule_date_idx ON audit_schedule (start_date);

CREATE TABLE IF NOT EXISTS training_schedule (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  start_date date NOT NULL,
  end_date date NOT NULL,
  period_label varchar(50),
  title varchar(255) NOT NULL,
  audience varchar(255),
  pic varchar(255),
  status varchar(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS training_schedule_date_idx ON training_schedule (start_date);

-- Migrasi 3 baris yang sebelumnya hardcode di lib/portal-data.ts, supaya tidak hilang.
-- Jalankan blok INSERT ini hanya sekali (skrip ini tidak idempotent, sama seperti file .sql lain di proyek ini).
INSERT INTO audit_schedule (start_date, end_date, period_label, title, scope, pic, status, sort_order) VALUES
  ('2025-03-03', '2025-03-07', 'Q1 / 2025', 'Internal ISMS Audit',            'Production & QA', 'R. Pratama', 'completed', 0),
  ('2025-05-19', '2025-05-23', 'Q2 / 2025', 'Information Security Review',    'IT & HR-IR',       'D. Kusuma',  'completed', 1),
  ('2025-08-04', '2025-08-08', 'Q3 / 2025', 'Internal ISMS Audit',            'PPIC-WHS-EXIM',    'R. Pratama', 'completed', 2);
