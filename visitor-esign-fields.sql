-- Jalankan sekali pada database isms_jai.
-- Melengkapi dua field yang ada di form fisik tapi belum tercatat:
-- Serial No. Kamera (diisi pemohon Visitor sendiri) dan Jabatan approver
-- (dicetak di bawah nama approver pada sertifikat PDF).

ALTER TABLE photo_video_requests
  ADD COLUMN IF NOT EXISTS camera_serial_no varchar(255),
  ADD COLUMN IF NOT EXISTS decided_by_title varchar(255);

ALTER TABLE pic_approvers
  ADD COLUMN IF NOT EXISTS title varchar(255);
