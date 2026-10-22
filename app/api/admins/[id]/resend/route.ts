// app/api/admins/[id]/resend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import path from 'path'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'
import { getSmtpSettings, sendMail } from '@/lib/smtp'
import { buildAccountCreatedEmail, LOGO_CID } from '@/lib/email-templates'
import { resolveAppBaseUrl } from '@/lib/request-origin'
import { API_BASE_PATH } from '@/lib/config'

type AdminRow = { id: number; username: string; email: string | null; role: string }

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return NextResponse.json({ message: 'ID tidak valid.' }, { status: 400 })
  const session = getIsmsAdminFromRequest(request)
  if (!session || session.role !== 'ism_admin') return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const existing = await query<AdminRow>('SELECT id, username, email, role FROM admins WHERE id = $1', [id])
    const target = existing.rows[0]
    if (!target) return NextResponse.json({ message: 'Akun admin tidak ditemukan.' }, { status: 404 })
    if (!target.email || !target.email.trim()) {
      return NextResponse.json({ message: 'Akun ini belum memiliki alamat email dinas terdaftar.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({})) as { password?: string }
    const temporaryPassword = typeof body?.password === 'string' && body.password.trim().length >= 6
      ? body.password.trim()
      : `JAI@${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    const newHash = await bcrypt.hash(temporaryPassword, 10)
    await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, id])

    const settings = await getSmtpSettings()
    if (!settings?.host || !settings.port || !settings.senderEmail) {
      return NextResponse.json({ message: 'Pengaturan SMTP belum lengkap. Silakan atur di Pengaturan SMTP.' }, { status: 500 })
    }

    const base = `${resolveAppBaseUrl(settings.appUrl)}${API_BASE_PATH}`
    const loginUrl = `${base}/login`
    const dashboardUrl = `${base}/persetujuan-saya`

    const { subject, html } = buildAccountCreatedEmail({
      recipientName: target.username,
      username: target.username,
      password: temporaryPassword,
      role: target.role,
      email: target.email,
      loginUrl,
      dashboardUrl,
    })

    const logoPath = path.join(process.cwd(), 'public', 'images', 'yazaki-logo.jpg')
    const attachments = [{ filename: 'yazaki-logo.jpg', path: logoPath, cid: LOGO_CID }]

    await sendMail(settings, {
      to: target.email,
      subject,
      html,
      attachments,
    })

    await logActivity(session, 'update', 'admin', target.id, `Mengirim ulang email kredensial akun "${target.username}" ke ${target.email}`)

    return NextResponse.json({
      success: true,
      message: `Email ucapan selamat & kredensial berhasil dikirim ulang ke ${target.email}.`,
      temporaryPassword,
    })
  } catch (error) {
    console.error('[admins/[id]/resend/POST]', error)
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Gagal mengirim ulang email kredensial.' }, { status: 500 })
  }
}
