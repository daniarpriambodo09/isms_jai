CREATE TABLE IF NOT EXISTS policy_images (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policy_images_order_idx ON policy_images (display_order, id);
