// components/kiosk/CallRecordDialog.tsx
'use client'

// Admin Lobby → "Panggil Record" (the old "Panggil Data Record Supplier /
// Vendor" screen): the guest arrives from Pos Security with its card. Scan
// that Security card — the guest's record is called up — then scan the Lobby
// card handed over instead (VISITOR or VENDOR). The window stays open for the
// next guest. Underneath, as on the old screen: the Security cards that are
// out and the reception (Lobby) cards that are out, "number -> date".

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowRightLeft, CheckCircle2, Loader2, ScanLine, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { lobbyCardProblem, lobbyCardRangeText } from '@/lib/card-ranges'
import { CARD_BARCODE_FIELD, SECURITY_CARD_LABEL, inputClass, isRepeatScan, markScanned, type Registration } from '@/components/kiosk/kiosk-shared'

type SwapKind = 'visitor' | 'vendor'
const SWAP_LABEL: Record<SwapKind, string> = { visitor: 'VISITOR', vendor: 'VENDOR' }
type Line = { key: string; code: string; since: string | null; name: string; note?: string; callable: boolean }

// "13-OKT 2026", the way the old screen wrote it
function cardDate(value: string | null) {
  if (!value) return '—'
  const at = new Date(value)
  return `${String(at.getDate()).padStart(2, '0')}-${at.toLocaleDateString('id-ID', { month: 'short' }).replace('.', '').toUpperCase()} ${at.getFullYear()}`
}
const byCode = (a: Line, b: Line) => a.code.localeCompare(b.code, 'id', { numeric: true })

export function CallRecordDialog({ station, registrations, onClose, onChanged }: {
  station: 'lobby' | 'security'
  /** The guests as the page has them — the lists follow as cards are swapped. */
  registrations: Registration[]
  onClose: () => void
  onChanged: () => void
}) {
  const [securityNo, setSecurityNo] = useState('')
  const [guest, setGuest] = useState<Registration | null>(null)
  const [kind, setKind] = useState<SwapKind>('vendor')
  const [lobbyNo, setLobbyNo] = useState('')
  const [busy, setBusy] = useState(false)
  // A second read of the same card while the first is on its way is dropped, not glued onto it.
  const busyRef = useRef(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [swapped, setSwapped] = useState(0)
  // the same number on two kinds of Security card: which guest is it?
  const [choices, setChoices] = useState<{ code: string; guests: Registration[] } | null>(null)
  const securityRef = useRef<HTMLInputElement>(null)
  const lobbyRef = useRef<HTMLInputElement>(null)
  useEscapeClose(true, onClose)
  // The cursor is always where the next scan goes: the Security card first,
  // then — once the record is up — the Lobby card, then the Security field
  // again for the next guest. (An effect: the field it moves to has only just
  // been put on the screen.)
  useEffect(() => { (guest ? lobbyRef : securityRef).current?.focus() }, [guest, swapped])

  const lists = useMemo(() => {
    const security: Line[] = [], reception: Line[] = []
    for (const g of registrations) {
      if (g.stage !== 'active') continue
      const fromSecurity = g.entry_path === 'security'
      if (fromSecurity && g.security_card_barcode) {
        security.push({ key: `s${g.id}`, code: g.security_card_barcode, since: g.entry_at, name: g.full_name, note: g.at_work_area ? 'sudah ditukar' : undefined, callable: !g.at_work_area })
      }
      const lobbyType = g.current_card_type && (!fromSecurity || g.at_work_area) ? g.current_card_type : null
      const code = lobbyType ? (g[CARD_BARCODE_FIELD[lobbyType]] as string | null) : null
      if (code) reception.push({ key: `l${g.id}`, code, since: g.entry_at, name: g.full_name, callable: false })
    }
    return { security: security.sort(byCode), reception: reception.sort(byCode) }
  }, [registrations])

  const call = async (code: string, id?: number) => {
    busyRef.current = true
    setBusy(true); setMessage(null); setChoices(null); setSecurityNo('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ barcode: code, station, mode: 'call', ...(id ? { id } : {}) }),
      })
      const data = await res.json().catch(() => null) as { result?: string; message?: string; registration?: Registration; candidates?: Registration[] } | null
      if (data?.result === 'swap' && data.registration) {
        markScanned(code)
        setGuest(data.registration)
        // a guest registered as Vendor usually gets the Vendor card; anyone else the Visitor card
        setKind(data.registration.security_card_type === 'vendor' ? 'vendor' : 'visitor')
        setLobbyNo('')
      } else {
        setMessage({ ok: false, text: data?.message ?? 'Record tidak ditemukan.' })
        if (data?.result === 'choose' && data.candidates?.length) setChoices({ code, guests: data.candidates })
        securityRef.current?.focus()
      }
    } catch {
      setMessage({ ok: false, text: 'Tidak dapat menghubungi server.' })
    } finally {
      busyRef.current = false
      setBusy(false)
      setSecurityNo('')
    }
  }
  const submitCall = (event: FormEvent) => {
    event.preventDefault()
    const code = securityNo.trim()
    if (!code || busyRef.current) return
    // the Lobby card just handed over (or the Security card just called up), read a second time
    if (isRepeatScan(code)) { setSecurityNo(''); return }
    call(code)
  }

  const problem = lobbyNo.trim() ? lobbyCardProblem(lobbyNo, kind) : null
  const submitSwap = async (event: FormEvent) => {
    event.preventDefault()
    if (busyRef.current) return
    // the Security card that called this record up, read a second time
    if (isRepeatScan(lobbyNo)) { setLobbyNo(''); return }
    const code = lobbyNo.trim()
    if (!guest || !code || problem) return
    busyRef.current = true
    setBusy(true); setMessage(null); setLobbyNo('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${guest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'swapToWorkArea', cardType: kind, barcode: code }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setMessage({ ok: false, text: data?.message ?? 'Gagal menukar kartu.' }); lobbyRef.current?.focus(); return }
      setMessage({ ok: true, text: `${guest.full_name}: kartu ${SECURITY_CARD_LABEL[guest.security_card_type]} Security ${guest.security_card_barcode ?? ''} ditukar dengan kartu ${SWAP_LABEL[kind]} Lobby ${data?.registration?.[CARD_BARCODE_FIELD[kind]] ?? code}.` })
      markScanned(code)
      setSwapped((n) => n + 1)
      setGuest(null)
      setLobbyNo('')
      onChanged()
      window.setTimeout(() => securityRef.current?.focus(), 0)
    } catch {
      setMessage({ ok: false, text: 'Tidak dapat menghubungi server.' })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const cancelGuest = () => { setGuest(null); setLobbyNo(''); setMessage(null); window.setTimeout(() => securityRef.current?.focus(), 0) }

  const column = (label: string, lines: Line[], bg: string, color: string, testid: string) => (
    <section aria-label={label} className="flex min-w-0 flex-col" data-testid={testid}>
      <header className="px-3 py-2.5 text-center" style={{ background: bg, color }}>
        <p className="text-[12px] font-bold uppercase tracking-wide">{label}</p>
        <p className="text-[11px] font-semibold opacity-90">[Dipakai = {lines.length}]</p>
      </header>
      <ul className="max-h-[38vh] min-h-24 flex-1 overflow-y-auto bg-secondary/20 py-1.5">
        {lines.length === 0 && <li className="px-2 py-3 text-center text-[11px] text-muted-foreground/70">—</li>}
        {lines.map((line) => (
          <li key={line.key}>
            <button
              type="button"
              disabled={!line.callable || !!guest}
              onClick={() => call(line.code)}
              title={line.callable ? `${line.name} — klik untuk memanggil record-nya` : line.name}
              className={`block w-full px-2 py-1 text-center ${line.callable && !guest ? 'cursor-pointer hover:bg-primary/10' : 'cursor-default'}`}
            >
              <span className="block font-mono text-[12px] font-semibold tabular-nums text-foreground">{line.code}<span className="mx-1 font-sans text-muted-foreground">-&gt;</span>{cardDate(line.since)}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{line.name}{line.note ? ` · ${line.note}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 backdrop-blur-[2px] sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Panggil Record" className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2.5">
            <ArrowRightLeft className="size-5" />
            <div>
              <h2 className="text-base font-bold">Panggil Data Record Supplier / Vendor</h2>
              <p className="text-xs text-primary-foreground/75">Tukar kartu dari Pos Security ke kartu Lobby.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground"><X className="size-[18px]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!guest ? (
            <form onSubmit={submitCall} className="px-5 pt-5">
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Barcode kartu ID dari Security</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input ref={securityRef} value={securityNo} onChange={(e) => { if (!busyRef.current) setSecurityNo(e.target.value) }} aria-label="Barcode kartu ID dari Security" placeholder="Scan kartu Security yang dibawa tamu, lalu Enter..." autoComplete="off" className={`${inputClass} h-12 pl-10 text-base`} />
                </div>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
                  {busy && <Loader2 className="size-4 animate-spin" />}Panggil
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitSwap} className="px-5 pt-5" data-testid="called-record">
              <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Record tamu</p>
                <p className="mt-0.5 text-base font-bold text-foreground">{guest.full_name}</p>
                <p className="text-xs text-muted-foreground">{[guest.company_remark, guest.pic_jai && guest.pic_jai !== '-' ? `PIC JAI ${guest.pic_jai}` : '', guest.purpose].filter(Boolean).join(' · ')}</p>
                <p className="mt-1.5 text-xs text-foreground">Membawa kartu <strong>{SECURITY_CARD_LABEL[guest.security_card_type]} Security</strong> <span className="font-mono font-semibold">{guest.security_card_barcode}</span></p>
              </div>
              <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Tukar dengan kartu Lobby</p>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {(['visitor', 'vendor'] as SwapKind[]).map((option) => (
                  <button key={option} type="button" aria-pressed={kind === option} onClick={() => { setKind(option); lobbyRef.current?.focus() }} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${kind === option ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
                    {SWAP_LABEL[option]}
                  </button>
                ))}
                <span className="text-[11px] text-muted-foreground">nomor {lobbyCardRangeText(kind)}</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input ref={lobbyRef} value={lobbyNo} onChange={(e) => { if (!busyRef.current) setLobbyNo(e.target.value) }} onKeyDown={(e) => { if (e.key === 'Enter' && isRepeatScan(lobbyNo)) { e.preventDefault(); setLobbyNo('') } }} aria-label="Barcode kartu Lobby" placeholder={`Scan kartu ${SWAP_LABEL[kind]} Lobby, lalu Enter...`} autoComplete="off" className={`${inputClass} h-12 pl-10 text-base`} />
                </div>
                <button type="submit" disabled={busy || !lobbyNo.trim() || !!problem} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRightLeft className="size-4" />}Tukar
                </button>
                <button type="button" onClick={cancelGuest} className="rounded-xl border border-border px-4 text-sm font-medium text-foreground transition hover:bg-secondary">Batal</button>
              </div>
              {problem && <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">{problem}</p>}
            </form>
          )}

          <div className="px-5 pt-3">
            {message ? (
              <p role="status" className={`flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${message.ok ? 'border-emerald-300/70 bg-emerald-50 text-emerald-900' : 'border-amber-300/70 bg-amber-50 text-amber-900'}`}>
                {message.ok && <CheckCircle2 className="mt-0.5 size-4 flex-none" />}<span>{message.text}</span>
              </p>
            ) : (
              <p className="rounded-xl bg-secondary/40 px-4 py-2.5 text-xs text-muted-foreground">
                {guest ? 'Pesan: pilih jenis kartu Lobby lalu scan kartunya.' : 'Pesan: scan barcode kartu ID dari Security. Klik sebuah nomor di daftar Kartu Security untuk memanggil record-nya.'}
              </p>
            )}
          </div>

          {choices && !guest && (
            <div className="flex flex-col gap-1.5 px-5 pt-2">
              {choices.guests.map((option) => (
                <button key={option.id} type="button" disabled={busy} onClick={() => call(choices.code, option.id)} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition hover:bg-secondary disabled:opacity-60">
                  <span><span className="font-semibold">{option.full_name}</span><span className="ml-2 text-xs text-muted-foreground">{option.company_remark}</span></span>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-secondary-foreground">{SECURITY_CARD_LABEL[option.security_card_type]}</span>
                </button>
              ))}
            </div>
          )}

          <div className="p-5">
            <div className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border border-border">
              {column('Kartu Security', lists.security, '#5c3b4e', '#ffffff', 'call-security')}
              {column('Kartu Resepsionis', lists.reception, '#e6cf5c', '#3d3400', 'call-reception')}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
          <p className="text-xs text-muted-foreground">{swapped ? `${swapped} kartu ditukar` : 'Belum ada kartu yang ditukar.'}</p>
          <button type="button" onClick={onClose} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Selesai</button>
        </div>
      </div>
    </div>
  )
}
