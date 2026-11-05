-- db/migrations/0044_photo_video_virus_and_format.sql
-- Add virus_check, delete_or_format, companions, and main_card_returned_at columns to photo_video_requests
-- Ensures table integrity across all deployment environments.

ALTER TABLE photo_video_requests
  ADD COLUMN IF NOT EXISTS virus_check BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delete_or_format VARCHAR(50),
  ADD COLUMN IF NOT EXISTS companions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS main_card_returned_at TIMESTAMP WITH TIME ZONE;
