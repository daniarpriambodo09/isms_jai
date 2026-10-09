// components/escort-picker.tsx
//
// PIC Pendamping — the employee who accompanies a guest. Lobby / Pos Security
// pick one for an Izin Area Special or an Izin Foto/Video request: from the
// list the ISM Admin keeps (Izin Area Special → Daftar PIC Pendamping), or a
// name typed in ("Lainnya…"). One picker for both, so they behave the same.
'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Pencil, UserCheck, UserPlus } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import type { Escort } from '@/lib/special-area-shared'

const OTHER = '__other__'
const CLEAR = '__clear__'
const escortKey = (e: Escort) => `${e.name}|${e.dept ?? ''}`

export type EscortChoice = { escortName: string | null; escortDept: string | null }

/** The list to pick from (empty for a visitor without a session — the API is for logged-in staff). */
export function useEscortList(enabled = true): Escort[] {
  const [escorts, setEscorts] = useState<Escort[]>([])
  useEffect(() => {
    if (!enabled) return
    fetch(`${API_BASE_PATH}/api/special-area-requests/escorts`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { escorts?: Escort[] } | null) => setEscorts(data?.escorts ?? []))
      .catch(() => {})
  }, [enabled])
  return escorts
}

// The options of the list, grouped by department like the paper rosters.
export function EscortOptions({ escorts }: { escorts: Escort[] }) {
  const groups = new Map<string, Escort[]>()
  for (const e of escorts) groups.set(e.dept ?? 'Tanpa departemen', [...(groups.get(e.dept ?? 'Tanpa departemen') ?? []), e])
  return (
    <>
      {[...groups.entries()].map(([group, list]) => (
        <optgroup key={group} label={group}>
          {list.map((e) => <option key={escortKey(e)} value={escortKey(e)}>{e.name}</option>)}
        </optgroup>
      ))}
    </>
  )
}

/** What a <select> value built with EscortOptions stands for (null = nothing / "Lainnya" without a name). */
export function escortFromChoice(choice: string, escorts: Escort[], typed: { name: string; dept: string }): Escort | null {
  if (choice === OTHER) return typed.name.trim() ? { name: typed.name.trim(), dept: typed.dept.trim() || null } : null
  return escorts.find((e) => escortKey(e) === choice) ?? null
}
export const ESCORT_OTHER = OTHER

/**
 * One request's PIC Pendamping in a list: shows who it is (and who picked
 * them), or a "Pilih PIC" button — amber when `urgent` (the permit is
 * approved and still in force, so the guest needs one before going in).
 * `onSave` stores the choice and resolves to false when it could not.
 */
export function EscortPicker({ current, setBy, escorts, urgent = false, closed = false, onSave }: {
  current: Escort | null
  setBy?: string | null
  escorts: Escort[]
  urgent?: boolean
  /** Nothing to assign any more (a rejected request): shows "—". */
  closed?: boolean
  onSave: (choice: EscortChoice) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [choice, setChoice] = useState('')
  const [name, setName] = useState('')
  const [dept, setDept] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = () => {
    const listed = current && escorts.some((e) => escortKey(e) === escortKey(current))
    setChoice(current ? (listed ? escortKey(current) : OTHER) : '')
    setName(current && !listed ? current.name : '')
    setDept(current && !listed ? current.dept ?? '' : '')
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    let payload: EscortChoice
    if (choice === CLEAR) payload = { escortName: null, escortDept: null }
    else {
      const picked = escortFromChoice(choice, escorts, { name, dept })
      if (!picked) { setError(choice === OTHER ? 'Tulis nama PIC pendamping JAI.' : 'Pilih PIC pendamping JAI.'); return }
      payload = { escortName: picked.name, escortDept: picked.dept }
    }
    setSaving(true)
    const saved = await onSave(payload).catch(() => false)
    setSaving(false)
    if (!saved) { setError('Gagal menyimpan.'); return }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex w-56 flex-col gap-1.5">
        <select value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus aria-label="Pilih PIC pendamping JAI" className="h-8 w-full rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-ring">
          <option value="">Pilih PIC pendamping JAI…</option>
          <EscortOptions escorts={escorts} />
          <option value={OTHER}>Lainnya (ketik nama)…</option>
          {current && <option value={CLEAR}>— Kosongkan</option>}
        </select>
        {choice === OTHER && (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama PIC pendamping JAI" maxLength={150} className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-ring" />
            <input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="Dept./Seksi (opsional)" maxLength={150} className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none focus:border-ring" />
          </>
        )}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
        <div className="flex gap-1">
          <button type="button" onClick={save} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-60">{saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Simpan</button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary">Batal</button>
        </div>
      </div>
    )
  }

  if (current) {
    return (
      <button type="button" onClick={start} className="group max-w-[200px] text-left" title="Ganti PIC pendamping JAI">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground"><UserCheck className="size-3.5 flex-none text-emerald-600" />{current.name}<Pencil className="size-3 text-muted-foreground opacity-0 transition group-hover:opacity-100" /></span>
        {current.dept && <span className="block pl-5 text-xs text-muted-foreground">{current.dept}</span>}
        {setBy && <span className="block pl-5 text-[10.5px] text-muted-foreground/80">dipilih {setBy}</span>}
      </button>
    )
  }
  if (closed) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <button type="button" onClick={start} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold transition ${urgent ? 'border-amber-500/50 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'border-dashed border-border text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
      <UserPlus className="size-3.5" /> Pilih PIC
    </button>
  )
}
