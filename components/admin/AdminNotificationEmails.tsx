// components/admin/AdminNotificationEmails.tsx
'use client'

// "Email notifikasi admin" on Kelola Admin: who is told when a document is
// approved or rejected, a photo/video request comes in, a document is due for
// review. The ISM Admin accounts' own addresses (edited on the account, below)
// plus a few extra addresses kept here — for a second or third person, or
// whoever takes over as admin.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Loader2, Mail, Plus, Send, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { EMAIL_HINT, isDeliverableEmail } from '@/lib/email-address'

type State = { emails: string[]; max: number; recipients: string[]; usedFallback: boolean; smtpReady: boolean; updatedAt: string | null; updatedBy: string | null }

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'

// accountsKey: changes when an account's e-mail is edited, so the list of recipients is read again.
export function AdminNotificationEmails({ accountsKey }: { accountsKey: string }) {
  const [state, setState] = useState<State | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admin-notification-emails`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setState(data)
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Gagal memuat email notifikasi.')
    }
  }, [])
  useEffect(() => { load() }, [load, accountsKey])

  const save = async (emails: string[]) => {
    setSaving(true); setError(''); setNotice('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admin-notification-emails`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emails }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal menyimpan.'); return false }
      setState(data)
      return true
    } catch {
      setError('Tidak dapat menghubungi server.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    const email = draft.trim().toLowerCase()
    if (!email || !state) return
    if (!isDeliverableEmail(email)) { setError(EMAIL_HINT); return }
    if (state.recipients.includes(email) && !state.usedFallback) { setError('Alamat ini sudah menerima notifikasi admin.'); return }
    if (await save([...state.emails, email])) setDraft('')
  }

  const sendTest = async () => {
    setTesting(true); setError(''); setNotice('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/admin-notification-emails`, { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Email uji gagal dikirim.'); return }
      setNotice(`Email uji dikirim ke ${(data.sentTo as string[]).join(', ')}.`)
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setTesting(false)
    }
  }

  const full = state ? state.emails.length >= state.max : false
  const fromAccounts = state ? state.recipients.filter((email) => !state.emails.includes(email)) : []

  return (
    <section aria-label="Email notifikasi admin" className="rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="portal-eyebrow">Email notifikasi admin</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Yang diberi tahu saat dokumen disahkan atau ditolak, ada permintaan foto/video, atau dokumen jatuh tempo review.
          </p>
        </div>
        <button
          type="button"
          onClick={sendTest}
          disabled={testing || !state?.smtpReady}
          title={state && !state.smtpReady ? 'SMTP belum diatur (Kelola SMTP)' : 'Kirim email uji ke semua penerima'}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}Kirim email uji
        </button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {!state && !error && <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
        {state && (
          <>
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Penerima saat ini ({state.usedFallback ? 0 : state.recipients.length})</p>
              {state.usedFallback ? (
                <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  Belum ada alamat yang bisa menerima email{state.recipients[0] ? <> — untuk sementara notifikasi masuk ke kotak pengirim SMTP (<span className="font-semibold">{state.recipients[0]}</span>)</> : null}. Tambahkan alamat di bawah, atau isi email akun ISM Admin.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {fromAccounts.map((email) => (
                    <li key={email} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-foreground" title="Email akun ISM Admin — ubah lewat 'Ubah email' pada akunnya">
                      <Mail className="size-3.5 text-muted-foreground" />{email}<span className="text-[10px] text-muted-foreground">· akun</span>
                    </li>
                  ))}
                  {state.emails.map((email) => (
                    <li key={email} className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 py-1 pl-3 pr-1 text-xs text-foreground">
                      <Mail className="size-3.5 text-primary" />{email}
                      <button type="button" disabled={saving} onClick={() => save(state.emails.filter((item) => item !== email))} aria-label={`Hapus ${email}`} title="Hapus dari penerima" className="grid size-6 place-items-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={draft}
                onChange={(e) => { setDraft(e.target.value); setError('') }}
                disabled={full || saving}
                aria-label="Email penerima tambahan"
                placeholder={full ? `Sudah ${state.max} alamat tambahan — hapus satu untuk menambah` : 'Tambah alamat, mis. nama@jai.co.id'}
                className={`${inputClass} sm:flex-1`}
              />
              <button type="submit" disabled={full || saving || !draft.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Tambah
              </button>
            </form>
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Alamat tambahan: {state.emails.length}/{state.max}. Orangnya tidak perlu punya akun. Saat admin berganti, cukup tambahkan alamat yang baru dan hapus yang lama.
            </p>
          </>
        )}
        {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
        {notice && <p className="rounded-xl border border-emerald-300/60 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">{notice}</p>}
      </div>
    </section>
  )
}
