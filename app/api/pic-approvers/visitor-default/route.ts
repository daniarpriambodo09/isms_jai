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

// pic_approvers.name ("kode PIC") started out as a short label an admin
// typed by hand, but it's really just an internal identifier — nothing
// user-facing prioritizes it over full_name — so the admin no longer types
// it at all. This derives a reasonable one from the full name (initials,
// e.g. "Daniar Priambodo" -> "DP") so the NOT NULL column still gets a
// sensible value on first-time setup.
function deriveCode(fullName: string): string {
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
  return initials.slice(0, 10) || 'PIC'
}

// ISM Admin only — sets/updates the single PIC marked as the Visitor
// default approver. Always updates whichever row currently carries
// is_visitor_default = true (its own "kode PIC" stays untouched); only
// when none exists yet does this create a new one, with an auto-derived
// code — the admin manages name/jabatan/email only, never the code.
export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null
    const email = typeof body.email === 'string' ? body.email.trim() : ''

    if (!fullName) return NextResponse.json({ message: 'Nama lengkap wajib diisi.' }, { status: 400 })
    if (!email) return NextResponse.json({ message: 'Email wajib diisi.' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: 'Format email tidak valid.' }, { status: 400 })

    const existing = await query<{ id: number }>('SELECT id FROM pic_approvers WHERE is_visitor_default = true LIMIT 1')
    const result = existing.rows[0]
      ? await query<VisitorDefaultRow>(
          `UPDATE pic_approvers SET full_name = $2, title = $3, email = $4
           WHERE id = $1 RETURNING id, name, full_name, title, email, created_at AS updated_at`,
          [existing.rows[0].id, fullName, title, email]
        )
      : await query<VisitorDefaultRow>(
          `INSERT INTO pic_approvers (name, department_id, full_name, title, email, is_visitor_default)
           VALUES ($1, NULL, $2, $3, $4, true)
           RETURNING id, name, full_name, title, email, created_at AS updated_at`,
          [deriveCode(fullName), fullName, title, email]
        )

    const row = result.rows[0]
    await logActivity(session, 'update', 'pic_approvers', row.id, `Mengatur approver default Visitor: ${fullName}`)
    return NextResponse.json({ approver: { id: row.id, fullName: row.full_name, title: row.title, email: row.email } })
  } catch (error) {
    console.error('[pic-approvers/visitor-default/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan approver visitor.' }, { status: 500 })
  }
}
