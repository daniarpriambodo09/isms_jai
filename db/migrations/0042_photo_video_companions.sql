-- db/migrations/0042_photo_video_companions.sql
-- Add companions and main_card_returned_at columns to photo_video_requests to support multiple photographers/people and multiple barcodes

ALTER TABLE photo_video_requests
ADD COLUMN IF NOT EXISTS companions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS main_card_returned_at TIMESTAMP WITH TIME ZONE;
