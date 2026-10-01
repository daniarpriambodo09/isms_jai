CREATE TABLE IF NOT EXISTS home_canvas (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  blocks jsonb NOT NULL DEFAULT '{"image": null, "pdf": null}'::jsonb,
  updated_by integer REFERENCES admins(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);