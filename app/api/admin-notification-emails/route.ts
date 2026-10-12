// app/api/admin-notification-emails/route.ts
//
// ISM Admin only. GET: the extra addresses that receive admin notifications
// and the full list a notification goes to right now. PUT: replace the extra
// addresses. POST: send a test e-mail to that list.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'
import { sendToAdmins } from '@/lib/admin-mail'
import { MAX_EXTRA_ADMIN_EMAILS, adminRecipients, getExtraAdminEmails, saveExtraAdminEmails } from '@/lib/admin-recipients'
import { getSmtpSettings } from '@/lib/smtp'

export const dynamic = 'force-dynamic'

async function current() {
  const extra = await getExtraAdminEmails()
  const settings = await getSmtpSettings()
  const smtpReady = Boolean(settings?.host && settings.port && settings.senderEmail)
  const recipients = await adminRecipients(settings?.senderEmail ?? '')
  return {
    emails: extra.emails,
    updatedAt: extra.updatedAt,
    updatedBy: extra.updatedBy,
    max: MAX_EXTRA_ADMIN_EMAILS,
    recipients: recipients.to.filter(Boolean),
    usedFallback: recipients.usedFallback,
    smtpReady,
  }
}

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    return NextResponse.json(await current())
  } catch (error) {
    console.error('[admin-notification-emails/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat email notifikasi.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const body = await request.json().catch(() => ({})) as { emails?: unknown }
    const saved = await saveExtraAdminEmails(body.emails, session.username)
    if ('error' in saved) return NextResponse.json({ message: saved.error }, { status: 400 })
    await logActivity(session, 'update', 'admin_notification_emails', null, `Mengatur email notifikasi admin tambahan: ${saved.emails.length ? saved.emails.join(', ') : '(tidak ada)'}`)
    return NextResponse.json(await current())
  } catch (error) {
    console.error('[admin-notification-emails/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan email notifikasi.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const state = await current()
    if (!state.smtpReady) return NextResponse.json({ message: 'SMTP belum diatur (Kelola SMTP).' }, { status: 409 })
    const sent = await sendToAdmins(
      'Email uji — notifikasi Admin ISM',
      `<p>Ini email uji dari Portal ISMS, dikirim oleh <b>${session.username}</b>.</p><p>Alamat ini terdaftar sebagai penerima notifikasi Admin ISM (pengesahan dokumen, permintaan foto/video, pengingat review dokumen).</p>`
    )
    if (!sent) return NextResponse.json({ message: 'Email uji gagal dikirim — periksa pengaturan SMTP.' }, { status: 502 })
    return NextResponse.json({ sentTo: state.recipients })
  } catch (error) {
    console.error('[admin-notification-emails/POST]', error)
    return NextResponse.json({ message: 'Gagal mengirim email uji.' }, { status: 500 })
  }
}
