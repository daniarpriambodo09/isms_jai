-- Jalankan sekali pada database isms_jai.
-- Token approve/reject dari email (aman sekali pakai, dikonsumsi begitu
-- keputusan diambil karena status berubah dari 'pending') dan kode
-- verifikasi yang tercetak/di-QR-kan pada sertifikat PDF hasil approval.

ALTER TABLE photo_video_requests
  ADD COLUMN IF NOT EXISTS approval_token varchar(64),
  ADD COLUMN IF NOT EXISTS verification_code varchar(40);

CREATE UNIQUE INDEX IF NOT EXISTS photo_video_requests_approval_token_idx
  ON photo_video_requests (approval_token)
  WHERE approval_token IS NOT NULL;
