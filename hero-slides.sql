-- Jalankan sekali pada database isms_jai.
CREATE TABLE IF NOT EXISTS hero_slides (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  media_type varchar(10) NOT NULL CHECK (media_type IN ('video', 'image')),
  file_path text NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  cta_label varchar(100),
  cta_href varchar(255),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hero_slides_sort_idx ON hero_slides (sort_order);
