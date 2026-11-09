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
          ADD COLUMN IF NOT EXISTS return_notes TEXT,
          ADD COLUMN IF NOT EXISTS requester_email VARCHAR(255),
          ADD COLUMN IF NOT EXISTS approval_token VARCHAR(64),
          ADD COLUMN IF NOT EXISTS verification_code VARCHAR(40),
          ADD COLUMN IF NOT EXISTS camera_serial_no VARCHAR(255),
          ADD COLUMN IF NOT EXISTS pic_jai VARCHAR(255),
          ADD COLUMN IF NOT EXISTS ref_token VARCHAR(16),
          ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS taken_ack_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS pic_approve_id INTEGER,
          ADD COLUMN IF NOT EXISTS result_mailed_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS decided_by VARCHAR(150),
          ADD COLUMN IF NOT EXISTS decided_by_title VARCHAR(150),
          ADD COLUMN IF NOT EXISTS decision_note TEXT;
      `)

      // Ensure equipment tables and section_id columns exist
      await query(`
        CREATE TABLE IF NOT EXISTS camera_equipment (
          id serial PRIMARY KEY,
          code VARCHAR(50) NOT NULL,
          department_id INTEGER,
          section_id INTEGER,
          created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        ALTER TABLE camera_equipment ADD COLUMN IF NOT EXISTS section_id INTEGER;

        CREATE TABLE IF NOT EXISTS photo_id_equipment (
          id serial PRIMARY KEY,
          code VARCHAR(50) NOT NULL,
          department_id INTEGER,
          section_id INTEGER,
          created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        ALTER TABLE photo_id_equipment ADD COLUMN IF NOT EXISTS section_id INTEGER;

        CREATE TABLE IF NOT EXISTS usb_equipment (
          id serial PRIMARY KEY,
          code VARCHAR(50) NOT NULL,
          department_id INTEGER,
          section_id INTEGER,
          created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        ALTER TABLE usb_equipment ADD COLUMN IF NOT EXISTS section_id INTEGER;

        CREATE TABLE IF NOT EXISTS smart_device_equipment (
          id serial PRIMARY KEY,
          code VARCHAR(50) NOT NULL,
          department_id INTEGER,
          section_id INTEGER,
          created_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        ALTER TABLE smart_device_equipment ADD COLUMN IF NOT EXISTS section_id INTEGER;
      `)

      // Ensure pic_approvers has required columns
      await query(`
        ALTER TABLE pic_approvers
          ADD COLUMN IF NOT EXISTS is_visitor_default BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS salutation VARCHAR(10),
          ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
          ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      `)

      // Ensure at least one PIC approver has is_visitor_default = true
      const defaultPic = await query<{ id: number }>('SELECT id FROM pic_approvers WHERE is_visitor_default = true LIMIT 1')
      if (defaultPic.rows.length === 0) {
        const anyPic = await query<{ id: number }>('SELECT id FROM pic_approvers ORDER BY id ASC LIMIT 1')
        if (anyPic.rows.length > 0) {
          await query('UPDATE pic_approvers SET is_visitor_default = true WHERE id = $1', [anyPic.rows[0].id])
        } else {
          await query(`
            INSERT INTO pic_approvers (name, full_name, title, email, is_visitor_default, salutation)
            VALUES ('TSU', 'Teguh Sunjoyo', 'Information Assets Administrator', 'teguh@jai.co.id', true, 'Bpk.')
          `)
        }
      }

      columnsEnsured = true
    } catch (error) {
      console.error('[photo-video-db] ensurePhotoVideoColumns error (non-fatal):', error)
    } finally {
      ensurePromise = null
    }
  })()

  return ensurePromise
}

