// lib/kiosk-flow.integration.test.ts
//
// End-to-end integration test for Admin Lobby and Pos Security kiosk interconnectivity.
// Simulates realistic visitor registration flows:
// 1. Security registration -> approval -> Lobby card swap -> Security block while in work area ->
//    Lobby return -> Security final checkout.
// 2. Direct Lobby registration & return.
// 3. Force Close (Tutup Manual) for lost cards.
// 4. Card collision detection (preventing duplicate active cards).
//
// Runs with: npm run test:db (ISMS_DB_TESTS=1)

import fs from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

const enabled = process.env.ISMS_DB_TESTS === '1'
if (enabled && fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const TAG = `ZZ-VISITOR-${process.pid}`
const SEC_CARD = `SEC-V-${process.pid}`
const LOBBY_CARD = 'L1025' // Valid vendor card range L1001 - L1208
const LOBBY_DIRECT_CARD = 'L2015' // Valid visitor card range L2001 - L2030

let db: typeof import('./db')
let securityCookie = ''
let lobbyCookie = ''

const req = (url: string, method: string, body?: Record<string, unknown>, roleCookie?: string) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      ...(roleCookie ? { cookie: roleCookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

describe.skipIf(!enabled)('Admin Lobby & Pos Security Interconnectivity Flow', () => {
  beforeAll(async () => {
    db = await import('./db')
    const jwt = (await import('jsonwebtoken')).default
    const secret = process.env.JWT_SECRET as string
    const cookieName = process.env.AUTH_COOKIE_NAME ?? 'isms_admin_session'

    securityCookie = `${cookieName}=${jwt.sign({ sub: 101, username: 'petugas_security', role: 'security' }, secret, { expiresIn: '10m' })}`
    lobbyCookie = `${cookieName}=${jwt.sign({ sub: 102, username: 'admin_lobby', role: 'lobby' }, secret, { expiresIn: '10m' })}`

    // Clean up any stale data with our test tag
    await db.query('DELETE FROM vendor_registrations WHERE full_name LIKE $1', [`${TAG}%`])
  })

  afterAll(async () => {
    if (db) {
      await db.query('DELETE FROM vendor_registrations WHERE full_name LIKE $1', [`${TAG}%`])
      await db.pool.end()
    }
  })

  it('Scenario 1: Complete lifecycle of a visitor registering at Pos Security and entering via Admin Lobby', async () => {
    const regRoute = await import('@/app/api/vendor-registrations/route')
    const idRoute = await import('@/app/api/vendor-registrations/[id]/route')
    const scanRoute = await import('@/app/api/vendor-registrations/scan/route')

    // 1. Visitor arrives at Pos Security -> Security registers the visitor
    const visitorName = `${TAG} Budi Santoso`
    const registerPayload = {
      fullName: visitorName,
      idCard: '3201234567890001',
      picJai: 'Pak Eko (IT Dept)',
      purpose: 'Maintenance Server Room',
      companyRemark: 'PT Solusi Teknologi',
      securityCardType: 'visitor',
    }

    const regResponse = await regRoute.POST(req('/api/vendor-registrations', 'POST', registerPayload, securityCookie))
    expect(regResponse.status).toBe(201)
    const regData = await regResponse.json()
    const registrationId = regData.registration.id
    expect(registrationId).toBeDefined()
    expect(regData.registration.full_name).toBe(visitorName)
    expect(regData.registration.stage).toBe('pending_approval')
    expect(regData.registration.entry_path).toBe('security')
    expect(regData.registration.registered_station).toBe('security')

    // 2. Both kiosks query: Pos Security sees visitor in approval queue, Lobby sees visitor waiting
    const securityQueueRes = await regRoute.GET(req('/api/vendor-registrations?stage=pending_approval', 'GET', undefined, securityCookie))
    expect(securityQueueRes.status).toBe(200)
    const securityQueue = await securityQueueRes.json()
    const foundInSec = securityQueue.registrations.find((r: { id: number }) => r.id === registrationId)
    expect(foundInSec).toBeDefined()
    expect(foundInSec.full_name).toBe(visitorName)

    const lobbyQueueRes = await regRoute.GET(req('/api/vendor-registrations?context=waiting_security', 'GET', undefined, lobbyCookie))
    expect(lobbyQueueRes.status).toBe(200)
    const lobbyQueue = await lobbyQueueRes.json()
    const foundInLobby = lobbyQueue.registrations.find((r: { id: number }) => r.id === registrationId)
    expect(foundInLobby).toBeDefined()

    // 3. Security approves the visitor and hands out Security Card SEC_CARD
    const paramsPromise = { params: Promise.resolve({ id: String(registrationId) }) }
    const approveRes = await idRoute.PUT(req(`/api/vendor-registrations/${registrationId}`, 'PUT', {
      action: 'approve',
      barcode: SEC_CARD,
    }, securityCookie), paramsPromise)
    expect(approveRes.status).toBe(200)
    const approveData = await approveRes.json()
    expect(approveData.registration.stage).toBe('active')
    expect(approveData.registration.security_card_barcode).toBe(SEC_CARD)
    expect(approveData.registration.current_card_type).toBe('visitor')
    expect(approveData.registration.at_work_area).toBe(false)
    expect(approveData.registration.entry_at).toBeTruthy()

    // 4. Visitor walks from Pos Security to Admin Lobby
    // Admin Lobby scans the Security Card to call the visitor's record
    const lobbyScanCallRes = await scanRoute.POST(req('/api/vendor-registrations/scan', 'POST', {
      barcode: SEC_CARD,
      mode: 'call',
    }, lobbyCookie))
    expect(lobbyScanCallRes.status).toBe(200)
    const scanCallData = await lobbyScanCallRes.json()
    expect(scanCallData.result).toBe('swap')
    expect(scanCallData.registration.id).toBe(registrationId)
    expect(scanCallData.registration.full_name).toBe(visitorName)

    // 5. Lobby swaps card: Test card range validation
    // Trying an invalid vendor card number outside L1001-L1208 range must fail
    const invalidSwapRes = await idRoute.PUT(req(`/api/vendor-registrations/${registrationId}`, 'PUT', {
      action: 'swapToWorkArea',
      cardType: 'vendor',
      barcode: '9999',
    }, lobbyCookie), paramsPromise)
    expect(invalidSwapRes.status).toBe(400)
    const invalidSwapData = await invalidSwapRes.json()
    expect(invalidSwapData.message).toContain('bukan nomor kartu Vendor Lobby')

    // Trying valid card LOBBY_CARD (L1025)
    const validSwapRes = await idRoute.PUT(req(`/api/vendor-registrations/${registrationId}`, 'PUT', {
      action: 'swapToWorkArea',
      cardType: 'vendor',
      barcode: LOBBY_CARD,
    }, lobbyCookie), paramsPromise)
    expect(validSwapRes.status).toBe(200)
    const validSwapData = await validSwapRes.json()
    expect(validSwapData.registration.at_work_area).toBe(true)
    expect(validSwapData.registration.current_card_type).toBe('vendor')
    expect(validSwapData.registration.vendor_card_barcode).toBe(LOBBY_CARD)

    // 6. Security guardrail: Pos Security cannot close the visit while visitor is in work area!
    const securityCloseBlockedRes = await scanRoute.POST(req('/api/vendor-registrations/scan', 'POST', {
      barcode: SEC_CARD,
    }, securityCookie))
    expect(securityCloseBlockedRes.status).toBe(409)
    const secBlockedData = await securityCloseBlockedRes.json()
    expect(secBlockedData.result).toBe('blocked')
    expect(secBlockedData.message).toContain('masih memegang kartu Lobby — tukar kembali di Lobby dulu')

    // 7. Lobby guardrail while at work area: Calling record again shows already swapped
    const lobbyCallAgainRes = await scanRoute.POST(req('/api/vendor-registrations/scan', 'POST', {
      barcode: SEC_CARD,
      mode: 'call',
    }, lobbyCookie))
    expect(lobbyCallAgainRes.status).toBe(200)
    const callAgainData = await lobbyCallAgainRes.json()
    expect(callAgainData.result).toBe('blocked')
    expect(callAgainData.message).toContain('sudah menukar kartu Security')

    // 8. Visitor finishes work and returns the Lobby Vendor Card at Admin Lobby
    const lobbyScanReturnRes = await scanRoute.POST(req('/api/vendor-registrations/scan', 'POST', {
      barcode: LOBBY_CARD,
    }, lobbyCookie))
    expect(lobbyScanReturnRes.status).toBe(200)
    const lobbyReturnData = await lobbyScanReturnRes.json()
    expect(lobbyReturnData.result).toBe('returned')
    expect(lobbyReturnData.registration.at_work_area).toBe(false)
    expect(lobbyReturnData.registration.current_card_type).toBe('visitor')
    expect(lobbyReturnData.message).toContain('Tamu kembali memegang kartu Visitor Security')

    // 9. Lobby guardrail after return: Trying to return the Security card at Lobby's return dialog
    // is blocked because Security cards must be returned at Pos Security!
    const lobbyReturnSecCardBlockedRes = await scanRoute.POST(req('/api/vendor-registrations/scan', 'POST', {
      barcode: SEC_CARD,
      mode: 'return',
    }, lobbyCookie))
    expect(lobbyReturnSecCardBlockedRes.status).toBe(200)
    const lobbyBlockedData = await lobbyReturnSecCardBlockedRes.json()
    expect(lobbyBlockedData.result).toBe('blocked')
    expect(lobbyBlockedData.message).toContain('dikembalikan di Pos Security, bukan di Lobby')

    // 10. Visitor goes to Pos Security for final checkout
    const secFinalCheckoutRes = await scanRoute.POST(req('/api/vendor-registrations/scan', 'POST', {
      barcode: SEC_CARD,
    }, securityCookie))
    expect(secFinalCheckoutRes.status).toBe(200)
    const secCheckoutData = await secFinalCheckoutRes.json()
    expect(secCheckoutData.result).toBe('out')
    expect(secCheckoutData.registration.stage).toBe('closed')
    expect(secCheckoutData.registration.exit_at).toBeTruthy()
    expect(secCheckoutData.message).toContain('Scan out —')
  })

  it('Scenario 2: Direct registration at Admin Lobby (skipping Security approval flow)', async () => {
    const regRoute = await import('@/app/api/vendor-registrations/route')
    const scanRoute = await import('@/app/api/vendor-registrations/scan/route')

    // 1. Direct registration at Lobby with a visitor card
    const directVisitorName = `${TAG} Direct Visitor`
    const directRes = await regRoute.POST(req('/api/vendor-registrations', 'POST', {
      fullName: directVisitorName,
      idCard: '3209876543210002',
      picJai: 'Bu Rina (HR)',
      purpose: 'Interview',
      companyRemark: 'Candidate',
      cardType: 'visitor',
      barcode: LOBBY_DIRECT_CARD,
    }, lobbyCookie))

    expect(directRes.status).toBe(201)
    const directData = await directRes.json()
    expect(directData.registration.stage).toBe('active')
    expect(directData.registration.entry_path).toBe('lobby_affiliate')
    expect(directData.registration.current_card_type).toBe('visitor')
    expect(directData.registration.visitor_card_barcode).toBe(LOBBY_DIRECT_CARD)

    // 2. Direct card return at Admin Lobby closes the registration immediately
    const returnDirectRes = await scanRoute.POST(req('/api/vendor-registrations/scan', 'POST', {
      barcode: LOBBY_DIRECT_CARD,
    }, lobbyCookie))
    expect(returnDirectRes.status).toBe(200)
    const returnData = await returnDirectRes.json()
    expect(returnData.result).toBe('out')
    expect(returnData.registration.stage).toBe('closed')
    expect(returnData.registration.exit_at).toBeTruthy()
  })

  it('Scenario 3: Force Close (Tutup Manual) when card is lost', async () => {
    const regRoute = await import('@/app/api/vendor-registrations/route')
    const idRoute = await import('@/app/api/vendor-registrations/[id]/route')

    const lostCardName = `${TAG} Lost Card Guest`
    const regRes = await regRoute.POST(req('/api/vendor-registrations', 'POST', {
      fullName: lostCardName,
      idCard: '3201112223334445',
      picJai: 'Pak Joko',
      purpose: 'Survey Lapangan',
      companyRemark: 'PT Survey Nusantara',
      securityCardType: 'visitor',
    }, securityCookie))
    const id = (await regRes.json()).registration.id
    const paramsPromise = { params: Promise.resolve({ id: String(id) }) }

    // Approve with card
    const LOST_SEC_CARD = `SEC-LOST-${process.pid}`
    await idRoute.PUT(req(`/api/vendor-registrations/${id}`, 'PUT', {
      action: 'approve',
      barcode: LOST_SEC_CARD,
    }, securityCookie), paramsPromise)

    // Perform Force Close with reason
    const forceCloseRes = await idRoute.PUT(req(`/api/vendor-registrations/${id}`, 'PUT', {
      action: 'forceClose',
      reason: 'Kartu tertinggal / hilang oleh tamu',
    }, securityCookie), paramsPromise)

    expect(forceCloseRes.status).toBe(200)
    const forceData = await forceCloseRes.json()
    expect(forceData.registration.stage).toBe('closed')
    expect(forceData.registration.closed_note).toContain('Ditutup manual oleh petugas_security: Kartu tertinggal / hilang oleh tamu')
  })

  it('Scenario 4: Card collision prevention between multiple active guests', async () => {
    const regRoute = await import('@/app/api/vendor-registrations/route')
    const idRoute = await import('@/app/api/vendor-registrations/[id]/route')

    const GUEST_A = `${TAG} Guest A`
    const GUEST_B = `${TAG} Guest B`
    const SHARED_CARD = `SEC-SHARED-${process.pid}`

    // Register Guest A & Guest B
    const resA = await regRoute.POST(req('/api/vendor-registrations', 'POST', {
      fullName: GUEST_A,
      idCard: '1111111111',
      picJai: 'PIC A',
      purpose: 'Meeting',
      companyRemark: 'Company A',
      securityCardType: 'visitor',
    }, securityCookie))
    const idA = (await resA.json()).registration.id

    const resB = await regRoute.POST(req('/api/vendor-registrations', 'POST', {
      fullName: GUEST_B,
      idCard: '2222222222',
      picJai: 'PIC B',
      purpose: 'Meeting',
      companyRemark: 'Company B',
      securityCardType: 'visitor',
    }, securityCookie))
    const idB = (await resB.json()).registration.id

    // Approve Guest A with SHARED_CARD
    const approveA = await idRoute.PUT(req(`/api/vendor-registrations/${idA}`, 'PUT', {
      action: 'approve',
      barcode: SHARED_CARD,
    }, securityCookie), { params: Promise.resolve({ id: String(idA) }) })
    expect(approveA.status).toBe(200)

    // Approving Guest B with the SAME SHARED_CARD must fail with 409 Conflict
    const approveB = await idRoute.PUT(req(`/api/vendor-registrations/${idB}`, 'PUT', {
      action: 'approve',
      barcode: SHARED_CARD,
    }, securityCookie), { params: Promise.resolve({ id: String(idB) }) })
    expect(approveB.status).toBe(409)
    const errB = await approveB.json()
    expect(errB.message).toContain('sedang digunakan oleh tamu lain')
  })

  it('Scenario 5: Edit details, Barcode Search lookup, and Activity Audit Log', async () => {
    const regRoute = await import('@/app/api/vendor-registrations/route')
    const idRoute = await import('@/app/api/vendor-registrations/[id]/route')
    const searchRoute = await import('@/app/api/vendor-registrations/search/route')

    const EDIT_GUEST = `${TAG} Guest To Edit`
    const EDIT_CARD = `SEC-EDIT-${process.pid}`

    // 1. Register guest
    const regRes = await regRoute.POST(req('/api/vendor-registrations', 'POST', {
      fullName: EDIT_GUEST,
      idCard: '1234567890',
      picJai: 'PIC Awal',
      purpose: 'Meeting Awal',
      companyRemark: 'Perusahaan Awal',
      securityCardType: 'visitor',
    }, securityCookie))
    const id = (await regRes.json()).registration.id
    const paramsPromise = { params: Promise.resolve({ id: String(id) }) }

    // 2. Edit details before approval
    const editRes = await idRoute.PUT(req(`/api/vendor-registrations/${id}`, 'PUT', {
      action: 'editDetails',
      fullName: `${EDIT_GUEST} (Updated)`,
      idCard: '1234567890-REV',
      picJai: 'PIC Revisi',
      purpose: 'Meeting Revisi',
      companyRemark: 'Perusahaan Revisi',
      securityCardType: 'vendor', // Security card type can be adjusted while pending approval
    }, securityCookie), paramsPromise)

    expect(editRes.status).toBe(200)
    const editData = await editRes.json()
    expect(editData.registration.full_name).toBe(`${EDIT_GUEST} (Updated)`)
    expect(editData.registration.pic_jai).toBe('PIC Revisi')
    expect(editData.registration.security_card_type).toBe('vendor')

    // 3. Approve with card
    await idRoute.PUT(req(`/api/vendor-registrations/${id}`, 'PUT', {
      action: 'approve',
      barcode: EDIT_CARD,
    }, securityCookie), paramsPromise)

    // 4. Barcode Search API test: lookup active guest by barcode
    const searchRes = await searchRoute.GET(req(`/api/vendor-registrations/search?barcode=${EDIT_CARD}`, 'GET', undefined, lobbyCookie))
    expect(searchRes.status).toBe(200)
    const searchData = await searchRes.json()
    expect(searchData.registration.id).toBe(id)
    expect(searchData.registration.full_name).toBe(`${EDIT_GUEST} (Updated)`)

    // 5. Activity Audit Log check
    const logs = await db.query<{ action: string; description: string }>(
      'SELECT action, description FROM activity_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY id ASC',
      ['vendor_registration', id]
    )
    expect(logs.rows.length).toBeGreaterThanOrEqual(2)
    expect(logs.rows.some((l) => l.action === 'create')).toBe(true)
    expect(logs.rows.some((l) => l.action === 'update' && l.description.includes('Mengubah data pendaftaran'))).toBe(true)
  })
})

