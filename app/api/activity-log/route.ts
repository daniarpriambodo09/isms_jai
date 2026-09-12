// app/api/activity-log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type ActivityLogRow = {
  id: number
  actor_username: string
  actor_role: string
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  created_at: string
}

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 200) || 200))
    const result = await query<ActivityLogRow>(
      'SELECT id, actor_username, actor_role, action, entity_type, entity_id, description, created_at FROM activity_log ORDER BY created_at DESC LIMIT $1',
      [limit]
    )
    return NextResponse.json({ entries: result.rows })
  } catch (error) {
    console.error('[activity-log/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat log aktivitas.' }, { status: 500 })
  }
}
