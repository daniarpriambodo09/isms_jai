-- Jalankan sekali pada database isms_jai.
-- Menambahkan field "PIC JAI" pada form Visitor (kontak internal JAI yang
-- ditemui/bertanggung jawab, dipakai juga di body email approval).

ALTER TABLE photo_video_requests
  ADD COLUMN IF NOT EXISTS pic_jai varchar(255);
