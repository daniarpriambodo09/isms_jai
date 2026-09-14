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

// Public — lets an internal employee check, by their own NIK, whether they've
// already submitted an Ijin Foto/Video request (and its status), without
// needing an admin account. Only their own rows come back, matched by exact
// NIK, and only the fields the requester already knows about their own
// submission — nothing about other people's requests.
export async function GET(request: NextRequest) {
  const nik = request.nextUrl.searchParams.get('nik')?.trim()
  if (!nik) return NextResponse.json({ message: 'NIK wajib diisi.' }, { status: 400 })

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
