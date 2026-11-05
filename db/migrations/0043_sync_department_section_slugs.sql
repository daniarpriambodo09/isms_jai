-- db/migrations/0043_sync_department_section_slugs.sql
-- Synchronize department and section slugs with their names so URLs, transitions, and breadcrumbs match Manage Department exactly

CREATE OR REPLACE FUNCTION slugify_text(v_text text) RETURNS text AS $$
BEGIN
  RETURN trim(both '-' from lower(regexp_replace(v_text, '[^a-zA-Z0-9]+', '-', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update departments where slug is different from slugify_text(name)
UPDATE departments
SET slug = CASE
  WHEN slugify_text(name) = '' THEN 'dept-' || id::text
  ELSE slugify_text(name)
END
WHERE slug <> CASE
  WHEN slugify_text(name) = '' THEN 'dept-' || id::text
  ELSE slugify_text(name)
END;

-- Update sections where slug is different from slugify_text(name)
UPDATE sections
SET slug = CASE
  WHEN slugify_text(name) = '' THEN 'sec-' || id::text
  ELSE slugify_text(name)
END
WHERE slug <> CASE
  WHEN slugify_text(name) = '' THEN 'sec-' || id::text
  ELSE slugify_text(name)
END;

