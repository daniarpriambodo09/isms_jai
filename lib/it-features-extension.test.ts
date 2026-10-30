import { describe, it, expect } from 'vitest'

function formatMacAddress(input: string): string {
  const raw = input.replace(/[^a-fA-F0-9]/g, '').toUpperCase().slice(0, 12)
  const parts = raw.match(/.{1,2}/g)
  return parts ? parts.join(':') : raw
}

function buildWifiPayload(ssid: string, password?: string | null): string {
  const escapeWifi = (s: string) => s.replace(/([\\;,":])/g, '\\$1')
  const cleanSsid = escapeWifi(ssid || 'JAI-CORP-GUEST')
  if (password) {
    return `WIFI:S:${cleanSsid};T:WPA;P:${escapeWifi(password)};;`
  }
  return `WIFI:S:${cleanSsid};T:nopass;;`
}

function isEquipmentOverdue(
  req: { form_type: string; status: string; date_out_plan?: string | null },
  referenceDateStr: string
): boolean {
  if (req.form_type !== 'out') return false
  if (req.status === 'returned' || req.status === 'rejected') return false
  if (!req.date_out_plan) return false
  return req.date_out_plan < referenceDateStr
}

function getOverdueDays(dateOutPlan: string, referenceDate: Date): number {
  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)
  const plan = new Date(dateOutPlan)
  plan.setHours(0, 0, 0, 0)
  const diffTime = today.getTime() - plan.getTime()
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
}

describe('Fitur 1: Wi-Fi QR Code Payload', () => {
  it('formats standard WPA Wi-Fi with SSID and password', () => {
    const payload = buildWifiPayload('JAI-CORP-GUEST', 'Yazaki@2026')
    expect(payload).toBe('WIFI:S:JAI-CORP-GUEST;T:WPA;P:Yazaki@2026;;')
  })

  it('formats open Wi-Fi without password', () => {
    const payload = buildWifiPayload('JAI-GUEST', '')
    expect(payload).toBe('WIFI:S:JAI-GUEST;T:nopass;;')
  })

  it('escapes special characters in SSID or password', () => {
    const payload = buildWifiPayload('JAI;Wi-Fi', 'pass:word;123')
    expect(payload).toBe('WIFI:S:JAI\\;Wi-Fi;T:WPA;P:pass\\:word\\;123;;')
  })
})

describe('Fitur 2: MAC Address Auto-formatting', () => {
  it('formats continuous hex string into pairs with colons', () => {
    expect(formatMacAddress('001122aabbcc')).toBe('00:11:22:AA:BB:CC')
  })

  it('normalizes dash-separated or mixed input', () => {
    expect(formatMacAddress('00-11-22-aa-bb-cc')).toBe('00:11:22:AA:BB:CC')
  })

  it('strips invalid non-hex characters and limits to 12 hex chars (6 bytes)', () => {
    expect(formatMacAddress('XYZ001122AABBCC9999')).toBe('00:11:22:AA:BB:CC')
  })

  it('handles partial input gracefully while user is typing', () => {
    expect(formatMacAddress('0')).toBe('0')
    expect(formatMacAddress('00')).toBe('00')
    expect(formatMacAddress('001')).toBe('00:1')
    expect(formatMacAddress('001122')).toBe('00:11:22')
  })
})

describe('Fitur 4: Overdue Detection for Form 002 (Bawa Keluar)', () => {
  const today = '2026-10-30'
  const todayDate = new Date('2026-10-30T10:00:00Z')

  it('marks equipment overdue if plan date has passed and not returned', () => {
    const req = {
      form_type: 'out',
      status: 'approved',
      date_out_plan: '2026-10-25',
    }
    expect(isEquipmentOverdue(req, today)).toBe(true)
    expect(getOverdueDays(req.date_out_plan, todayDate)).toBe(5)
  })

  it('does NOT mark equipment overdue if date_out_plan is in the future', () => {
    const req = {
      form_type: 'out',
      status: 'approved',
      date_out_plan: '2026-11-05',
    }
    expect(isEquipmentOverdue(req, today)).toBe(false)
  })

  it('does NOT mark equipment overdue if status is returned or rejected', () => {
    const req1 = {
      form_type: 'out',
      status: 'returned',
      date_out_plan: '2026-10-20',
    }
    const req2 = {
      form_type: 'out',
      status: 'rejected',
      date_out_plan: '2026-10-20',
    }
    expect(isEquipmentOverdue(req1, today)).toBe(false)
    expect(isEquipmentOverdue(req2, today)).toBe(false)
  })

  it('does NOT mark Form 001 (in / bawa masuk) as Form 002 overdue', () => {
    const req = {
      form_type: 'in',
      status: 'approved',
      date_out_plan: '2026-10-20',
    }
    expect(isEquipmentOverdue(req, today)).toBe(false)
  })
})
