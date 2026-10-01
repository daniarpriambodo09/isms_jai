-- Jalankan sekali pada database isms_jai.
CREATE TABLE IF NOT EXISTS vendor_registrations (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name varchar(255) NOT NULL,
  id_card varchar(255) NOT NULL,
  pic_jai varchar(255) NOT NULL,
  purpose varchar(255) NOT NULL,
  company_remark varchar(255) NOT NULL,
  registered_at timestamp with time zone NOT NULL DEFAULT now(),
  entry_at timestamp with time zone NOT NULL DEFAULT now(),
  barcode_kartu_id varchar(100),
  exit_at timestamp with time zone,
  created_by varchar(50),
  CONSTRAINT vendor_registrations_exit_after_entry CHECK (exit_at IS NULL OR exit_at >= entry_at)
);

CREATE INDEX IF NOT EXISTS vendor_registrations_pending_card_idx ON vendor_registrations (barcode_kartu_id) WHERE barcode_kartu_id IS NULL;
CREATE INDEX IF NOT EXISTS vendor_registrations_registered_at_idx ON vendor_registrations (registered_at DESC);
