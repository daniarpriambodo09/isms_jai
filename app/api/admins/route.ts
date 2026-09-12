// app/api/admins/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getIsmsAdminFromRequest, type AdminRole } from '@/lib/auth'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

type AdminRow = { id: number; username: string; email: string | null; role: AdminRole; created_at: string }
const ROLES: AdminRole[] = ['ism_admin', 'lobby', 'security']

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const result = await query<AdminRow>('SELECT id, username, email, role, created_at FROM admins ORDER BY created_at ASC')
    return NextResponse.json({ admins: result.rows })
  } catch (error) {
    console.error('[admins/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat daftar admin.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getIsmsAdminFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  try {
    const body = await request.json() as { username?: string; password?: string; role?: string; email?: string }
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim() : null
    const role = body.role

    if (!username) return NextResponse.json({ message: 'Username wajib diisi.' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ message: 'Password minimal 6 karakter.' }, { status: 400 })
    if (!role || !ROLES.includes(role as AdminRole)) return NextResponse.json({ message: 'Role tidak valid.' }, { status: 400 })

    const existing = await query('SELECT 1 FROM admins WHERE username = $1', [username])
    if (existing.rows.length > 0) return NextResponse.json({ message: 'Username sudah dipakai.' }, { status: 409 })

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await query<AdminRow>(
      'INSERT INTO admins (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
      [username, email, passwordHash, role]
    )
    const created = result.rows[0]

    await logActivity(session, 'create', 'admin', created.id, `Membuat akun admin "${created.username}" (role: ${created.role})`)

    return NextResponse.json({ admin: created }, { status: 201 })
  } catch (error) {
    console.error('[admins/POST]', error)
    return NextResponse.json({ message: 'Gagal membuat akun admin.' }, { status: 500 })
  }
}
