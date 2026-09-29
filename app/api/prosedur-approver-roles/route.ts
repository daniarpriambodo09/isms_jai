// app/api/prosedur-approver-roles/route.ts
//
// The positions that sign off Prosedur ISMS documents (Unit Kerja/Jabatan,
// the person holding it, their email, signing order). ism_admin only —
// the responses include email addresses. Editing a role's person re-points
// any approval still waiting on that role (see reassignRole).

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { getSmtpSettings } from '@/lib/smtp'
import { ensureApprovalSchema, listPendingSteps, listRoles, reassignRole } from '@/lib/procedure-approval'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type RoleInput = { title: string; personName: string; email: string | null; sortOrder: number; isDefault: boolean }

function parseRole(body: Record<string, unknown>): RoleInput | string {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const personName = typeof body.personName === 'string' ? body.personName.trim() : ''
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
  const sortOrder = Number(body.sortOrder)
  if (!title) return 'Unit Kerja (Jabatan) wajib diisi.'
  if (title.length > 150) return 'Unit Kerja (Jabatan) maksimal 150 karakter.'
  if (!personName) return 'Nama wajib diisi.'
  if (personName.length > 150) return 'Nama maksimal 150 karakter.'
  if (email && !EMAIL_RE.test(email)) return 'Format email tidak valid.'
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 99) return 'Urutan harus angka 1–99.'
  return { title, personName, email, sortOrder, isDefault: body.isDefault === true }
}

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const [roles, pending, smtp] = await Promise.all([listRoles(), listPendingSteps(), getSmtpSettings()])
    return NextResponse.json({
      roles,
      pending,
      smtpReady: Boolean(smtp?.host && smtp.port && smtp.senderEmail),
    })
  } catch (error) {
    console.error('[prosedur-approver-roles/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar approver.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureApprovalSchema()
    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!/^[A-Z0-9-]{2,20}$/.test(code)) return NextResponse.json({ message: 'Kode 2–20 karakter (huruf besar/angka), mis. WPJU.' }, { status: 400 })
    const parsed = parseRole(body)
    if (typeof parsed === 'string') return NextResponse.json({ message: parsed }, { status: 400 })

    const exists = await query('SELECT 1 FROM procedure_approver_roles WHERE code = $1', [code])
    if (exists.rows.length) return NextResponse.json({ message: `Kode ${code} sudah dipakai.` }, { status: 409 })

    await query(
      `INSERT INTO procedure_approver_roles (code, title, person_name, email, sort_order, is_default, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [code, parsed.title, parsed.personName, parsed.email, parsed.sortOrder, parsed.isDefault, session.username]
    )
    await logActivity(session, 'create', 'procedure_approver_role', code, `Menambahkan jabatan pengesahan "${parsed.title}" (${parsed.personName})`)
    return NextResponse.json({ roles: await listRoles() }, { status: 201 })
  } catch (error) {
    console.error('[prosedur-approver-roles/POST]', error)
    return NextResponse.json({ message: 'Gagal menambahkan jabatan.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureApprovalSchema()
    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code : ''
    const parsed = parseRole(body)
    if (typeof parsed === 'string') return NextResponse.json({ message: parsed }, { status: 400 })

    const before = await query<{ title: string; person_name: string; email: string | null }>('SELECT title, person_name, email FROM procedure_approver_roles WHERE code = $1', [code])
    if (!before.rows[0]) return NextResponse.json({ message: 'Jabatan tidak ditemukan.' }, { status: 404 })
    const old = before.rows[0]

    await query(
      `UPDATE procedure_approver_roles
       SET title = $1, person_name = $2, email = $3, sort_order = $4, is_default = $5, updated_at = now(), updated_by = $6
       WHERE code = $7`,
      [parsed.title, parsed.personName, parsed.email, parsed.sortOrder, parsed.isDefault, session.username, code]
    )

    const holderChanged = old.person_name !== parsed.personName || (old.email ?? '') !== (parsed.email ?? '') || old.title !== parsed.title
    let reassigned = { resent: 0, failed: 0 }
    if (holderChanged) reassigned = await reassignRole(code)

    await logActivity(
      session, 'update', 'procedure_approver_role', code,
      old.person_name !== parsed.personName
        ? `Mengganti ${parsed.title}: "${old.person_name}" → "${parsed.personName}"`
        : `Mengubah data jabatan pengesahan "${parsed.title}"`
    )

    let message = 'Perubahan disimpan.'
    if (reassigned.resent) message += ` ${reassigned.resent} permintaan pengesahan yang menunggu telah dikirim ulang ke ${parsed.personName}.`
    if (reassigned.failed) message += ` ${reassigned.failed} email gagal dikirim — cek email & SMTP.`
    return NextResponse.json({ roles: await listRoles(), message })
  } catch (error) {
    console.error('[prosedur-approver-roles/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan perubahan.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureApprovalSchema()
    const code = request.nextUrl.searchParams.get('code') ?? ''
    const used = await query<{ count: string }>('SELECT COUNT(*) FROM procedure_documents WHERE $1 = ANY(approval_roles)', [code])
    if (Number(used.rows[0].count) > 0) {
      return NextResponse.json({ message: `Jabatan ini masih dipakai di ${used.rows[0].count} dokumen. Hapus dari dokumen tersebut dulu, atau cukup ganti nama orangnya.` }, { status: 409 })
    }
    const result = await query<{ title: string }>('DELETE FROM procedure_approver_roles WHERE code = $1 RETURNING title', [code])
    if (!result.rows[0]) return NextResponse.json({ message: 'Jabatan tidak ditemukan.' }, { status: 404 })
    await logActivity(session, 'delete', 'procedure_approver_role', code, `Menghapus jabatan pengesahan "${result.rows[0].title}"`)
    return NextResponse.json({ roles: await listRoles() })
  } catch (error) {
    console.error('[prosedur-approver-roles/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus jabatan.' }, { status: 500 })
  }
}
