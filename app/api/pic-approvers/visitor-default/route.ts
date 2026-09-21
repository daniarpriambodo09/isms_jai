// app/api/pic-approvers/visitor-default/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type VisitorDefaultRow = { id: number; name: string; full_name: string | null; title: string | null; email: string | null; updated_at: string | null }

// Public — the Visitor Ijin Foto/Video form needs the approver's display
// name/title to show who the request is routed to; the email address is
// withheld here and only returned to a logged-in ISM Admin (below), since
// it's not meant to be visible on a public form.
export async function GET(request: NextRequest) {
  try {
    const result = await query<VisitorDefaultRow>(
      `SELECT id, name, full_name, title, email, created_at AS updated_at FROM pic_approvers WHERE is_visitor_default = true LIMIT 1`
    )
    const row = result.rows[0] ?? null
    const isAdmin = !!getIsmsAdminFromRequest(request)
    if (!row) return NextResponse.json({ approver: null })
    return NextResponse.json({
      approver: {
        id: row.id,
        code: row.name,
        fullName: row.full_name,
        title: row.title,
        email: isAdmin ? row.email : null,
      },
    })
  } catch (error) {
    console.error('[pic-approvers/visitor-default/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat approver visitor.' }, { status: 500 })
  }
}

// ISM Admin only — sets/updates the single PIC marked as the Visitor
// default approver. Reuses an existing PIC row by code (case-insensitive)
// when one exists, otherwise creates a new general-purpose PIC (no
// department) for it. Only one row can carry is_visitor_default = true,
// enforced by a partial unique index — so any previous default is cleared
// first here to avoid tripping it.
export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null
    const email = typeof body.email === 'string' ? body.email.trim() : ''

    if (!code) return NextResponse.json({ message: 'Kode PIC wajib diisi.' }, { status: 400 })
    if (!fullName) return NextResponse.json({ message: 'Nama lengkap wajib diisi.' }, { status: 400 })
    if (!email) return NextResponse.json({ message: 'Email wajib diisi.' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: 'Format email tidak valid.' }, { status: 400 })

    await query('UPDATE pic_approvers SET is_visitor_default = false WHERE is_visitor_default = true AND name <> $1', [code])

    const existing = await query<{ id: number }>('SELECT id FROM pic_approvers WHERE name = $1', [code])
    const result = existing.rows[0]
      ? await query<VisitorDefaultRow>(
          `UPDATE pic_approvers SET full_name = $2, title = $3, email = $4, is_visitor_default = true
           WHERE id = $1 RETURNING id, name, full_name, title, email, created_at AS updated_at`,
          [existing.rows[0].id, fullName, title, email]
        )
      : await query<VisitorDefaultRow>(
          `INSERT INTO pic_approvers (name, department_id, full_name, title, email, is_visitor_default)
           VALUES ($1, NULL, $2, $3, $4, true)
           RETURNING id, name, full_name, title, email, created_at AS updated_at`,
          [code, fullName, title, email]
        )

    const row = result.rows[0]
    await logActivity(session, 'update', 'pic_approvers', row.id, `Mengatur approver default Visitor: ${row.name} (${fullName})`)
    return NextResponse.json({ approver: { id: row.id, code: row.name, fullName: row.full_name, title: row.title, email: row.email } })
  } catch (error) {
    console.error('[pic-approvers/visitor-default/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan approver visitor.' }, { status: 500 })
  }
}
