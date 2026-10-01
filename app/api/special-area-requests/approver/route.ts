// app/api/special-area-requests/approver/route.ts
//
// ISM Admin: who approves "Ijin Masuk Area Special Security" requests —
// follow a position from Approver Pengesahan, or a name/title/email set by
// hand. Saving re-sends every still-pending request to the new approver.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { listRoles } from '@/lib/procedure-approval'
import { ensureSpecialAreaSchema, getApproverSetting, resendAllPending, resolveApprover, saveApproverSetting, type ApproverSetting } from '@/lib/special-area'
import { EMAIL_HINT, isDeliverableEmail } from '@/lib/email-address'

async function payload() {
  const [{ setting, updatedAt, updatedBy }, approver, roles] = await Promise.all([getApproverSetting(), resolveApprover(), listRoles()])
  return {
    setting,
    approver,
    updatedAt,
    updatedBy,
    roles: roles.map((r) => ({ code: r.code, title: r.title, person_name: r.person_name, email: r.email })),
  }
}

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureSpecialAreaSchema()
    return NextResponse.json(await payload())
  } catch (error) {
    console.error('[special-area-requests/approver/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat pengaturan approver.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    await ensureSpecialAreaSchema()
    const body = await request.json().catch(() => ({}))
    let setting: ApproverSetting

    if (body.mode === 'role') {
      const roleCode = typeof body.roleCode === 'string' ? body.roleCode : ''
      if (!(await listRoles()).some((r) => r.code === roleCode)) return NextResponse.json({ message: 'Jabatan tidak ditemukan.' }, { status: 400 })
      setting = { mode: 'role', roleCode }
    } else if (body.mode === 'custom') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 150) : ''
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 150) : ''
      const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
      if (!name) return NextResponse.json({ message: 'Nama approver wajib diisi.' }, { status: 400 })
      if (!title) return NextResponse.json({ message: 'Jabatan approver wajib diisi.' }, { status: 400 })
      if (email && !isDeliverableEmail(email)) return NextResponse.json({ message: `Email tidak valid. ${EMAIL_HINT}` }, { status: 400 })
      setting = { mode: 'custom', name, title, email }
    } else {
      return NextResponse.json({ message: 'Mode tidak valid.' }, { status: 400 })
    }

    const before = await resolveApprover()
    await saveApproverSetting(setting, session.username)
    const after = await resolveApprover()
    const changed = before.name !== after.name || before.email !== after.email || before.title !== after.title
    const resent = changed ? await resendAllPending() : { sent: 0, failed: 0 }

    await logActivity(session, 'update', 'special_area_approver', null, `Mengatur approver Izin Area Special: ${after.name ?? '-'} (${after.title ?? '-'})`)
    let message = 'Pengaturan approver disimpan.'
    if (resent.sent) message += ` ${resent.sent} pengajuan yang menunggu dikirim ulang ke ${after.name}.`
    if (resent.failed) message += ` ${resent.failed} email gagal dikirim — periksa email approver & SMTP.`
    return NextResponse.json({ ...(await payload()), message })
  } catch (error) {
    console.error('[special-area-requests/approver/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan pengaturan approver.' }, { status: 500 })
  }
}
