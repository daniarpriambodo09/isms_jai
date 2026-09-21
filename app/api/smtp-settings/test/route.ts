// app/api/smtp-settings/test/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { getSmtpSettings, verifySmtpConnection, type Encryption } from '@/lib/smtp'

const ENCRYPTIONS: Encryption[] = ['none', 'tls', 'ssl']
function isEncryption(value: unknown): value is Encryption {
  return typeof value === 'string' && (ENCRYPTIONS as string[]).includes(value)
}

// Verifies the SMTP connection/auth without sending an actual email — lets
// the admin check the "Test SMTP" button against either the saved settings
// or whatever is currently typed in the form (unsaved edits included).
export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json().catch(() => ({}))
    const hasOverride = typeof body.host === 'string' && body.host.trim()

    const settings = hasOverride
      ? {
          host: body.host.trim(),
          port: Number(body.port),
          encryption: isEncryption(body.encryption) ? body.encryption : 'none',
          username: typeof body.username === 'string' && body.username.trim() ? body.username.trim() : null,
          password: typeof body.password === 'string' && body.password ? body.password : null,
          senderEmail: typeof body.senderEmail === 'string' ? body.senderEmail.trim() : null,
          appUrl: typeof body.appUrl === 'string' ? body.appUrl.trim() : null,
          updatedAt: null,
        }
      : await getSmtpSettings()

    if (!settings || !settings.host || !settings.port) {
      return NextResponse.json({ message: 'Konfigurasi SMTP belum lengkap.' }, { status: 400 })
    }

    await verifySmtpConnection(settings)
    return NextResponse.json({ message: 'Koneksi SMTP berhasil.' })
  } catch (error) {
    console.error('[smtp-settings/test/POST]', error)
    const message = error instanceof Error ? error.message : 'Gagal terhubung ke server SMTP.'
    return NextResponse.json({ message: `Koneksi SMTP gagal: ${message}` }, { status: 400 })
  }
}
