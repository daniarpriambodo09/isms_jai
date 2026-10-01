// app/api/policy-acknowledgements/route.ts
//
// GET  ?nik=…        public: current policy version + whether this NIK acknowledged it
// GET  ?summary=1    ISM Admin: totals per department + the full list
// POST               public: { nik, fullName, department, section? } — record "sudah membaca & memahami"

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { isRateLimited } from '@/lib/rate-limit'
import { ackSummary, acknowledge, currentPolicyVersion, findAck, normalizeNik } from '@/lib/policy-ack'

export const dynamic = 'force-dynamic'

const clientIp = (request: NextRequest) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null

export async function GET(request: NextRequest) {
  try {
    const { version, label } = await currentPolicyVersion()
    if (request.nextUrl.searchParams.get('summary') === '1') {
      if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
      return NextResponse.json({ version, label, ...(await ackSummary(version)) })
    }
    const nik = normalizeNik(request.nextUrl.searchParams.get('nik'))
    const ack = nik ? await findAck(version, nik) : null
    // Only the date — never the name, so a NIK can't be used to look people up.
    return NextResponse.json({ version, label, ack: ack ? { acknowledged_at: ack.acknowledged_at } : null })
  } catch (error) {
    console.error('[policy-acknowledgements/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat data.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (isRateLimited(`policy-ack:${clientIp(request) ?? 'unknown'}`, 10, 60_000)) {
    return NextResponse.json({ message: 'Terlalu banyak percobaan. Coba lagi sebentar.' }, { status: 429 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const nik = normalizeNik(body.nik)
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 150) : ''
    const department = typeof body.department === 'string' ? body.department.trim().slice(0, 150) : ''
    const section = typeof body.section === 'string' && body.section.trim() ? body.section.trim().slice(0, 150) : null
    if (!nik) return NextResponse.json({ message: 'NIK wajib diisi.' }, { status: 400 })
    if (!fullName) return NextResponse.json({ message: 'Nama wajib diisi.' }, { status: 400 })
    if (!department) return NextResponse.json({ message: 'Departemen wajib dipilih.' }, { status: 400 })
    if (body.agree !== true) return NextResponse.json({ message: 'Centang pernyataan terlebih dahulu.' }, { status: 400 })

    const { version } = await currentPolicyVersion()
    if (version === 'v0') return NextResponse.json({ message: 'Belum ada kebijakan yang dipublikasikan.' }, { status: 409 })
    const { ack, created } = await acknowledge({ version, nik, fullName, department, section, ip: clientIp(request) })
    return NextResponse.json({ created, ack: { acknowledged_at: ack.acknowledged_at } }, { status: created ? 201 : 200 })
  } catch (error) {
    console.error('[policy-acknowledgements/POST]', error)
    return NextResponse.json({ message: 'Gagal menyimpan pernyataan.' }, { status: 500 })
  }
}
