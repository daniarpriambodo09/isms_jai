-- Adds two more work-area card types (Special Area, Photography) alongside the
-- existing Vendor swap target, matching the legacy Lobby system's card categories.
ALTER TABLE vendor_registrations
  ADD COLUMN IF NOT EXISTS special_area_card_barcode varchar(100),
  ADD COLUMN IF NOT EXISTS photography_card_barcode varchar(100);

ALTER TABLE vendor_registrations
  DROP CONSTRAINT IF EXISTS vendor_registrations_current_card_type_check;

ALTER TABLE vendor_registrations
  ADD CONSTRAINT vendor_registrations_current_card_type_check
    CHECK (current_card_type IN ('visitor', 'vendor', 'affiliate', 'special_area', 'photography'));
