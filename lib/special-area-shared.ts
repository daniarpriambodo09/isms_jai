// lib/special-area-shared.ts
// Client-safe constants for "Pengajuan Ijin Masuk Area Special Security"
// (form ISMS-F-006-001).

// Special (red) areas from the Diagram Security Area PT. JAI (ISMS-B-003).
// This is only the starting list: the ISM Admin edits the real one from
// "Izin Area Special" (stored in app_settings, see lib/special-area.ts).
export const SPECIAL_AREAS = [
  'Server Room',
  'Finance Room',
  'Accounting Room',
  'HR/IR Room',
  'Office EXIM',
  'Office MTC Server',
  'Office QSA - Administration',
  'Document Room EXIM',
  'Document Room FA',
  'Gudang IT & Document Room IR',
  'Training Office',
] as const

export const AREA_LIST_MAX = 40
export const AREA_NAME_MAX = 80

/**
 * Cleans a list of area names sent by the admin editor: trimmed, inner
 * whitespace collapsed, empty rows dropped. Returns an error message instead
 * when the list can't be saved (empty, too long, a name too long, duplicates).
 */
export function parseAreaList(raw: unknown): { areas: string[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Daftar area tidak valid.' }
  const areas: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') return { error: 'Daftar area tidak valid.' }
    const name = item.replace(/\s+/g, ' ').trim()
    if (!name) continue
    if (name.length > AREA_NAME_MAX) return { error: `Nama area maksimal ${AREA_NAME_MAX} karakter: "${name.slice(0, 30)}…"` }
    const key = name.toLowerCase()
    if (seen.has(key)) return { error: `Nama area "${name}" tertulis dua kali.` }
    seen.add(key)
    areas.push(name)
  }
  if (areas.length === 0) return { error: 'Daftar area tidak boleh kosong — isi minimal satu area.' }
  if (areas.length > AREA_LIST_MAX) return { error: `Maksimal ${AREA_LIST_MAX} area.` }
  return { areas }
}

export type SpecialAreaStatus = 'pending' | 'approved' | 'rejected'

export type SpecialAreaRequest = {
  id: number
  requester_name: string
  org_company: string
  department: string | null
  from_at: string
  to_at: string
  area: string
  purpose: string
  id_card_no: string | null
  status: SpecialAreaStatus
  submitted_at: string
  submitted_by: string | null
  approver_name: string | null
  approver_title: string | null
  notified_at: string | null
  email_error: string | null
  decided_at: string | null
  decision_note: string | null
  verification_code: string | null
  /** PIC Pendamping — filled in by Lobby / Pos Security, at submission or later. */
  escort_name: string | null
  escort_dept: string | null
  escort_set_by: string | null
  escort_set_at: string | null
}

export const ESCORT_NAME_MAX = 150
export const ESCORT_LIST_MAX = 300

export type Escort = { name: string; dept: string | null }

const cleanText = (v: unknown, max = ESCORT_NAME_MAX) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** The PIC Pendamping picked for one request, trimmed (name null = cleared). */
export function parseEscort(body: { escortName?: unknown; escortDept?: unknown }) {
  const name = cleanText(body.escortName)
  const dept = cleanText(body.escortDept)
  return { name: name || null, dept: name ? dept || null : null }
}

/**
 * The list of employees Lobby / Security pick the PIC Pendamping from (set by
 * the ISM Admin): empty rows dropped, duplicates (same name + dept) refused.
 */
export function parseEscortList(raw: unknown): { escorts: Escort[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: 'Daftar PIC pendamping tidak valid.' }
  const escorts: Escort[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const row = (item ?? {}) as { name?: unknown; dept?: unknown }
    const name = cleanText(row.name)
    const dept = cleanText(row.dept)
    if (!name) continue
    const key = `${name}|${dept}`.toLowerCase()
    if (seen.has(key)) return { error: `"${name}${dept ? ` (${dept})` : ''}" tertulis dua kali.` }
    seen.add(key)
    escorts.push({ name, dept: dept || null })
  }
  if (escorts.length > ESCORT_LIST_MAX) return { error: `Maksimal ${ESCORT_LIST_MAX} nama.` }
  return { escorts }
}
