// components/kiosk/ReturnCardDialog.tsx
'use client'

// "Pengembalian Kartu ID" at Admin Lobby and Pos Security (as on the old
// reception screen): a window that only takes cards back — at the Lobby its
// own cards, at Pos Security the Security cards (which ends the visit). Scan the returned card — the guest it
// belongs to is found and the card is recorded as returned; it stays open so
// several cards can be handed in one after another. Underneath, as on the old
// screen, every card that is out right now: one column per kind, each line
// "card number ⟹ date" (a Security card also shows the Lobby card it was
// swapped for).

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2, ScanLine, Undo2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import type { PermitCard } from '@/components/kiosk/ActiveCardsWidget'
import { CARD_BARCODE_FIELD, cardsChanged, inputClass, isRepeatScan, markScanned, type Registration } from '@/components/kiosk/kiosk-shared'

type Entry = { ok: boolean; message: string; barcode: string; candidates?: Registration[] }

// One line of a column: the card, since when, who — and for a Security card the Lobby card held instead.
type Line = { key: string; code: string; since: string | null; name: string; pair?: string | null; note?: string; returnable: boolean }
// pair: the other post's card of the same guest, shown as a third part of the line.
type Column = { key: string; label: string; bg: string; color: string; withPair?: boolean; lines: Line[] }
const LOBBY_COLUMNS: Omit<Column, 'lines'>[] = [
  { key: 'security', label: 'Security', bg: '#5c3b4e', color: '#ffffff', withPair: true },
  { key: 'vendor', label: 'Vendor', bg: '#e6cf5c', color: '#3d3400' },
  { key: 'visitor', label: 'Visitor', bg: '#8f86d8', color: '#ffffff' },
  { key: 'affiliate', label: 'Affiliate', bg: '#b78be0', color: '#ffffff' },
  { key: 'special_area', label: 'Special Area', bg: '#c63a4c', color: '#ffffff' },
  { key: 'photography', label: 'Photography', bg: '#6fb86a', color: '#12340f' },
]
// Pos Security hands out three kinds of card; each line also shows the Lobby card the guest holds instead, if any.
const SECURITY_COLUMNS: Omit<Column, 'lines'>[] = [
  { key: 'visitor', label: 'Visitor', bg: '#8f86d8', color: '#ffffff', withPair: true },
  { key: 'vendor', label: 'Vendor', bg: '#e6cf5c', color: '#3d3400', withPair: true },
  { key: 'supplier', label: 'Supplier', bg: '#3f9c93', color: '#ffffff', withPair: true },
]

// "13-OKT 2026", the way the old screen wrote it
function cardDate(value: string | null) {
  if (!value) return '—'
  const at = new Date(value)
  return `${String(at.getDate()).padStart(2, '0')}-${at.toLocaleDateString('id-ID', { month: 'short' }).replace('.', '').toUpperCase()} ${at.getFullYear()}`
}
// 2, 10, 012: numbers in number order, anything else alphabetically
const byCode = (a: Line, b: Line) => a.code.localeCompare(b.code, 'id', { numeric: true })

export function ReturnCardDialog({
  station,
  registrations,
  permitCards = [],
  onClose,
  onChanged,
}: {
  station: 'lobby' | 'security'
  /** The guests as the page has them — the lists below follow as cards come back. */
  registrations: Registration[]
  /** Cards out on a photo / special-area permit (they are returned on the permit, not here). */
  permitCards?: PermitCard[]
  onClose: () => void
  onChanged: () => void
}) {
  const [barcode, setBarcode] = useState('')
  const [busy, setBusy] = useState(false)
  // A second read of the same card while the first is on its way is dropped, not glued onto it.
  const busyRef = useRef(false)
  // newest first: what was handed in during this sitting
  const [log, setLog] = useState<Entry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  useEscapeClose(true, onClose)
  useEffect(() => { inputRef.current?.focus() }, [])

  const columns: Column[] = useMemo(() => {
    const lines: Record<string, Line[]> = {}
    const add = (key: string, line: Line) => { (lines[key] ??= []).push(line) }
    for (const guest of registrations) {
      if (guest.stage !== 'active') continue
      const fromSecurity = guest.entry_path === 'security'
      // the Lobby card in hand, if any
      const lobbyType = guest.current_card_type && (!fromSecurity || guest.at_work_area) ? guest.current_card_type : null
      const lobbyCode = lobbyType ? (guest[CARD_BARCODE_FIELD[lobbyType]] as string | null) : null
      if (station === 'security') {
        // this post's own cards, by kind; one that was swapped at the Lobby can't come back here yet
        if (fromSecurity && guest.security_card_barcode) {
          add(guest.security_card_type, { key: `s${guest.id}`, code: guest.security_card_barcode, since: guest.entry_at, name: guest.full_name, pair: lobbyCode, note: lobbyCode ? 'masih memegang kartu Lobby' : undefined, returnable: !guest.at_work_area })
        }
        continue
      }
      // a Security card stays out for the whole visit — with the Lobby card it was swapped for, if any
      if (fromSecurity && guest.security_card_barcode) {
        add('security', { key: `s${guest.id}`, code: guest.security_card_barcode, since: guest.entry_at, name: guest.full_name, pair: lobbyCode, note: guest.security_card_type, returnable: false })
      }
      if (lobbyType && lobbyCode && lobbyType !== 'supplier') {
        add(lobbyType, { key: `l${guest.id}`, code: lobbyCode, since: guest.entry_at, name: guest.full_name, returnable: true })
      }
    }
    if (station === 'lobby') {
      for (const card of permitCards) {
        // a Special Area card is scanned back in here (its permit gets the exit time); a photo card is closed on its request
        if (card.type === 'special_area' || card.type === 'photography') add(card.type, { key: card.key, code: card.code, since: card.from, name: card.name, note: card.note, returnable: card.type === 'special_area' })
      }
    }
    return (station === 'security' ? SECURITY_COLUMNS : LOBBY_COLUMNS).map((column) => ({ ...column, lines: (lines[column.key] ?? []).sort(byCode) }))
  }, [registrations, permitCards, station])

  const send = async (code: string, id?: number) => {
    busyRef.current = true
    setBusy(true)
    setBarcode('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ barcode: code, station, mode: 'return', ...(id ? { id } : {}) }),
      })
      const data = await res.json().catch(() => null) as { result?: string; message?: string; candidates?: Registration[] } | null
      const done = data?.result === 'out' || data?.result === 'returned'
      setLog((current) => [{ ok: done, message: data?.message ?? 'Gagal memproses.', barcode: code, candidates: data?.result === 'choose' ? data.candidates : undefined }, ...current.filter((entry) => !(entry.candidates && entry.barcode === code))].slice(0, 12))
      if (done) { markScanned(code); onChanged(); cardsChanged() }
    } catch {
      setLog((current) => [{ ok: false, message: 'Tidak dapat menghubungi server.', barcode: code }, ...current].slice(0, 12))
    } finally {
      busyRef.current = false
      setBusy(false)
      setBarcode('')
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const code = barcode.trim()
    if (!code || busyRef.current) return
    // the card just taken back, read a second time
    if (isRepeatScan(code)) { setBarcode(''); return }
    send(code)
  }
  const returned = log.filter((entry) => entry.ok).length

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 backdrop-blur-[2px] sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Pengembalian Kartu ID" data-station={station} className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ${station === 'security' ? 'max-w-3xl' : 'max-w-6xl'}`}>
        <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
          <div className="flex items-center gap-2.5">
            <Undo2 className="size-5" />
            <div>
              <h2 className="text-base font-bold">Pengembalian Kartu ID</h2>
              <p className="text-xs text-primary-foreground/75">{station === 'security' ? 'Scan kartu Security yang dikembalikan — kunjungan tamunya ditutup.' : 'Scan barcode kartu ID yang dikembalikan — satu per satu.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground"><X className="size-[18px]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <form onSubmit={submit} className="flex gap-2 px-5 pt-5">
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input ref={inputRef} value={barcode} onChange={(e) => { if (!busyRef.current) setBarcode(e.target.value) }} aria-label="Scan kartu yang dikembalikan" placeholder="Scan atau ketik nomor kartu, lalu Enter..." autoComplete="off" className={`${inputClass} h-12 pl-10 text-base`} />
            </div>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}Terima
            </button>
          </form>

          {/* What was just scanned: the newest on top, a few lines only — the lists below are the main thing. */}
          <div className="px-5 pt-3">
            {log.length === 0 ? (
              <p className="rounded-xl bg-secondary/40 px-4 py-2.5 text-xs text-muted-foreground">Pesan: scan barcode kartu ID yang dikembalikan. Klik sebuah nomor di daftar untuk mengisinya ke kolom.</p>
            ) : (
              <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto" data-testid="return-log">
                {log.map((entry, index) => (
                  <li key={`${entry.barcode}-${log.length - index}`} className={`rounded-xl border px-4 py-2 ${entry.ok ? 'border-emerald-300/70 bg-emerald-50 text-emerald-900' : 'border-amber-300/70 bg-amber-50 text-amber-900'}`}>
                    <p className="flex items-start gap-2 text-sm font-semibold">{entry.ok && <CheckCircle2 className="mt-0.5 size-4 flex-none" />}<span>{entry.message}</span></p>
                    <p className="mt-0.5 font-mono text-[11px] opacity-80">{entry.barcode}</p>
                    {entry.candidates && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        {entry.candidates.map((guest) => (
                          <button key={guest.id} type="button" disabled={busy} onClick={() => send(entry.barcode, guest.id)} className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 text-left text-sm text-foreground transition hover:bg-white disabled:opacity-60">
                            <span className="font-semibold">{guest.full_name}</span><span className="ml-2 text-xs text-muted-foreground">{guest.company_remark}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Every card that is out, one column per kind — as on the old reception screen. */}
          <div className="p-5">
            <div className="overflow-x-auto rounded-xl border border-border">
              <div className={`grid divide-x divide-border ${station === 'security' ? 'min-w-[540px] grid-cols-3' : 'min-w-[960px] grid-cols-[1.6fr_repeat(5,minmax(0,1fr))]'}`} data-testid="cards-out">
                {columns.map((column) => {
                  const lines = column.lines
                  return (
                    <section key={column.key} aria-label={`Kartu ${column.label}`} className="flex min-w-0 flex-col">
                      <header className="px-2 py-2.5 text-center" style={{ background: column.bg, color: column.color }}>
                        <p className="text-[12px] font-bold uppercase tracking-wide">{column.label}</p>
                        <p className="text-[11px] font-semibold opacity-90">[Dipakai = {lines.length}]</p>
                      </header>
                      <ul className="max-h-[46vh] min-h-24 flex-1 overflow-y-auto bg-secondary/20 py-1.5">
                        {lines.length === 0 && <li className="px-2 py-3 text-center text-[11px] text-muted-foreground/70">—</li>}
                        {lines.map((line) => (
                          <li key={line.key}>
                            <button
                              type="button"
                              disabled={!line.returnable}
                              onClick={() => { setBarcode(line.code); inputRef.current?.focus() }}
                              title={line.returnable ? `${line.name} — klik untuk mengisi nomor ini ke kolom scan` : `${line.name}${line.note ? ` · ${line.note}` : ''}${station === 'security' ? ' — tukar kembali di Lobby dulu' : column.key === 'security' ? ' — dikembalikan di Pos Security' : ' — dikembalikan lewat izinnya'}`}
                              className={`block w-full px-2 py-1 text-center ${line.returnable ? 'cursor-pointer hover:bg-primary/10' : 'cursor-default'}`}
                            >
                              <span className="block break-words font-mono text-[12px] font-semibold tabular-nums text-foreground">
                                {line.code}<span className="mx-0.5 font-sans text-muted-foreground">⟹</span>{cardDate(line.since)}
                                {column.withPair && <><span className="mx-0.5 font-sans text-muted-foreground">⟹</span>{line.pair ?? ''}</>}
                              </span>
                              <span className="block truncate text-[10px] text-muted-foreground">{line.name}{station === 'security' && line.note ? ` · ${line.note}` : ''}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {station === 'security'
                ? 'Tiap baris: nomor kartu Security ⟹ tanggal ⟹ kartu Lobby yang sedang dipegang tamu sebagai gantinya (kosong bila tidak ada). Tamu yang masih memegang kartu Lobby harus menukarnya kembali di Lobby dulu.'
                : 'Kolom Security: nomor kartu Security ⟹ tanggal ⟹ kartu Lobby yang dipegang sebagai gantinya (kosong bila belum ditukar). Kartu Security dikembalikan di Pos Security. Kartu Special Area di-scan di sini — jam keluar di izinnya ikut tercatat; kartu Photography lewat izinnya.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
          <p className="text-xs text-muted-foreground">{returned ? `${returned} kartu diterima kembali` : 'Belum ada kartu yang di-scan.'}</p>
          <button type="button" onClick={onClose} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Selesai</button>
        </div>
      </div>
    </div>
  )
}
