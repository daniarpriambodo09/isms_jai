-- Jalankan sekali pada database isms_jai.
-- Menambahkan nama lengkap dan email pada roster PIC Approve, plus flag
-- singleton untuk menandai satu PIC sebagai approver default pengajuan
-- Visitor (Ijin Foto/Video) — dikelola dari fitur "Setting Approver" di
-- halaman /ijin-foto-video (tab Visitor), khusus ISM Admin.

ALTER TABLE pic_approvers
  ADD COLUMN IF NOT EXISTS full_name varchar(255),
  ADD COLUMN IF NOT EXISTS email varchar(255),
  ADD COLUMN IF NOT EXISTS is_visitor_default boolean NOT NULL DEFAULT false;

-- Hanya boleh ada satu PIC yang ditandai sebagai default Visitor.
CREATE UNIQUE INDEX IF NOT EXISTS pic_approvers_visitor_default_idx
  ON pic_approvers (is_visitor_default)
  WHERE is_visitor_default;
