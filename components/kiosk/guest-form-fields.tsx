// components/kiosk/guest-form-fields.tsx
//
// Pieces shared by Pos Security (SecurityView) and the Lobby (LobbyView):
// extra people on one registration, the "scheduled guests" banner and the
// KTP (identity card) check status.
'use client'

import { useMemo } from 'react'
import { UserPlus, X } from 'lucide-react'
import { inputClass, labelClass, type Registration } from '@/components/kiosk/kiosk-shared'

export type IdType = 'ktp' | 'sim' | 'paspor'

export function detectIdType(raw: string): IdType {
  const upper = (raw || '').trim().toUpperCase()
  if (upper.startsWith('SIM')) return 'sim'
  if (upper.startsWith('PASPOR') || upper.startsWith('PASSPORT')) return 'paspor'
  return 'ktp'
}

export function extractIdNumber(raw: string): string {
  const clean = (raw || '').trim()
  return clean.replace(/^(SIM|PASPOR|PASSPORT)[:\s-]*/i, '')
}

export function formatIdCardValue(idType: IdType, idNumber: string): string {
  const clean = idNumber.trim()
  if (idType === 'sim') return `SIM: ${clean}`
  if (idType === 'paspor') return `Paspor: ${clean}`
  return clean.replace(/\D/g, '')
}

export function validateGuestId(idType: IdType, idNumber: string, label = 'Nomor identitas'): string | null {
  const clean = idNumber.trim()
  if (!clean) return `${label} wajib diisi.`
  if (idType === 'ktp') {
    const digits = clean.replace(/\D/g, '')
    if (digits.length !== 16) {
      return `${label} (NIK KTP) harus tepat 16 digit angka (saat ini ${digits.length} digit).`
    }
  } else if (idType === 'sim') {
    const digits = clean.replace(/\D/g, '')
    if (digits.length < 12 || digits.length > 16) {
      return `${label} (SIM) harus 12 - 16 digit angka.`
    }
  } else if (idType === 'paspor') {
    if (clean.length < 6 || clean.length > 15) {
      return `${label} (Paspor) harus 6 - 15 karakter.`
    }
  }
  return null
}

export type CompanionInput = { name: string; idNo: string; idType?: IdType }

export const MAX_COMPANIONS = 20

export const toCompanionInputs = (r?: Registration | null): CompanionInput[] =>
  (r?.companions ?? []).map((c) => ({
    name: c.name,
    idNo: extractIdNumber(c.id_no),
    idType: detectIdType(c.id_no),
  }))

export function CompanionsField({ value, onChange }: { value: CompanionInput[]; onChange: (next: CompanionInput[]) => void }) {
  const patch = (index: number, change: Partial<CompanionInput>) => onChange(value.map((c, i) => (i === index ? { ...c, ...change } : c)))
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={labelClass}>Orang Tambahan (rombongan, KTP masing-masing)</span>
        <button type="button" onClick={() => onChange([...value, { name: '', idNo: '' }])} disabled={value.length >= MAX_COMPANIONS} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50">
          <UserPlus className="size-3" />Tambah Orang
        </button>
      </div>
      {value.map((c, i) => (
        <div key={i} className="mt-2 flex gap-2">
          <input value={c.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Nama" aria-label={`Nama orang tambahan ${i + 1}`} className={inputClass} />
          <input value={c.idNo} onChange={(e) => patch(i, { idNo: e.target.value })} placeholder="Nomor KTP" aria-label={`Nomor KTP orang tambahan ${i + 1}`} className={inputClass} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Hapus orang tambahan ${i + 1}`} className="grid size-10 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

// [today, tomorrow] as YYYY-MM-DD in Jakarta time.
function jakartaDays(): [string, string] {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
  return [day(0), day(1)]
}

export function ScheduledGuestsBanner({ registrations }: { registrations: Registration[] }) {
  const scheduled = useMemo(() => {
    const [today, tomorrow] = jakartaDays()
    const open = registrations.filter((r) => r.stage !== 'closed' && r.visit_date)
    return { today: open.filter((r) => r.visit_date === today), tomorrow: open.filter((r) => r.visit_date === tomorrow) }
  }, [registrations])
  if (scheduled.today.length === 0 && scheduled.tomorrow.length === 0) return null

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      {([['Tamu terjadwal hari ini', scheduled.today], ['Tamu terjadwal besok (H-1)', scheduled.tomorrow]] as const).map(([title, list]) => (
        <div key={title} className="rounded-xl border border-[#f0d58a] bg-[#fff8e6] px-4 py-3">
          <p className="text-xs font-bold text-[#8a6100]">{title}: {list.length}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-foreground">
            {list.slice(0, 6).map((r) => <li key={r.id}>{r.full_name} <span className="text-muted-foreground">· {r.company_remark} · PIC {r.pic_jai}</span></li>)}
            {list.length > 6 && <li className="text-muted-foreground">+{list.length - 6} lainnya</li>}
          </ul>
        </div>
      ))}
    </div>
  )
}

export const formatVisitDate = (value: string) => value.split('-').reverse().join('/')

export function idStatusText(r: Registration): string {
  if (!r.id_verified_at) return 'Belum diverifikasi'
  if (r.id_returned_at) return 'Dikembalikan'
  return r.stage === 'closed' ? 'Belum dikembalikan' : 'Diverifikasi'
}

// Closed visit with a verified KTP that never went back: red flag.
export function IdStatusBadge({ r }: { r: Registration }) {
  if (!r.id_verified_at) return null
  if (r.id_returned_at) return <span className="mt-1 block text-[10px] text-muted-foreground">KTP sudah dikembalikan</span>
  if (r.stage === 'closed') return <span className="mt-1 block rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">KTP belum dikembalikan</span>
  return <span className="mt-1 block text-[10px] font-semibold text-[#1a5fa0]">KTP diverifikasi</span>
}
