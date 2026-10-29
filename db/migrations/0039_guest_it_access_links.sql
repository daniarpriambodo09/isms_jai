-- db/migrations/0039_guest_it_access_links.sql
-- Tabel link khusus tamu (Guest) yang menggabungkan 2 form wajib:
-- 1. Form Izin Masuk Alat IT (ISMS-F-03-00-001)
-- 2. Form Penyambungan Network Internal (ISMS-F-03-00-003)
-- Dilengkapi penomoran tahunan & urutan tamu yang otomatis reset setiap bulan,
-- serta alokasi Username, Password/Passkey, SSID, IP Address, Subnet, Gateway, dan DNS oleh Admin IT.

CREATE TABLE IF NOT EXISTS it_guest_access_links (
  id SERIAL PRIMARY KEY,
  link_code VARCHAR(150) NOT NULL UNIQUE,
  token VARCHAR(64) NOT NULL UNIQUE,
  seq_year INT NOT NULL,
  seq_month INT NOT NULL,
  seq_no INT NOT NULL,
  guest_name VARCHAR(150) NOT NULL,
  company_name VARCHAR(150),
  department VARCHAR(120),
  visit_date DATE,
  visit_end_date DATE,
  is_walk_in BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(30) NOT NULL DEFAULT 'link_created', -- 'link_created' | 'submitted' | 'approved' | 'rejected'
  equipment_request_id INT REFERENCES it_equipment_requests(id) ON DELETE SET NULL,
  network_submission_id INT REFERENCES it_form_submissions(id) ON DELETE SET NULL,
  network_username VARCHAR(100),
  network_password VARCHAR(100),
  network_ssid VARCHAR(100),
  ip_mode VARCHAR(20) NOT NULL DEFAULT 'dhcp', -- 'dhcp' | 'static'
  assigned_ip VARCHAR(60),
  subnet_mask VARCHAR(60) DEFAULT '255.255.255.0',
  gateway VARCHAR(60),
  dns_primary VARCHAR(60),
  dns_secondary VARCHAR(60),
  approved_by VARCHAR(150),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  rejected_by VARCHAR(150),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_guest_links_period ON it_guest_access_links (seq_year, seq_month, seq_no);
CREATE INDEX IF NOT EXISTS idx_it_guest_links_status ON it_guest_access_links (status);
CREATE INDEX IF NOT EXISTS idx_it_guest_links_code ON it_guest_access_links (link_code);

