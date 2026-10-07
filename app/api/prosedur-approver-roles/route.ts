// app/api/prosedur-approver-roles/route.ts
//
// The positions that sign off controlled documents (Unit Kerja/Jabatan, the
// person holding it, their email, signing order). Prosedur ISMS and Working
// Standard each have their own list (?kind=...); codes are unique across both.
// ism_admin only — the responses include email addresses. Editing a role's
// person re-points any approval still waiting on that role (see reassignRole).

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { EMAIL_HINT, isDeliverableEmail } from '@/lib/email-address'
import { logActivity } from '@/lib/activity-log'
import { getSmtpSettings } from '@/lib/smtp'
import { ensureApprovalSchema, listPendingSteps, listRoles, reassignRole, syncRoleInitials } from '@/lib/procedure-approval'
import { DOC_KINDS, docKindInfo, isDocKind, type DocKind } from '@/lib/document-kinds'
import { getApproverSetting } from '@/lib/special-area'
import { checkAppUrl } from '@/lib/app-url-check'

const kindOf = (value: unknown): DocKind => (isDocKind(value) ? value : 'procedure')


type RoleInput = { title: string; personName: string; initials: string | null; email: string | null; sortOrder: number; isDefault: boolean }

function parseRole(body: Record<string, unknown>): RoleInput | string {
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const personName = typeof body.personName === 'string' ? body.personName.trim() : ''
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
  // Printed under the signature box (TWC, MRA, …); empty = taken from the name.
  const initials = typeof body.initials === 'string' && body.initials.trim() ? body.initials.trim().toUpperCase() : null
  const sortOrder = Number(body.sortOrder)
  if (!title) return 'Unit Kerja (Jabatan) wajib diisi.'
  if (title.length > 150) return 'Unit Kerja (Jabatan) maksimal 150 karakter.'
  if (!personName) return 'Nama wajib diisi.'
  if (personName.length > 150) return 'Nama maksimal 150 karakter.'
  if (initials && !/^[A-Z0-9]{2,5}$/.test(initials)) return 'Inisial 2–5 huruf/angka tanpa spasi, mis. TWC.'
  if (email && !isDeliverableEmail(email)) return `Email tidak valid. ${EMAIL_HINT}`
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 99) return 'Urutan harus angka 1–99.'
  return { title, personName, initials, email, sortOrder, isDefault: body.isDefault === true }
}

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const kind = kindOf(request.nextUrl.searchParams.get('kind'))
    const [all, pending, smtp] = await Promise.all([listRoles(), listPendingSteps(), getSmtpSettings()])
    return NextResponse.json({
      kind,
      roles: all.filter((role) => role.kind === kind),
      pending: pending.filter((step) => step.kind === kind),
      // Per register: how many positions it has and how many documents are waiting.
      counts: Object.fromEntries(DOC_KINDS.map((k) => [k, {
        roles: all.filter((role) => role.kind === k).length,
        pending: pending.filter((step) => step.kind === k).length,
      }])),
      smtpReady: Boolean(smtp?.host && smtp.port && smtp.senderEmail),
      // App URL no longer matches this server's address (links in e-mails time out).
      appUrlWarning: checkAppUrl(smtp?.appUrl),
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
    const kind = kindOf(body.kind)
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!/^[A-Z0-9-]{2,20}$/.test(code)) return NextResponse.json({ message: 'Kode 2–20 karakter (huruf besar, angka, atau tanda hubung), mis. WPJU.' }, { status: 400 })
    const parsed = parseRole(body)
    if (typeof parsed === 'string') return NextResponse.json({ message: parsed }, { status: 400 })

    const exists = await query<{ kind: string }>('SELECT kind FROM procedure_approver_roles WHERE code = $1', [code])
    if (exists.rows[0]) {
      const where = exists.rows[0].kind === kind ? '' : ` di daftar ${docKindInfo(exists.rows[0].kind).label}`
      return NextResponse.json({ message: `Kode ${code} sudah dipakai${where}. Gunakan kode lain.` }, { status: 409 })
    }

    await query(
      `INSERT INTO procedure_approver_roles (code, kind, title, person_name, email, sort_order, is_default, updated_by, initials)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [code, kind, parsed.title, parsed.personName, parsed.email, parsed.sortOrder, parsed.isDefault, session.username, parsed.initials]
    )
    await logActivity(session, 'create', 'procedure_approver_role', code, `Menambahkan jabatan pengesahan ${docKindInfo(kind).label} "${parsed.title}" (${parsed.personName})`)
    return NextResponse.json({ roles: await listRoles(kind) }, { status: 201 })
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

    const before = await query<{ kind: DocKind; title: string; person_name: string; email: string | null }>('SELECT kind, title, person_name, email FROM procedure_approver_roles WHERE code = $1', [code])
    if (!before.rows[0]) return NextResponse.json({ message: 'Jabatan tidak ditemukan.' }, { status: 404 })
    const old = before.rows[0]

    await query(
      `UPDATE procedure_approver_roles
       SET title = $1, person_name = $2, email = $3, sort_order = $4, is_default = $5, updated_at = now(), updated_by = $6, initials = $8
       WHERE code = $7`,
      [parsed.title, parsed.personName, parsed.email, parsed.sortOrder, parsed.isDefault, session.username, code, parsed.initials]
    )
    // Steps not signed yet print the new initials.
    await syncRoleInitials(code)

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
    return NextResponse.json({ roles: await listRoles(old.kind), message })
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
    const used = await query<{ control_no: string }>('SELECT control_no FROM procedure_documents WHERE $1 = ANY(approval_roles) ORDER BY control_no', [code])
    if (used.rows.length > 0) {
      const names = used.rows.slice(0, 3).map((row) => row.control_no).join(', ')
      const more = used.rows.length > 3 ? ` dan ${used.rows.length - 3} lainnya` : ''
      return NextResponse.json({ message: `Jabatan ini masih dipakai di ${used.rows.length} dokumen (${names}${more}). Lepas centangnya dari dokumen tersebut dulu, atau cukup ganti nama orangnya.` }, { status: 409 })
    }
    // Izin Area Special may follow one of these positions for its approver.
    const special = await getApproverSetting().catch(() => null)
    if (special?.setting.mode === 'role' && special.setting.roleCode === code) {
      return NextResponse.json({ message: 'Jabatan ini dipakai sebagai approver Izin Area Special. Ganti approver-nya dulu di Kelola Izin Area Special.' }, { status: 409 })
    }
    const result = await query<{ title: string; kind: DocKind }>('DELETE FROM procedure_approver_roles WHERE code = $1 RETURNING title, kind', [code])
    if (!result.rows[0]) return NextResponse.json({ message: 'Jabatan tidak ditemukan.' }, { status: 404 })
    await logActivity(session, 'delete', 'procedure_approver_role', code, `Menghapus jabatan pengesahan ${docKindInfo(result.rows[0].kind).label} "${result.rows[0].title}"`)
    return NextResponse.json({ roles: await listRoles(result.rows[0].kind) })
  } catch (error) {
    console.error('[prosedur-approver-roles/DELETE]', error)
    return NextResponse.json({ message: 'Gagal menghapus jabatan.' }, { status: 500 })
  }
}
