-- Add card_barcode and returned_at columns to registration_ids for companion barcode tracking
ALTER TABLE registration_ids
  ADD COLUMN IF NOT EXISTS card_barcode VARCHAR(100),
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

