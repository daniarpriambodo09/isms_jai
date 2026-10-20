-- db/migrations/0031_it_form_approvers_and_requests.sql
-- Form Approver Settings and E-Sign submissions for IT Forms:
-- 1. ISMS-F-010-006: Pengajuan / Perubahan Email Address / Login User ID
-- 2. ISMS-F-010-007: Request Penghapusan E-mail Address / Login User ID
-- 3. ISMS-F-03-00-003: Company Network Connection Application Form
-- 4. ISMS-F-03-00-001: Izin Membawa Masuk / Keluar PC & Alat IT

CREATE TABLE IF NOT EXISTS it_form_approvers (
  id SERIAL PRIMARY KEY,
  form_code VARCHAR(40) NOT NULL,
  form_name VARCHAR(150) NOT NULL,
  slot_number INT NOT NULL,
  slot_label VARCHAR(80) NOT NULL,
  role_title VARCHAR(150) NOT NULL,
  person_name VARCHAR(150) NOT NULL,
  salutation VARCHAR(20) DEFAULT 'Bapak',
  initials VARCHAR(10) DEFAULT '',
  email VARCHAR(150),
  department VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_form_approvers_form_code ON it_form_approvers (form_code, sort_order);

CREATE TABLE IF NOT EXISTS it_form_submissions (
  id SERIAL PRIMARY KEY,
  request_no VARCHAR(60) NOT NULL UNIQUE,
  form_code VARCHAR(40) NOT NULL,
  form_name VARCHAR(150) NOT NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  applicant_name VARCHAR(150) NOT NULL,
  applicant_nik VARCHAR(50),
  applicant_position VARCHAR(120),
  employee_status VARCHAR(50) DEFAULT 'TETAP',
  department VARCHAR(120) NOT NULL,
  company_name VARCHAR(150),
  purpose TEXT,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  current_step INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL DEFAULT 1,
  token VARCHAR(64) UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_form_submissions_form_code ON it_form_submissions (form_code);
CREATE INDEX IF NOT EXISTS idx_it_form_submissions_status ON it_form_submissions (status);
CREATE INDEX IF NOT EXISTS idx_it_form_submissions_token ON it_form_submissions (token);

CREATE TABLE IF NOT EXISTS it_form_signatures (
  id SERIAL PRIMARY KEY,
  submission_id INT NOT NULL REFERENCES it_form_submissions(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  slot_label VARCHAR(80) NOT NULL,
  role_title VARCHAR(150) NOT NULL,
  approver_name VARCHAR(150) NOT NULL,
  approver_email VARCHAR(150),
  status VARCHAR(30) NOT NULL DEFAULT 'waiting', -- 'waiting', 'pending', 'approved', 'rejected'
  verification_code VARCHAR(30),
  signed_at TIMESTAMPTZ,
  signature_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_form_signatures_sub_step ON it_form_signatures (submission_id, step_number);

-- Seed default approvers for the forms based on the official PDF templates
-- ISMS-F-010-001: Form Pengadaan Baru atau Pembaharuan PC/Laptop
INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-001', 'Form Pengadaan Baru atau Pembaharuan PC/Laptop', 1, 'CEK oleh IT Section', 'IT Section / System Security Admin', 'IT Security Admin', 'Bapak', 'SSA', 'it.security@jai.co.id', 'IT Section', 1
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-001' AND slot_number = 1);

INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-001', 'Form Pengadaan Baru atau Pembaharuan PC/Laptop', 2, 'Persetujuan dari MGR/J.MGR', 'Departemen MANAGER / J. MANAGER', 'Departemen Manager', 'Bapak', 'MGR', 'dept.manager@jai.co.id', 'Departemen Pemohon', 2
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-001' AND slot_number = 2);

-- ISMS-F-010-003: Form Pengadaan Baru atau Pembaharuan Software
INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-003', 'Form Pengadaan Baru atau Pembaharuan Software', 1, 'CEK oleh IT Section', 'IT Section / System Security Admin', 'IT Security Admin', 'Bapak', 'SSA', 'it.security@jai.co.id', 'IT Section', 1
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-003' AND slot_number = 1);

INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-003', 'Form Pengadaan Baru atau Pembaharuan Software', 2, 'Persetujuan MGR/J.MGR', 'Departemen MANAGER / J. MANAGER', 'Departemen Manager', 'Bapak', 'MGR', 'dept.manager@jai.co.id', 'Departemen Pemohon', 2
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-003' AND slot_number = 2);

-- ISMS-F-010-006: Pengajuan / Perubahan Email Address / Login User ID
INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-006', 'Pengajuan / Perubahan Email & User ID', 1, 'CHECK', 'IT SPV / System Security Administrator', 'IT Supervisor', 'Bapak', 'SSA', 'it.spv@jai.co.id', 'IT Section', 1
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-006' AND slot_number = 1);

INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-006', 'Pengajuan / Perubahan Email & User ID', 2, 'MENGETAHUI', 'IR / HR SPV atau Departemen IR / HR', 'IR/HR Supervisor', 'Bapak', 'HR', 'hr.spv@jai.co.id', 'IR / HR', 2
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-006' AND slot_number = 2);

INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-006', 'Pengajuan / Perubahan Email & User ID', 3, 'MENYETUJUI', 'Departemen MANAGER / J. MANAGER', 'Departemen Manager', 'Bapak', 'MGR', 'dept.manager@jai.co.id', 'Departemen Pemohon', 3
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-006' AND slot_number = 3);

-- ISMS-F-010-007: Request Penghapusan E-mail Address / Login User ID
INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-007', 'Request Penghapusan Email & User ID', 1, 'DIREQUESTKAN OLEH', 'IR SPV / HR SPV atau Departemen IR/HR', 'IR/HR Supervisor', 'Bapak', 'HR', 'hr.spv@jai.co.id', 'IR / HR', 1
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-007' AND slot_number = 1);

INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-007', 'Request Penghapusan Email & User ID', 2, 'MENGETAHUI', 'Departemen MANAGER / J. MANAGER', 'Departemen Manager', 'Bapak', 'MGR', 'dept.manager@jai.co.id', 'Departemen Pemohon', 2
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-007' AND slot_number = 2);

INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-010-007', 'Request Penghapusan Email & User ID', 3, 'MENYETUJUI', 'IT SPV / Security System Administrator', 'IT Supervisor / SSA', 'Bapak', 'SSA', 'it.spv@jai.co.id', 'IT Section', 3
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-010-007' AND slot_number = 3);

-- ISMS-F-03-00-003: Company Network Connection Application Form
INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-03-00-003', 'Company Network Connection Application Form', 1, 'IT SECTION CHECK', 'IT Section / System Security Admin', 'IT Security Admin', 'Bapak', 'SSA', 'it.security@jai.co.id', 'IT Section', 1
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-03-00-003' AND slot_number = 1);

INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-03-00-003', 'Company Network Connection Application Form', 2, 'APPROVAL', 'Information Assets Administrator', 'TEGUH SUNJOYO', 'Bapak', 'IAA', 'teguh.sunjoyo@jai.co.id', 'Management / IT', 2
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-03-00-003' AND slot_number = 2);

-- ISMS-F-03-00-001: Izin Membawa Masuk / Keluar PC & Alat IT
INSERT INTO it_form_approvers (form_code, form_name, slot_number, slot_label, role_title, person_name, salutation, initials, email, department, sort_order)
SELECT 'ISMS-F-03-00-001', 'Ijin Membawa Masuk/Keluar Alat IT', 1, 'IT CHECK & APPROVAL', 'System Security Administrator (IT)', 'System Security Admin', 'Bapak', 'SSA', 'it.admin@jai.co.id', 'IT Section', 1
WHERE NOT EXISTS (SELECT 1 FROM it_form_approvers WHERE form_code = 'ISMS-F-03-00-001' AND slot_number = 1);
