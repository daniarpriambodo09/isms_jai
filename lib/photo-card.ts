// lib/photo-card.ts
//
// Helpers for returning Photography ID cards scanned or clicked back in
// at Admin Lobby or Pos Security kiosk stations.

import { query } from '@/lib/db'
import { normalizeCardNo } from '@/lib/card-ranges'

export type ReturnedPhotoRequest = {
  id: number
  requester_name: string
  photo_id_no: string | null
  to_at: string
  from_at: string
  request_type: string
}

/**
 * Returns a Photography ID card scanned back in (e.g. at the Lobby kiosk or Pos Security).
 * Finds the latest active/approved photo/video request holding this card that hasn't
 * been returned yet, stamps `returned_at` to now, sets `to_at` to the actual finish time,
 * records `returned_by`, and frees up the physical card.
 */
export async function returnPhotographyCard(
  cardNo: string,
  username: string
): Promise<ReturnedPhotoRequest | null> {
  const raw = cardNo.trim()
  if (!raw) return null

  const normalized = normalizeCardNo(raw)
  const withL = /^\d+$/.test(raw) ? `L${raw}` : raw
  const withoutL = /^L(\d+)$/i.exec(raw)?.[1] || raw

  const result = await query<ReturnedPhotoRequest>(
    `UPDATE photo_video_requests
     SET returned_at = now(),
         to_at = GREATEST(now(), from_at),
         returned_by = $2,
         return_notes = COALESCE(return_notes, 'Dikembalikan di Lobby via scan kartu ID')
     WHERE id = (
       SELECT id FROM photo_video_requests
       WHERE (
         photo_id_no = $1
         OR photo_id_no = $3
         OR photo_id_no = $4
         OR photo_id_no = $5
         OR lower(trim(photo_id_no)) = lower(trim($1))
         OR lower(trim(photo_id_no)) = lower(trim($3))
       )
       AND returned_at IS NULL
       AND status <> 'rejected'
       ORDER BY from_at DESC LIMIT 1
     )
     RETURNING id, requester_name, photo_id_no, to_at, from_at, request_type`,
    [raw, username, normalized, withL, withoutL]
  )

  return result.rows[0] ?? null
}

