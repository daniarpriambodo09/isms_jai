import { NextRequest, NextResponse } from 'next/server'
import { getKioskAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'

// Past guests (name / company) for autofill when registering a returning visitor.
export async function GET(request: NextRequest) {
  if (!getKioskAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  try {
    const companiesResult = await query<{ company_remark: string }>(
      `SELECT DISTINCT company_remark
       FROM vendor_registrations
       WHERE company_remark IS NOT NULL AND company_remark <> '' AND company_remark <> '-'
       ORDER BY company_remark ASC
       LIMIT 100`
    )
    const companies = companiesResult.rows.map((r) => r.company_remark)

    if (q.length < 2) {
      return NextResponse.json({ history: [], companies })
    }

    const result = await query<{ full_name: string; id_card: string; company_remark: string; pic_jai: string; visits: string }>(
      `SELECT full_name, id_card, company_remark, (array_agg(pic_jai ORDER BY registered_at DESC))[1] AS pic_jai, count(*)::text AS visits
       FROM vendor_registrations
       WHERE full_name ILIKE $1 OR company_remark ILIKE $1
       GROUP BY full_name, id_card, company_remark
       ORDER BY max(registered_at) DESC
       LIMIT 8`,
      [`%${q.replace(/[\\%_]/g, '\\$&')}%`]
    )
    return NextResponse.json({
      history: result.rows.map((r) => ({ ...r, visits: Number(r.visits) })),
      companies,
    })
  } catch (error) {
    console.error('[vendor-registrations/history/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat riwayat.' }, { status: 500 })
  }
}
