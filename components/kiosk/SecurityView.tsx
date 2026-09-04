'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowDownUp, LogOut, Plus, RotateCcw, ScanLine, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type Stage = 'pending_approval' | 'active' | 'closed'
type CardType = 'visitor' | 'vendor' | 'affiliate'

type Registration = {
  id: number
  full_name: string
  id_card: string
  pic_jai: string
  purpose: string
  company_remark: string
  registered_at: string
  entry_at: string | null
  exit_at: string | null
  stage: Stage
  current_card_type: CardType | null
  visitor_card_barcode: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'

function RegisterModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [picJai, setPicJai] = useState('')
  const [purpose, setPurpose] = useState('')
  const [companyRemark, setCompanyRemark] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEscapeClose(true, onClose)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fullName, idCard, picJai, purpose, companyRemark }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal menyimpan.'); return }
      onSaved()
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label="Pendaftaran Supplier / Vendor" className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <h2 className="text-lg font-bold">Pendaftaran Supplier / Vendor</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-[18px]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <label>
            <span className={labelClass}>Nama Lengkap</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Kartu Identitas (KTP/SIM/Paspor)</span>
            <input value={idCard} onChange={(e) => setIdCard(e.target.value)} required className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>PIC JAI yang Ditemui</span>
            <input value={picJai} onChange={(e) => setPicJai(e.target.value)} required className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Tujuan</span>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} required className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Keterangan (Perusahaan)</span>
            <input value={companyRemark} onChange={(e) => setCompanyRemark(e.target.value)} required className={inputClass} />
          </label>

          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary">
              Kembali
            </button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Menyimpan...' : 'Daftar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Small "scan the physical card" confirmation prompt, reused for both
// Approve (issuing a VISITOR card) and Close (accepting a returned one).
function ScanPrompt({
  title,
  description,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  submitLabel: string
  onClose: () => void
  onSubmit: (barcode: string) => Promise<string | null>
}) {
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEscapeClose(true, onClose)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!barcode.trim()) { setError('Barcode wajib diisi.'); return }
    setError(null)
    setSubmitting(true)
    const message = await onSubmit(barcode.trim())
    setSubmitting(false)
    if (message) setError(message)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
          <h2 className="text-sm font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-7 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-5">
          <p className="text-xs text-muted-foreground">{description}</p>
          <div className="relative">
            <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus placeholder="Scan atau ketik barcode..." className={`${inputClass} pl-10`} />
          </div>
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Batal</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Memproses...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const STAGE_BADGE: Record<string, string> = {
  pending_approval: 'bg-[#fff3d6] text-[#8a6100]',
  visitor: 'bg-[#dff5e6] text-[#1a6e3a]',
  working: 'bg-[#edf6ff] text-[#1a5fa0]',
  closed: 'bg-secondary text-muted-foreground',
}

function statusOf(r: Registration): { key: string; label: string } {
  if (r.stage === 'pending_approval') return { key: 'pending_approval', label: 'Menunggu Approval' }
  if (r.stage === 'closed') return { key: 'closed', label: 'Selesai' }
  if (r.current_card_type === 'visitor') return { key: 'visitor', label: 'Kartu Visitor' }
  return { key: 'working', label: 'Di Area Kerja' }
}

export function SecurityView() {
  const { adminUser, logout } = useAuth()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [formOpen, setFormOpen] = useState(false)
  const [scanTarget, setScanTarget] = useState<{ registration: Registration; action: 'approve' | 'close' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations?sort=${sort}&entryPath=security`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRegistrations(data.registrations ?? [])
      setError(null)
    } catch (e) {
      setRegistrations([])
      setError(e instanceof Error ? e.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [sort])

  useEffect(() => { load() }, [load])

  const handleScanSubmit = async (barcode: string): Promise<string | null> => {
    if (!scanTarget) return null
    const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${scanTarget.registration.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: scanTarget.action, barcode }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) return data?.message ?? 'Gagal memproses.'
    setScanTarget(null)
    load()
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-primary px-6 py-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white/15"><ShieldCheck className="size-5" /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/65">PT. Jatim Autocomp Indonesia</p>
            <h1 className="text-lg font-bold">Pendaftaran Supplier / Vendor di Pos Security</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-primary-foreground/75 sm:inline">{adminUser?.username}</span>
          <button onClick={() => logout()} className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-3 py-2 text-xs transition-colors hover:bg-primary-foreground/10">
            <LogOut className="size-4" />Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
              <ArrowDownUp className="size-3.5" />{sort === 'newest' ? 'Urutan Terlama' : 'Urutan Terbaru'}
            </button>
            <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
              <RotateCcw className="size-3.5" />Muat Ulang
            </button>
          </div>
          <button type="button" onClick={() => setFormOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
            <Plus className="size-4" />Pendaftaran &gt;&gt;
          </button>
        </div>

        {error && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-secondary/55">
                <tr>
                  {['Tanggal/Jam', 'Nama Lengkap', 'Kartu Identitas', 'PIC JAI', 'Tujuan', 'Keterangan', 'Jam Masuk', 'Jam Keluar', 'Status', 'Aksi'].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={10} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
                )}
                {!loading && registrations.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-16 text-center text-sm text-muted-foreground">Belum ada pendaftaran.</td></tr>
                )}
                {registrations.map((r, index) => {
                  const status = statusOf(r)
                  return (
                    <tr key={r.id} className={index % 2 ? 'bg-secondary/20' : ''}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.registered_at)}</td>
                      <td className="min-w-[160px] px-4 py-3 font-medium text-foreground">{r.full_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.id_card}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_jai}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.purpose}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.company_remark}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.entry_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.exit_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STAGE_BADGE[status.key]}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.stage === 'pending_approval' && (
                          <button type="button" onClick={() => setScanTarget({ registration: r, action: 'approve' })} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
                            <ScanLine className="size-3.5" />Approve
                          </button>
                        )}
                        {r.stage === 'active' && r.current_card_type === 'visitor' && (
                          <button type="button" onClick={() => setScanTarget({ registration: r, action: 'close' })} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
                            <ScanLine className="size-3.5" />Kartu Dikembalikan
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {formOpen && <RegisterModal onClose={() => setFormOpen(false)} onSaved={load} />}
      {scanTarget && (
        <ScanPrompt
          title={scanTarget.action === 'approve' ? 'Approve — Scan Kartu Visitor' : 'Scan Kartu Visitor yang Dikembalikan'}
          description={scanTarget.action === 'approve'
            ? `Scan barcode kartu VISITOR yang akan diberikan kepada ${scanTarget.registration.full_name}.`
            : `Scan barcode kartu VISITOR yang dikembalikan oleh ${scanTarget.registration.full_name}.`}
          submitLabel={scanTarget.action === 'approve' ? 'Approve' : 'Tutup Pendaftaran'}
          onClose={() => setScanTarget(null)}
          onSubmit={handleScanSubmit}
        />
      )}
    </div>
  )
}
