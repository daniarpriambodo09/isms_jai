import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

type Status = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
type TrainingRow = {
  id: number
  start_date: string
  end_date: string
  period_label: string | null
  title: string
  audience: string | null
  pic: string | null
  status: Status
  sort_order: number
}
type TrainingInput = {
  startDate?: string
  endDate?: string
  periodLabel?: string | null
  title?: string
  audience?: string | null
  pic?: string | null
  status?: string
}

const STATUSES: Status[] = ['scheduled', 'ongoing', 'completed', 'cancelled']
function isStatus(value: string): value is Status { return (STATUSES as string[]).includes(value) }

const SELECT_COLUMNS = `id, start_date, end_date, period_label, title, audience, pic, status, sort_order`

export async function GET() {
  try {
    const result = await query<TrainingRow>(`SELECT ${SELECT_COLUMNS} FROM training_schedule ORDER BY start_date ASC, id ASC`)
    return NextResponse.json({ items: result.rows })
  } catch (error) {
    console.error('[training-schedule/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat jadwal training.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!getAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json() as TrainingInput
    if (!body.startDate || !body.endDate) return NextResponse.json({ message: 'Tanggal mulai dan selesai wajib diisi.' }, { status: 400 })
    if (typeof body.title !== 'string' || !body.title.trim()) return NextResponse.json({ message: 'Judul wajib diisi.' }, { status: 400 })
    const status: Status = typeof body.status === 'string' && isStatus(body.status) ? body.status : 'scheduled'

    const nextOrder = await query<{ next: number }>('SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM training_schedule')
    const result = await query<TrainingRow>(
      `INSERT INTO training_schedule (start_date, end_date, period_label, title, audience, pic, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT_COLUMNS}`,
      [body.startDate, body.endDate, body.periodLabel ?? null, body.title.trim(), body.audience ?? null, body.pic ?? null, status, nextOrder.rows[0].next]
    )
    return NextResponse.json({ item: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[training-schedule/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan jadwal training.' }, { status: 500 })
  }
}
