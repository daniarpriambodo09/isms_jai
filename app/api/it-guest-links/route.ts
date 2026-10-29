// app/api/it-guest-links/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import {
  createItGuestAccessLinks,
  getItGuestAccessLinks,
  getItGuestAccessLinkByCodeOrToken,
  getNextMonthlySequence,
  deleteItGuestAccessLink,
} from '@/lib/it-guest-link-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code') || searchParams.get('token')

    if (code) {
      const link = await getItGuestAccessLinkByCodeOrToken(code)
      if (!link) {
        return NextResponse.json(
          { error: 'Link akses tamu tidak ditemukan atau sudah dihapus.' },
          { status: 404 }
        )
      }
      return NextResponse.json({ link })
    }

    const status = searchParams.get('status') || undefined
    const search = searchParams.get('q') || searchParams.get('search') || undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const [links, nextSeq] = await Promise.all([
      getItGuestAccessLinks({ status, search, limit }),
      getNextMonthlySequence(year, month),
    ])

    return NextResponse.json({
      links,
      period: {
        year,
        month,
        next_seq: nextSeq,
      },
    })
  } catch (error: any) {
    console.error('[api/it-guest-links] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memuat daftar link tamu IT' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const admin = await getAdminFromRequest(request)

    const companyName = body.company_name?.trim() || ''
    const department = body.department?.trim() || ''
    const visitDate = body.visit_date || new Date().toISOString().slice(0, 10)
    const visitEndDate = body.visit_end_date || visitDate
    const isWalkIn = Boolean(body.is_walk_in)
    const requestedCount = Math.min(Math.max(Number(body.count) || 0, 0), 50)

    let guestEntries: Array<{
      guest_name: string
      company_name?: string
      department?: string
      visit_date?: string
      visit_end_date?: string
    }> = []

    if (Array.isArray(body.guests) && body.guests.length > 0) {
      guestEntries = body.guests.map((g: any, idx: number) => ({
        guest_name: String(g.guest_name || g.name || '').trim() || `GUEST-${idx + 1}`,
        company_name: String(g.company_name ?? companyName).trim(),
        department: String(g.department ?? department).trim(),
        visit_date: g.visit_date || visitDate,
        visit_end_date: g.visit_end_date || visitEndDate,
      }))
    } else if (Array.isArray(body.guest_names) && body.guest_names.length > 0) {
      const targetLen = requestedCount > 0 ? requestedCount : body.guest_names.length
      for (let i = 0; i < targetLen; i++) {
        const rawName = String(body.guest_names[i] || '').trim()
        guestEntries.push({
          guest_name: rawName || 'GUEST',
          company_name: companyName,
          department,
          visit_date: visitDate,
          visit_end_date: visitEndDate,
        })
      }
    } else if (requestedCount > 0) {
      const baseName = typeof body.guest_name === 'string' && body.guest_name.trim() ? body.guest_name.trim() : 'GUEST'
      for (let i = 0; i < requestedCount; i++) {
        guestEntries.push({
          guest_name: requestedCount === 1 ? baseName : `${baseName}`,
          company_name: companyName,
          department,
          visit_date: visitDate,
          visit_end_date: visitEndDate,
        })
      }
    } else if (typeof body.guest_name === 'string' && body.guest_name.trim()) {
      const lines = body.guest_name
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter(Boolean)
      guestEntries = lines.map((name: string) => ({
        guest_name: name,
        company_name: companyName,
        department,
        visit_date: visitDate,
        visit_end_date: visitEndDate,
      }))
    }

    if (guestEntries.length === 0) {
      guestEntries = [
        {
          guest_name: 'GUEST',
          company_name: companyName,
          department,
          visit_date: visitDate,
          visit_end_date: visitEndDate,
        },
      ]
    }

    const createdLinks = await createItGuestAccessLinks({
      guests: guestEntries,
      is_walk_in: isWalkIn,
      created_by: admin?.username || body.created_by || (isWalkIn ? 'Walk-In / Pos Tamu IT' : 'Admin IT'),
    })

    return NextResponse.json(
      {
        success: true,
        message: `${createdLinks.length} link khusus tamu berhasil dibuat secara terpisah.`,
        links: createdLinks,
        link: createdLinks[0] || null,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[api/it-guest-links] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal membuat link akses tamu' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idParam = searchParams.get('id')
    if (!idParam || isNaN(Number(idParam))) {
      return NextResponse.json({ error: 'ID link tamu tidak valid' }, { status: 400 })
    }

    const deleted = await deleteItGuestAccessLink(Number(idParam), true)
    if (!deleted) {
      return NextResponse.json({ error: 'Data link tamu tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Link tamu berhasil dihapus.',
    })
  } catch (error: any) {
    console.error('[api/it-guest-links] DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus link tamu' },
      { status: 500 }
    )
  }
}
