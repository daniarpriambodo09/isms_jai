// components/kiosk/ScanCardBox.tsx
'use client'

// "Scan Kartu" at the top of Admin Lobby and Pos Security: scan a card and the
// right thing happens for the guest it belongs to — no looking the name up in
// the list (see app/api/vendor-registrations/scan). The field keeps the
// cursor, so cards can be scanned one after another.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Loader2, ScanLine, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { SECURITY_CARD_LABEL, formatTimeParts, inputClass, type Registration } from '@/components/kiosk/kiosk-shared'

type ScanResult = 'out' | 'returned' | 'swap' | 'in' | 'choose' | 'unknown' | 'blocked'
type Outcome = { tone: 'in' | 'out' | 'warn'; message: string; at?: string | null; barcode: string; candidates?: Registration[]; pickFor?: 'approve' | 'scan'; offerRegister?: boolean }

export function ScanCardBox({
  station,
  onChanged,
  onSwap,
  registerOptions,
  focusKey = 0,
}: {
  station: 'lobby' | 'security'
  /** A guest's state changed — reload the list. */
  onChanged: () => void
  /** Lobby: a guest arrived with a Security card — open them to scan the Lobby card. */
  onSwap?: (registration: Registration) => void
  /** Lobby: buttons offered for a card nobody holds ("Daftarkan Visitor" …). */
  registerOptions?: { label: string; onPick: (barcode: string) => void }[]
  /** Changes when the cursor should come back to the scan field (e.g. after a card swap in the detail panel). */
  focusKey?: number
}) {
  const [barcode, setBarcode] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const refocus = () => window.setTimeout(() => inputRef.current?.focus(), 0)
  useEffect(() => { inputRef.current?.focus() }, [focusKey])

  const scan = async (code: string, id?: number) => {
    setBusy(true)
    // After a 'swap' the cursor belongs to the detail panel (next scan: the Lobby card).
    let keepFocus = true
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ barcode: code, station, ...(id ? { id } : {}) }),
      })
      const data = await res.json().catch(() => null) as { result?: ScanResult; message?: string; registration?: Registration; candidates?: Registration[] } | null
      const message = data?.message ?? 'Gagal memproses scan kartu.'
      switch (data?.result) {
        case 'out':
          setOutcome({ tone: 'out', message, at: data.registration?.exit_at, barcode: code }); onChanged(); break
        case 'returned':
          setOutcome({ tone: 'out', message, at: new Date().toISOString(), barcode: code }); onChanged(); break
        case 'swap':
          setOutcome({ tone: 'in', message, barcode: code }); if (data.registration && onSwap) { onSwap(data.registration); keepFocus = false } break
        case 'in':
          setOutcome({ tone: 'in', message, barcode: code, candidates: data.candidates ?? [], pickFor: 'approve' }); break
        case 'choose':
          setOutcome({ tone: 'warn', message, barcode: code, candidates: data.candidates ?? [], pickFor: 'scan' }); break
        case 'unknown':
          setOutcome({ tone: 'warn', message, barcode: code, offerRegister: true }); break
        default:
          setOutcome({ tone: 'warn', message, barcode: code })
      }
    } catch {
      setOutcome({ tone: 'warn', message: 'Tidak dapat menghubungi server.', barcode: code })
    } finally {
      setBusy(false)
      setBarcode('')
      if (keepFocus) refocus()
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const code = barcode.trim()
    if (code && !busy) scan(code)
  }

  // Scan in at Pos Security: hand the scanned card to the chosen guest.
  const approve = async (guest: Registration, code: string) => {
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${guest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'approve', barcode: code }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setOutcome({ tone: 'warn', message: data?.message ?? 'Gagal memproses.', barcode: code }); return }
      setOutcome({ tone: 'in', message: `Scan in — ${guest.full_name} masuk dengan kartu ${SECURITY_CARD_LABEL[guest.security_card_type]}.`, at: data?.registration?.entry_at, barcode: code })
      onChanged()
    } catch {
      setOutcome({ tone: 'warn', message: 'Tidak dapat menghubungi server.', barcode: code })
    } finally {
      setBusy(false)
      refocus()
    }
  }

  const tone = outcome?.tone === 'in'
    ? 'border-emerald-300/70 bg-emerald-50 text-emerald-900'
    : outcome?.tone === 'out'
      ? 'border-sky-300/70 bg-sky-50 text-sky-900'
      : 'border-amber-300/70 bg-amber-50 text-amber-900'
  const at = formatTimeParts(outcome?.at ?? null)

  return (
    <section aria-label="Scan kartu" className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="portal-eyebrow">Scan Kartu — Masuk / Keluar</p>
        <p className="text-[11px] text-muted-foreground">
          {station === 'security'
            ? 'Kartu yang sedang dipakai → tamu keluar. Kartu baru → pilih tamu yang menunggu.'
            : 'Kartu Lobby yang sedang dipakai → dikembalikan. Kartu Security → tukar kartu.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input ref={inputRef} value={barcode} onChange={(e) => setBarcode(e.target.value)} aria-label="Scan kartu tamu" placeholder="Scan atau ketik nomor kartu, lalu Enter..." autoComplete="off" className={`${inputClass} h-12 pl-10 text-base`} />
        </div>
        <button type="submit" disabled={busy || !barcode.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}Scan
        </button>
      </form>

      {outcome && (
        <div role="status" data-testid="scan-result" data-tone={outcome.tone} className={`mt-3 rounded-xl border px-4 py-3 ${tone}`}>
          <div className="flex items-start gap-3">
            {outcome.tone === 'in' ? <ArrowDownToLine className="mt-0.5 size-5 flex-shrink-0" /> : outcome.tone === 'out' ? <ArrowUpFromLine className="mt-0.5 size-5 flex-shrink-0" /> : <ScanLine className="mt-0.5 size-5 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{outcome.message}</p>
              <p className="mt-0.5 font-mono text-[11px] opacity-80">{outcome.barcode}{at ? ` · ${at.time}` : ''}</p>
            </div>
            <button type="button" onClick={() => { setOutcome(null); refocus() }} aria-label="Tutup hasil scan" className="grid size-7 flex-shrink-0 place-items-center rounded-full opacity-70 transition hover:bg-black/5 hover:opacity-100">
              <X className="size-4" />
            </button>
          </div>

          {outcome.candidates && outcome.candidates.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {outcome.candidates.map((guest) => (
                <li key={guest.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (outcome.pickFor === 'approve' ? approve(guest, outcome.barcode) : scan(outcome.barcode, guest.id))}
                    className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-left text-sm text-foreground transition hover:bg-white disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">{guest.full_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{[guest.company_remark, guest.pic_jai && guest.pic_jai !== '-' ? `PIC ${guest.pic_jai}` : ''].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-secondary-foreground">
                      {guest.entry_path === 'security' ? SECURITY_CARD_LABEL[guest.security_card_type] : 'Lobby'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {outcome.offerRegister && registerOptions && registerOptions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {registerOptions.map((option) => (
                <button key={option.label} type="button" onClick={() => { option.onPick(outcome.barcode); setOutcome(null) }} className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
