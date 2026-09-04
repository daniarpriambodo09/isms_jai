import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json() as TrainingInput
    if (!body.startDate || !body.endDate) return NextResponse.json({ message: 'Tanggal mulai dan selesai wajib diisi.' }, { status: 400 })
    if (typeof body.title !== 'string' || !body.title.trim()) return NextResponse.json({ message: 'Judul wajib diisi.' }, { status: 400 })
    const status: Status = typeof body.status === 'string' && isStatus(body.status) ? body.status : 'scheduled'

    const result = await query<TrainingRow>(
      `UPDATE training_schedule
       SET start_date = $1, end_date = $2, period_label = $3, title = $4, audience = $5, pic = $6, status = $7
       WHERE id = $8
       RETURNING ${SELECT_COLUMNS}`,
      [body.startDate, body.endDate, body.periodLabel ?? null, body.title.trim(), body.audience ?? null, body.pic ?? null, status, id]
    )
    if (result.rows.length === 0) return NextResponse.json({ message: 'Jadwal training tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ item: result.rows[0] })
  } catch (error) {
    console.error('[training-schedule/[id]/PUT]', error)
    return NextResponse.json({ message: 'Gagal memperbarui jadwal training.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const result = await query('DELETE FROM training_schedule WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) return NextResponse.json({ message: 'Jadwal training tidak ditemukan.' }, { status: 404 })
    return NextResponse.json({ message: 'Jadwal training dihapus.' })
  } catch (error) {
    console.error('[training-schedule/[id]/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus jadwal training.' }, { status: 500 })
  }
}
