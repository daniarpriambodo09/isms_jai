// components/documents/VisitorApproverSettings.tsx

'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2, Settings2, UserCog, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type VisitorApprover = { id: number; fullName: string | null; title: string | null; email: string | null }

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'

// ISM Admin-only control on the Visitor tab of /ijin-foto-video — lets an
// admin repoint who visitor requests get routed/emailed to (e.g. when Pak
// Tsu is replaced) without touching code or the database directly. Visitor
// submissions never let the requester pick a PIC themselves (see
// /api/photo-video-requests POST) — they're always routed to whichever PIC
// this sets as is_visitor_default.
export function VisitorApproverSettings({ onSaved }: { onSaved?: (approver: VisitorApprover) => void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeClose(open, () => setOpen(false))

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE_PATH}/api/pic-approvers/visitor-default`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { approver: null }))
      .then((data: { approver: VisitorApprover | null }) => {
        setFullName(data.approver?.fullName ?? '')
        setTitle(data.approver?.title ?? '')
        setEmail(data.approver?.email ?? '')
      })
      .catch(() => setError('Gagal memuat data approver.'))
      .finally(() => setLoading(false))
  }, [open])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/pic-approvers/visitor-default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), title: title.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal menyimpan approver.')
      onSaved?.(data.approver)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground"
      >
        <Settings2 className="size-3.5" /> Setting Approver
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-label="Setting Approver Visitor" className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><UserCog className="size-4" /></span>
                <div>
                  <p className="text-sm font-bold text-foreground">Setting Approver Visitor</p>
                  <p className="text-xs text-muted-foreground">Semua pengajuan Visitor otomatis diteruskan ke orang ini.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Memuat...</p>
              ) : (
                <div className="flex flex-col gap-3.5">
                  <label>
                    <span className={labelClass}>Nama Lengkap</span>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Contoh: Teguh Sunjoyo" className={inputClass} />
                  </label>
                  <label>
                    <span className={labelClass}>Jabatan</span>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Information Assets Administrator" className={inputClass} />
                    <span className="mt-1 block text-[11px] text-muted-foreground">Opsional — dicetak di bawah nama approver pada surat pengajuan PDF.</span>
                  </label>
                  <label>
                    <span className={labelClass}>Email</span>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="nama@jatimautocomp.com" className={inputClass} />
                  </label>
                  <p className="text-[11px] text-muted-foreground">Notifikasi email pengajuan baru dari Visitor akan dikirim ke alamat ini (butuh SMTP sudah dikonfigurasi di Admin Settings → SMTP Settings).</p>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Batal</button>
              <button
                type="button"
                onClick={save}
                disabled={saving || loading || !fullName.trim() || !email.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
