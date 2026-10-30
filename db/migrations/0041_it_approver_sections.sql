-- db/migrations/0041_it_approver_sections.sql
ALTER TABLE it_form_approvers
ADD COLUMN IF NOT EXISTS sections JSONB NOT NULL DEFAULT '[]'::jsonb;
