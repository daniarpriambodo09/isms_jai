// app/api/photo-video-requests/lookup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { isRateLimited } from '@/lib/rate-limit'

type LookupRow = {
  id: number
  requester_name: string
  location: string
  from_at: string
  to_at: string
  status: 'pending' | 'approved' | 'rejected'
  taken_at: string | null
  submitted_at: string
}

// A reference code is "<id>-<10 hex chars>", e.g. "42-A1B2C3D4E5" — the
// secret half is what proves the caller is the one who submitted it. The
// bare sequential id alone would let anyone look up or cancel other
// people's requests just by counting.
function parseRef(value: string): { id: number; token: string } | null {
  const match = /^(\d+)-([0-9A-Fa-f]{10})$/.exec(value)
  return match ? { id: Number(match[1]), token: match[2].toUpperCase() } : null
}

function clientIp(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

const tooMany = () => NextResponse.json({ message: 'Terlalu banyak percobaan. Coba lagi sebentar.' }, { status: 429 })

// Public — lets a requester check the status of what they submitted, without
// needing an admin account. Two lookup modes, and only the fields the
// requester already knows about their own submission come back — nothing
// about other people's requests:
// - `nik`: an internal employee's history (every request under that NIK).
// - `ref`: a single request by its reference code (shown right after
//   submitting) — works for internal AND visitor requests, since visitors
//   have no NIK to look up by.
export async function GET(request: NextRequest) {
  if (isRateLimited(`lookup-get:${clientIp(request)}`, 20, 60_000)) return tooMany()

  const nik = request.nextUrl.searchParams.get('nik')?.trim()
  const ref = request.nextUrl.searchParams.get('ref')?.trim()

  if (ref) {
    const parsed = parseRef(ref)
    if (!parsed) return NextResponse.json({ message: 'Kode referensi tidak valid. Formatnya seperti 42-A1B2C3D4E5.' }, { status: 400 })
    try {
      const result = await query<LookupRow>(
        `SELECT id, requester_name, location, from_at, to_at, status, taken_at, submitted_at
         FROM photo_video_requests
         WHERE id = $1 AND ref_token = $2`,
        [parsed.id, parsed.token]
      )
      if (result.rows.length === 0) return NextResponse.json({ message: 'Pengajuan dengan kode referensi itu tidak ditemukan.' }, { status: 404 })
      return NextResponse.json({ requests: result.rows })
    } catch (error) {
      console.error('[photo-video-requests/lookup/GET ref]', error)
      return NextResponse.json({ message: 'Gagal memuat status pengajuan.' }, { status: 500 })
    }
  }

  if (!nik) return NextResponse.json({ message: 'NIK atau kode referensi wajib diisi.' }, { status: 400 })

  try {
    const result = await query<LookupRow>(
      `SELECT id, requester_name, location, from_at, to_at, status, taken_at, submitted_at
       FROM photo_video_requests
       WHERE nik = $1 AND request_type = 'internal'
       ORDER BY submitted_at DESC
       LIMIT 20`,
      [nik]
    )
    return NextResponse.json({ requests: result.rows })
  } catch (error) {
    console.error('[photo-video-requests/lookup/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat riwayat pengajuan.' }, { status: 500 })
  }
}

// Public — lets a requester cancel their own request by its reference
// code, but only while it's still pending. Once decided (approved/rejected),
// self-service cancellation is closed — from that point changing it is an
// admin action, not the requester's.
export async function DELETE(request: NextRequest) {
  if (isRateLimited(`lookup-delete:${clientIp(request)}`, 10, 60_000)) return tooMany()

  const parsed = parseRef(request.nextUrl.searchParams.get('ref')?.trim() ?? '')
  if (!parsed) return NextResponse.json({ message: 'Kode referensi tidak valid. Formatnya seperti 42-A1B2C3D4E5.' }, { status: 400 })

  try {
    const result = await query<{ id: number }>(
      `DELETE FROM photo_video_requests WHERE id = $1 AND ref_token = $2 AND status = 'pending' RETURNING id`,
      [parsed.id, parsed.token]
    )
    if (result.rows.length === 0) {
      const existing = await query<{ status: string }>('SELECT status FROM photo_video_requests WHERE id = $1 AND ref_token = $2', [parsed.id, parsed.token])
      const message = existing.rows.length > 0
        ? 'Pengajuan ini sudah diputuskan dan tidak bisa dibatalkan sendiri lagi.'
        : 'Pengajuan dengan kode referensi itu tidak ditemukan.'
      return NextResponse.json({ message }, { status: existing.rows.length > 0 ? 409 : 404 })
    }
    return NextResponse.json({ message: 'Pengajuan dibatalkan.' })
  } catch (error) {
    console.error('[photo-video-requests/lookup/DELETE]', error)
    return NextResponse.json({ message: 'Gagal membatalkan pengajuan.' }, { status: 500 })
  }
}
