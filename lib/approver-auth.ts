// lib/approver-auth.ts
//
// Helpers to authenticate an approver directly into the ISMS dashboard
// (/persetujuan-saya) using a valid approval token from notification emails.
// If the email address attached to the token matches an account in the
// `admins` table, a valid session cookie can be issued without manual password entry.

import 'server-only'
import { query } from '@/lib/db'

export type MatchedAdminAccount = {
  id: number
  username: string
  email: string | null
  role: 'ism_admin' | 'lobby' | 'security' | 'approver' | 'it'
}

/**
 * Searches across all approval workflow tables to find the approver email
 * associated with a one-time token or approval token:
 * 1. Prosedur ISMS / Form Review (procedure_approvals)
 * 2. Form Layanan IT E-Sign (it_form_submissions / it_form_signatures)
 * 3. Izin Akses Area Special (special_area_requests)
 * 4. Izin Foto / Video (photo_video_requests)
 */
export async function findApproverEmailByToken(token: string): Promise<string | null> {
  const clean = token.trim()
  if (!clean) return null

  // 1. Prosedur ISMS (procedure_approvals)
  try {
    const res = await query<{ approver_email: string | null }>(
      'SELECT approver_email FROM procedure_approvals WHERE token = $1 LIMIT 1',
      [clean]
    )
    if (res.rows[0]?.approver_email) {
      return res.rows[0].approver_email.trim()
    }
  } catch (err) {
    console.error('[approver-auth/procedure_approvals]', err)
  }

  // 2. Form Layanan IT (it_form_submissions & it_form_signatures)
  try {
    const res = await query<{ approver_email: string | null }>(
      `SELECT s.approver_email
       FROM it_form_submissions sub
       JOIN it_form_signatures s ON s.submission_id = sub.id
       WHERE sub.token = $1 AND s.step_number = sub.current_step
       LIMIT 1`,
      [clean]
    )
    if (res.rows[0]?.approver_email) {
      return res.rows[0].approver_email.trim()
    }

    // Also check verification_code or signatures token
    const resSig = await query<{ approver_email: string | null }>(
      'SELECT approver_email FROM it_form_signatures WHERE verification_code = $1 LIMIT 1',
      [clean]
    )
    if (resSig.rows[0]?.approver_email) {
      return resSig.rows[0].approver_email.trim()
    }
  } catch (err) {
    console.error('[approver-auth/it_forms]', err)
  }

  // 3. Izin Area Special (special_area_requests)
  try {
    const res = await query<{ approver_email: string | null }>(
      'SELECT approver_email FROM special_area_requests WHERE token = $1 LIMIT 1',
      [clean]
    )
    if (res.rows[0]?.approver_email) {
      return res.rows[0].approver_email.trim()
    }
  } catch (err) {
    console.error('[approver-auth/special_area]', err)
  }

  // 4. Izin Foto / Video (photo_video_requests)
  try {
    const res = await query<{ email: string | null }>(
      `SELECT pic.email
       FROM photo_video_requests r
       JOIN pic_approvers pic ON pic.id = r.pic_approve_id
       WHERE r.approval_token = $1
       LIMIT 1`,
      [clean]
    )
    if (res.rows[0]?.email) {
      return res.rows[0].email.trim()
    }
  } catch (err) {
    console.error('[approver-auth/photo_video]', err)
  }

  return null
}

/**
 * Finds an active account in `admins` matching the approver's email address (case-insensitive).
 */
export async function findAdminByEmail(email: string): Promise<MatchedAdminAccount | null> {
  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) return null

  try {
    const res = await query<MatchedAdminAccount>(
      `SELECT id, username, email, role
       FROM admins
       WHERE lower(trim(email)) = $1
       ORDER BY (CASE WHEN role = 'approver' THEN 0 ELSE 1 END)
       LIMIT 1`,
      [cleanEmail]
    )
    return res.rows[0] ?? null
  } catch (err) {
    console.error('[approver-auth/findAdminByEmail]', err)
    return null
  }
}
