import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

// Past guests (name / company) for autofill when registering a returning visitor.
export async function GET(request: NextRequest) {
  if (!getKioskAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ history: [] })

  try {
    const result = await query<{ full_name: string; id_card: string; company_remark: string; pic_jai: string; visits: string }>(
      `SELECT full_name, id_card, company_remark, (array_agg(pic_jai ORDER BY registered_at DESC))[1] AS pic_jai, count(*)::text AS visits
       FROM vendor_registrations
       WHERE full_name ILIKE $1 OR company_remark ILIKE $1
       GROUP BY full_name, id_card, company_remark
       ORDER BY max(registered_at) DESC
       LIMIT 8`,
      [`%${q.replace(/[\\%_]/g, '\\$&')}%`]
    )
    return NextResponse.json({ history: result.rows.map((r) => ({ ...r, visits: Number(r.visits) })) })
  } catch (error) {
    console.error('[vendor-registrations/history/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat riwayat.' }, { status: 500 })
  }
}
