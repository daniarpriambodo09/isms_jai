// components/kiosk/ManualCloseDialog.tsx
'use client'

// "Tutup Manual" at Admin Lobby and Pos Security: a visit whose card can't be
// scanned back — lost, the guest left with it, a wrong number recorded — is
// closed by hand, with the reason, instead of deleting the record. Every card
// on it is freed; the reason and who closed it stay on the record
// (PUT /api/vendor-registrations/[id], action 'forceClose').

import { useState, type FormEvent } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { CARD_BARCODE_FIELD, SECURITY_CARD_LABEL, inputClass, labelClass, type Registration } from '@/components/kiosk/kiosk-shared'

const CARD_LABEL: Record<string, string> = { visitor: 'Visitor', vendor: 'Vendor', supplier: 'Supplier', affiliate: 'Affiliate', special_area: 'Special Area', photography: 'Photography' }
const REASONS = ['Kartu hilang', 'Tamu pulang tanpa mengembalikan kartu', 'Salah scan / nomor kartu salah', 'Tamu batal masuk']

/** The cards this visit still holds, as the person at the desk would name them. */
function heldCards(r: Registration): string[] {
  if (r.stage !== 'active' || !r.current_card_type) return []
  const held = [`Kartu ${CARD_LABEL[r.current_card_type]}${r.entry_path === 'security' && r.at_work_area ? ' Lobby' : ''} ${r[CARD_BARCODE_FIELD[r.current_card_type]] ?? ''}`.trim()]
  if (r.entry_path === 'security' && r.at_work_area) held.push(`Kartu ${SECURITY_CARD_LABEL[r.security_card_type]} Security ${r.security_card_barcode ?? ''}`.trim())
  return held
}

export function ManualCloseDialog({ registration, onClose, onDone }: { registration: Registration; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEscapeClose(true, onClose)
  const cards = heldCards(registration)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (reason.trim().length < 3) { setError('Tulis alasannya (mis. kartu hilang).'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${registration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'forceClose', reason: reason.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal menutup pendaftaran.'); return }
      onDone()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Tutup Manual" onClick={(event) => event.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
          <h2 className="text-sm font-bold">Tutup Manual — {registration.full_name}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-7 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3 p-5">
          <p className="flex gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 flex-shrink-0" />
            <span>
              Untuk kartu yang tidak bisa di-scan kembali. Kunjungan ditutup tanpa scan, jam keluar = sekarang,
              {cards.length ? <> dan nomor kartu dilepas (bisa dipakai lagi): <b>{cards.join(' · ')}</b>.</> : ' tamu ini belum memegang kartu.'}
              {' '}Alasannya tersimpan di data tamu.
            </span>
          </p>
          <div>
            <span className={labelClass}>Alasan</span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {REASONS.map((text) => (
                <button key={text} type="button" onClick={() => setReason(text)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${reason === text ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
                  {text}
                </button>
              ))}
            </div>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus aria-label="Alasan tutup manual" placeholder="Pilih di atas atau tulis sendiri..." className={inputClass} />
          </div>
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Batal</button>
            <button type="submit" disabled={busy} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-destructive py-2 text-sm font-semibold text-white transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60">
              {busy && <Loader2 className="size-4 animate-spin" />}Tutup Manual
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
