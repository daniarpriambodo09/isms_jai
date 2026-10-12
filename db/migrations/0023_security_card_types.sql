-- db/migrations/0023_security_card_types.sql
--
-- Pos Security hands out three kinds of card (Visitor, Vendor, Supplier), not
-- only Visitor, and the Lobby swaps a Security card for one of its own
-- (Visitor or Vendor). Until now every guest registered at Security was
-- recorded as "visitor", and "the card in hand is the Security one" was read
-- off current_card_type = 'visitor'.
--
-- 1. security_card_type / security_card_barcode: the card Security issued.
--    It stays out for the whole visit, also while the guest holds a Lobby card.
-- 2. supplier_card_barcode + 'supplier' as a current_card_type.
-- 3. at_work_area: the guest swapped the Security card for a Lobby card and
--    has not swapped back yet.
-- Existing rows: Security guests keep a Visitor card. Safe to re-run.

ALTER TABLE vendor_registrations
  ADD COLUMN IF NOT EXISTS security_card_type varchar(20) NOT NULL DEFAULT 'visitor',
  ADD COLUMN IF NOT EXISTS security_card_barcode varchar(100),
  ADD COLUMN IF NOT EXISTS supplier_card_barcode varchar(100),
  ADD COLUMN IF NOT EXISTS at_work_area boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'vendor_registrations'::regclass AND conname = 'vendor_registrations_security_card_type_check') THEN
    ALTER TABLE vendor_registrations ADD CONSTRAINT vendor_registrations_security_card_type_check
      CHECK (security_card_type IN ('visitor', 'vendor', 'supplier'));
  END IF;
END $$;

ALTER TABLE vendor_registrations DROP CONSTRAINT IF EXISTS vendor_registrations_current_card_type_check;
ALTER TABLE vendor_registrations ADD CONSTRAINT vendor_registrations_current_card_type_check
  CHECK (current_card_type IN ('visitor', 'vendor', 'supplier', 'affiliate', 'special_area', 'photography'));

UPDATE vendor_registrations
SET security_card_barcode = visitor_card_barcode
WHERE entry_path = 'security' AND security_card_barcode IS NULL AND visitor_card_barcode IS NOT NULL;

UPDATE vendor_registrations
SET at_work_area = true
WHERE entry_path = 'security' AND stage = 'active' AND current_card_type IS NOT NULL
  AND current_card_type <> 'visitor' AND NOT at_work_area;
