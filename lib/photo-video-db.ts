// lib/photo-video-db.ts
//
// Self-healing schema helper for photo_video_requests table.
// Ensures all required columns exist on the database before any query runs,
// preventing 500 crashes even if database migrations have not been manually run on deployed servers.

import { query } from '@/lib/db'

let columnsEnsured = false
let ensurePromise: Promise<void> | null = null

export async function ensurePhotoVideoColumns(): Promise<void> {
  if (columnsEnsured) return
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    try {
      await query(`
        ALTER TABLE photo_video_requests
          ADD COLUMN IF NOT EXISTS companions JSONB DEFAULT '[]'::jsonb,
          ADD COLUMN IF NOT EXISTS main_card_returned_at TIMESTAMP WITH TIME ZONE,
          ADD COLUMN IF NOT EXISTS virus_check BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS delete_or_format VARCHAR(50),
          ADD COLUMN IF NOT EXISTS escort_name VARCHAR(150),
          ADD COLUMN IF NOT EXISTS escort_dept VARCHAR(150),
          ADD COLUMN IF NOT EXISTS escort_set_by VARCHAR(100),
          ADD COLUMN IF NOT EXISTS escort_set_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS usb_control_no VARCHAR(100),
          ADD COLUMN IF NOT EXISTS smart_device_control_no VARCHAR(100),
          ADD COLUMN IF NOT EXISTS camera_control_no VARCHAR(100),
          ADD COLUMN IF NOT EXISTS photo_id_no VARCHAR(100),
          ADD COLUMN IF NOT EXISTS dept_pic_kamera VARCHAR(100),
          ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS returned_by VARCHAR(150),
          ADD COLUMN IF NOT EXISTS return_notes TEXT;
      `)
      columnsEnsured = true
    } catch (error) {
      console.error('[photo-video-db] ensurePhotoVideoColumns error (non-fatal):', error)
    } finally {
      ensurePromise = null
    }
  })()

  return ensurePromise
}

