// app/api/photo-video-requests/lookup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

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

// Public — lets a requester check the status of what they submitted, without
// needing an admin account. Two lookup modes, and only the fields the
// requester already knows about their own submission come back — nothing
// about other people's requests:
// - `nik`: an internal employee's history (every request under that NIK).
// - `ref`: a single request by its reference number (the numeric id shown
//   right after submitting) — works for internal AND visitor requests,
//   since visitors have no NIK to look up by.
export async function GET(request: NextRequest) {
  const nik = request.nextUrl.searchParams.get('nik')?.trim()
  const ref = request.nextUrl.searchParams.get('ref')?.trim()

  if (ref) {
    if (!/^\d+$/.test(ref)) return NextResponse.json({ message: 'Nomor referensi tidak valid.' }, { status: 400 })
    try {
      const result = await query<LookupRow>(
        `SELECT id, requester_name, location, from_at, to_at, status, taken_at, submitted_at
         FROM photo_video_requests
         WHERE id = $1`,
        [ref]
      )
      if (result.rows.length === 0) return NextResponse.json({ message: 'Pengajuan dengan nomor referensi itu tidak ditemukan.' }, { status: 404 })
      return NextResponse.json({ requests: result.rows })
    } catch (error) {
      console.error('[photo-video-requests/lookup/GET ref]', error)
      return NextResponse.json({ message: 'Gagal memuat status pengajuan.' }, { status: 500 })
    }
  }

  if (!nik) return NextResponse.json({ message: 'NIK atau nomor referensi wajib diisi.' }, { status: 400 })

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
// number, but only while it's still pending. Once an admin has decided it
// (approved/rejected), self-service cancellation is closed — from that point
// changing it is an admin action, not the requester's.
export async function DELETE(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get('ref')?.trim()
  if (!ref || !/^\d+$/.test(ref)) return NextResponse.json({ message: 'Nomor referensi tidak valid.' }, { status: 400 })

  try {
    const result = await query<{ id: number; status: string }>(
      `DELETE FROM photo_video_requests WHERE id = $1 AND status = 'pending' RETURNING id, status`,
      [ref]
    )
    if (result.rows.length === 0) {
      const existing = await query<{ status: string }>('SELECT status FROM photo_video_requests WHERE id = $1', [ref])
      const message = existing.rows.length > 0
        ? 'Pengajuan ini sudah diputuskan admin dan tidak bisa dibatalkan sendiri lagi.'
        : 'Pengajuan dengan nomor referensi itu tidak ditemukan.'
      return NextResponse.json({ message }, { status: 409 })
    }
    return NextResponse.json({ message: 'Pengajuan dibatalkan.' })
  } catch (error) {
    console.error('[photo-video-requests/lookup/DELETE]', error)
    return NextResponse.json({ message: 'Gagal membatalkan pengajuan.' }, { status: 500 })
  }
}
