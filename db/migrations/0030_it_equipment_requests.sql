-- db/migrations/0030_it_equipment_requests.sql
-- Form Pengajuan Ijin Membawa Masuk / Keluar PC, USB memory, Kamera, dll. (ISMS-F-03-00-001 & ISMS-F-03-00-002)

-- Update constraint role admins to include 'it'
ALTER TABLE admins DROP CONSTRAINT IF EXISTS admins_role_check;
ALTER TABLE admins ADD CONSTRAINT admins_role_check
  CHECK (role IN ('ism_admin', 'lobby', 'security', 'approver', 'it'));

CREATE TABLE IF NOT EXISTS it_equipment_requests (
  id SERIAL PRIMARY KEY,
  request_no VARCHAR(60) NOT NULL UNIQUE,
  form_type VARCHAR(20) NOT NULL DEFAULT 'in', -- 'in' (ISMS-F-03-00-001) / 'out' (ISMS-F-03-00-002)
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  applicant_name VARCHAR(150) NOT NULL,
  company_name VARCHAR(150) NOT NULL,
  department VARCHAR(120) NOT NULL,
  section VARCHAR(120),
  location VARCHAR(150) NOT NULL,
  purpose TEXT NOT NULL,
  date_in DATE NOT NULL,
  date_out_plan DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  applicant_phone VARCHAR(50),
  applicant_email VARCHAR(120),
  agree_rules BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'returned'
  token VARCHAR(64) UNIQUE,
  approval_code VARCHAR(10),
  approved_by VARCHAR(120),
  approved_title VARCHAR(120),
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  rejected_by VARCHAR(120),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  returned_at TIMESTAMP WITH TIME ZONE,
  returned_checked_by VARCHAR(120),
  returned_notes TEXT,
  return_check_items BOOLEAN NOT NULL DEFAULT false,
  return_check_confidential BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_equipment_requests_status ON it_equipment_requests (status);
CREATE INDEX IF NOT EXISTS idx_it_equipment_requests_date_in ON it_equipment_requests (date_in);
CREATE INDEX IF NOT EXISTS idx_it_equipment_requests_token ON it_equipment_requests (token);

-- Akun default IT Admin jika belum ada
INSERT INTO admins (username, email, password_hash, role)
SELECT 'it.admin', 'it.admin@jai.co.id', '$2b$10$/hDqM6iEt6e3P1bWfGm8j.IFL0Bz6MOm6youFGzsOEGKOLMSLQxa2', 'it'
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'it.admin');
