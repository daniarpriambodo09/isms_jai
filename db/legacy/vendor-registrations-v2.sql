-- Jalankan sekali pada database isms_jai, setelah vendor-registrations.sql.
-- Merevisi vendor_registrations dari model 1-kartu sederhana menjadi model
-- 3 tipe kartu (VISITOR/VENDOR/AFFILIATE) yang bisa berpindah/ditukar.

ALTER TABLE vendor_registrations DROP COLUMN IF EXISTS barcode_kartu_id;

ALTER TABLE vendor_registrations
  ADD COLUMN IF NOT EXISTS entry_path varchar(20) NOT NULL DEFAULT 'security'
    CHECK (entry_path IN ('security', 'lobby_affiliate')),
  ADD COLUMN IF NOT EXISTS stage varchar(20) NOT NULL DEFAULT 'pending_approval'
    CHECK (stage IN ('pending_approval', 'active', 'closed')),
  ADD COLUMN IF NOT EXISTS current_card_type varchar(20)
    CHECK (current_card_type IN ('visitor', 'vendor', 'affiliate')),
  ADD COLUMN IF NOT EXISTS visitor_card_barcode varchar(100),
  ADD COLUMN IF NOT EXISTS vendor_card_barcode varchar(100),
  ADD COLUMN IF NOT EXISTS affiliate_card_barcode varchar(100);

ALTER TABLE vendor_registrations ALTER COLUMN entry_at DROP NOT NULL;
ALTER TABLE vendor_registrations ALTER COLUMN entry_at DROP DEFAULT;
