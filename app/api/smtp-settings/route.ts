// app/api/smtp-settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { getSmtpSettings, saveSmtpSettings, type Encryption } from '@/lib/smtp'
import { logActivity } from '@/lib/activity-log'

const ENCRYPTIONS: Encryption[] = ['none', 'tls', 'ssl']
function isEncryption(value: unknown): value is Encryption {
  return typeof value === 'string' && (ENCRYPTIONS as string[]).includes(value)
}

// ism_admin only — SMTP credentials are sensitive, so this stays out of the
// public/kiosk-readable API surface entirely (unlike departments, cameras, etc).
export async function GET(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const settings = await getSmtpSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[smtp-settings/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat pengaturan SMTP.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json()
    const host = typeof body.host === 'string' ? body.host.trim() : ''
    const port = Number(body.port)
    const encryption = isEncryption(body.encryption) ? body.encryption : 'none'
    const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim() : null
    const password = typeof body.password === 'string' && body.password ? body.password : null
    const senderEmail = typeof body.senderEmail === 'string' ? body.senderEmail.trim() : ''
    const appUrl = typeof body.appUrl === 'string' ? body.appUrl.trim() : ''

    if (!host) return NextResponse.json({ message: 'SMTP Host wajib diisi.' }, { status: 400 })
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return NextResponse.json({ message: 'SMTP Port tidak valid.' }, { status: 400 })
    if (!senderEmail) return NextResponse.json({ message: 'Email Pengirim wajib diisi.' }, { status: 400 })
    if (!appUrl) return NextResponse.json({ message: 'App URL wajib diisi.' }, { status: 400 })

    const settings = await saveSmtpSettings({ host, port, encryption, username, password, senderEmail, appUrl })
    await logActivity(session, 'update', 'smtp_settings', null, 'Memperbarui pengaturan SMTP')
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('[smtp-settings/PUT]', error)
    return NextResponse.json({ message: 'Gagal menyimpan pengaturan SMTP.' }, { status: 500 })
  }
}
