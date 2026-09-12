// app/api/auth/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

export async function PUT(request: NextRequest) {
  const session = getAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json() as { currentPassword?: string; newPassword?: string }
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

    if (!currentPassword) return NextResponse.json({ message: 'Password saat ini wajib diisi.' }, { status: 400 })
    if (newPassword.length < 6) return NextResponse.json({ message: 'Password baru minimal 6 karakter.' }, { status: 400 })

    const result = await query<{ password_hash: string }>('SELECT password_hash FROM admins WHERE id = $1', [session.sub])
    const admin = result.rows[0]
    if (!admin || !(await bcrypt.compare(currentPassword, admin.password_hash))) {
      return NextResponse.json({ message: 'Password saat ini salah.' }, { status: 401 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await query('UPDATE admins SET password_hash = $1 WHERE id = $2', [passwordHash, session.sub])
    await logActivity(session, 'update', 'admin', session.sub, 'Mengubah password sendiri')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[auth/change-password]', error)
    return NextResponse.json({ message: 'Gagal mengubah password.' }, { status: 500 })
  }
}
