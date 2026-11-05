// lib/photo-card.ts
//
// Helpers for returning Photography ID cards scanned or clicked back in
// at Admin Lobby or Pos Security kiosk stations.

import { query } from '@/lib/db'
import { normalizeCardNo } from '@/lib/card-ranges'
import { ensurePhotoVideoColumns } from '@/lib/photo-video-db'

export type PhotoCompanion = {
  name: string
  nik?: string | null
  photo_id_no?: string | null
  returned_at?: string | null
}

export type ReturnedPhotoRequest = {
  id: number
  requester_name: string
  photo_id_no: string | null
  to_at: string
  from_at: string
  request_type: string
  companion_name?: string | null
}

function matchesCard(target: string | null | undefined, candidates: string[]): boolean {
  if (!target) return false
  const t = target.trim().toLowerCase()
  if (!t) return false
  return candidates.some((c) => c.toLowerCase() === t)
}

/**
 * Returns a Photography ID card scanned back in (e.g. at the Lobby kiosk or Pos Security).
 * Finds the latest active/approved photo/video request holding this card (either on the
 * main requester or among companions) that hasn't been returned yet.
 *
 * If all cards for the request are now returned, stamps `returned_at` to now, sets `to_at`,
 * and frees up the request.
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
  const candidates = Array.from(new Set([raw, normalized, withL, withoutL].filter(Boolean)))

  await ensurePhotoVideoColumns()

  // Find candidate requests that are not rejected and not yet marked completely returned
  const candidateRes = await query<{
    id: number
    requester_name: string
    photo_id_no: string | null
    main_card_returned_at: string | null
    companions: PhotoCompanion[] | null
    to_at: string
    from_at: string
    request_type: string
    status: string
  }>(
    `SELECT id, requester_name, photo_id_no, main_card_returned_at,
            COALESCE(companions, '[]'::jsonb) AS companions,
            to_at, from_at, request_type, status
     FROM photo_video_requests
     WHERE returned_at IS NULL
       AND status <> 'rejected'
     ORDER BY from_at DESC LIMIT 50`
  )

  for (const r of candidateRes.rows) {
    const companions: PhotoCompanion[] = Array.isArray(r.companions) ? r.companions : []

    // Check if main card matches and is not yet returned
    const mainCardActive = Boolean(r.photo_id_no?.trim() && !r.main_card_returned_at)
    const mainMatches = mainCardActive && matchesCard(r.photo_id_no, candidates)

    // Check if any companion card matches and is not yet returned
    const matchingCompIndex = companions.findIndex(
      (c) => c.photo_id_no?.trim() && !c.returned_at && matchesCard(c.photo_id_no, candidates)
    )

    if (mainMatches) {
      const nowIso = new Date().toISOString()
      const allCompanionsReturned = companions.every((c) => !c.photo_id_no?.trim() || Boolean(c.returned_at))
      if (allCompanionsReturned) {
        // Entire request is now complete!
        await query(
          `UPDATE photo_video_requests
           SET main_card_returned_at = now(),
               returned_at = now(),
               to_at = GREATEST(now(), from_at),
               returned_by = $2,
               return_notes = COALESCE(return_notes, 'Dikembalikan di Lobby via scan kartu ID')
           WHERE id = $1`,
          [r.id, username]
        )
      } else {
        // Only main card is returned so far; companions still hold cards
        await query(
          `UPDATE photo_video_requests
           SET main_card_returned_at = now(),
               returned_by = COALESCE(returned_by, $2)
           WHERE id = $1`,
          [r.id, username]
        )
      }

      return {
        id: r.id,
        requester_name: r.requester_name,
        photo_id_no: r.photo_id_no,
        to_at: nowIso,
        from_at: r.from_at,
        request_type: r.request_type,
      }
    }

    if (matchingCompIndex !== -1) {
      const nowIso = new Date().toISOString()
      const comp = { ...companions[matchingCompIndex], returned_at: nowIso }
      companions[matchingCompIndex] = comp

      const mainCardReturnedOrNone = !r.photo_id_no?.trim() || Boolean(r.main_card_returned_at)
      const allCompanionsReturned = companions.every((c) => !c.photo_id_no?.trim() || Boolean(c.returned_at))

      if (mainCardReturnedOrNone && allCompanionsReturned) {
        // Entire request is now complete!
        await query(
          `UPDATE photo_video_requests
           SET companions = $2::jsonb,
               returned_at = now(),
               to_at = GREATEST(now(), from_at),
               returned_by = $3,
               return_notes = COALESCE(return_notes, 'Dikembalikan di Lobby via scan kartu ID')
           WHERE id = $1`,
          [r.id, JSON.stringify(companions), username]
        )
      } else {
        // Companion card returned, others still active
        await query(
          `UPDATE photo_video_requests
           SET companions = $2::jsonb,
               returned_by = COALESCE(returned_by, $3)
           WHERE id = $1`,
          [r.id, JSON.stringify(companions), username]
        )
      }

      return {
        id: r.id,
        requester_name: `${comp.name} (rombongan ${r.requester_name})`,
        photo_id_no: comp.photo_id_no ?? null,
        to_at: nowIso,
        from_at: r.from_at,
        request_type: r.request_type,
        companion_name: comp.name,
      }
    }
  }

  return null
}
