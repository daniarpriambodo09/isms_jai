-- Catatan Pengesahan Prosedur ISMS (e-approval via email).
-- Tidak wajib dijalankan manual: lib/procedure-approval.ts membuat semua ini
-- otomatis (idempotent) saat fitur pertama kali dipakai. File ini hanya
-- dokumentasi / untuk dijalankan lebih awal di database isms_jai.

-- Jabatan penandatangan. Ganti nama/email di sini (atau via /kelola-pengesahan)
-- saat ada pergantian jabatan.
CREATE TABLE IF NOT EXISTS procedure_approver_roles (
  code varchar(20) PRIMARY KEY,
  title varchar(150) NOT NULL,
  person_name varchar(150) NOT NULL,
  email varchar(255),
  sort_order integer NOT NULL DEFAULT 0,      -- urutan tanda tangan (1 = pertama)
  is_default boolean NOT NULL DEFAULT true,   -- otomatis dicentang untuk dokumen baru
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by varchar(100)
);

INSERT INTO procedure_approver_roles (code, title, person_name, sort_order, is_default) VALUES
  ('SSA', 'System Security Administrator', 'Ika Yuni Setyo R.', 1, true),
  ('IAA', 'Information Assets Administrator', 'Teguh Sunjoyo', 2, true),
  ('PJU', 'Penanggung Jawab Umum (Presiden Director)', 'Tomotaka Takayanagi', 3, false)
ON CONFLICT (code) DO NOTHING;

-- Per dokumen: jabatan yang wajib mengesahkan ('{}' = tidak perlu, tampil "–"),
-- Note Dokumen, dan status ringkas (none | pending | approved | rejected).
ALTER TABLE procedure_documents
  ADD COLUMN IF NOT EXISTS approval_roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS approval_status varchar(20) NOT NULL DEFAULT 'none';

-- Satu baris per jabatan per siklus pengesahan (per revisi dokumen).
-- approver_name menyimpan nama saat itu, jadi riwayat tetap benar walau jabatan berganti orang.
CREATE TABLE IF NOT EXISTS procedure_approvals (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id integer NOT NULL REFERENCES procedure_documents(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  role_code varchar(20) NOT NULL,
  role_title varchar(150) NOT NULL,
  step integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'waiting',   -- waiting | pending | approved | rejected | cancelled
  token varchar(64) UNIQUE,                         -- link email (tanpa login)
  approver_name varchar(150),
  approver_email varchar(255),
  notified_at timestamptz,
  email_error text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS procedure_approvals_document_idx ON procedure_approvals (document_id, revision);

-- Tanda tangan elektronik per orang: kode unik (PRS-<id>-<hex>) yang dikodekan
-- ke QR masing-masing approver saat menekan "Setujui".
ALTER TABLE procedure_approvals ADD COLUMN IF NOT EXISTS verification_code varchar(40) UNIQUE;
