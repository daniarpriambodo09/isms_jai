-- Jalankan sekali pada database isms_jai.
-- Token rahasia untuk nomor referensi pengajuan, supaya cek status dan
-- pembatalan sendiri tidak bisa dilakukan hanya dengan menebak nomor urut.
ALTER TABLE photo_video_requests
  ADD COLUMN IF NOT EXISTS ref_token varchar(16);
