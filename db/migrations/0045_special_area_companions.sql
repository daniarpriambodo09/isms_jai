-- db/migrations/0045_special_area_companions.sql
-- Add companions and main_card_returned_at columns to special_area_requests
-- Supports multiple visitors with separate barcode cards in Special Security Area requests.

ALTER TABLE special_area_requests
  ADD COLUMN IF NOT EXISTS companions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS main_card_returned_at TIMESTAMP WITH TIME ZONE;

