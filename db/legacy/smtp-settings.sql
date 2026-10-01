-- Jalankan sekali pada database isms_jai.
-- Konfigurasi SMTP (singleton row) untuk pengiriman notifikasi email,
-- dikelola lewat halaman admin "Pengaturan SMTP".

CREATE TABLE IF NOT EXISTS smtp_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  host varchar(255),
  port integer,
  encryption varchar(10) NOT NULL DEFAULT 'none' CHECK (encryption IN ('none', 'tls', 'ssl')),
  username varchar(255),
  password varchar(255),
  sender_email varchar(255),
  app_url varchar(255),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
