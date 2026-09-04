'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { LogOut, RotateCcw, ScanLine, ShieldCheck, Search, UserPlus, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

type Stage = 'pending_approval' | 'active' | 'closed'
type CardType = 'visitor' | 'vendor' | 'affiliate'
type EntryPath = 'security' | 'lobby_affiliate'

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
  entry_path: EntryPath
  stage: Stage
  current_card_type: CardType | null
  visitor_card_barcode: string | null
  vendor_card_barcode: string | null
  affiliate_card_barcode: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'

const STAGE_BADGE: Record<string, string> = {
  pending_approval: 'bg-[#fff3d6] text-[#8a6100]',
  visitor: 'bg-[#dff5e6] text-[#1a6e3a]',
  vendor: 'bg-[#edf6ff] text-[#1a5fa0]',
  affiliate: 'bg-[#f7f0ff] text-[#6a30a0]',
  closed: 'bg-secondary text-muted-foreground',
}
function statusOf(r: Registration): { key: string; label: string } {
  if (r.stage === 'pending_approval') return { key: 'pending_approval', label: 'Menunggu Approval Security' }
  if (r.stage === 'closed') return { key: 'closed', label: 'Selesai' }
  if (r.current_card_type === 'vendor') return { key: 'vendor', label: 'Kartu Vendor' }
  if (r.current_card_type === 'affiliate') return { key: 'affiliate', label: 'Kartu Affiliate' }
  return { key: 'visitor', label: 'Kartu Visitor' }
}

function AffiliateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [picJai, setPicJai] = useState('')
  const [purpose, setPurpose] = useState('')
  const [companyRemark, setCompanyRemark] = useState('')
  const [affiliateBarcode, setAffiliateBarcode] = useState('')
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
        body: JSON.stringify({ fullName, idCard, picJai, purpose, companyRemark, affiliateBarcode }),
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
      <div role="dialog" aria-modal="true" aria-label="Daftarkan Tamu Affiliate" className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <h2 className="text-lg font-bold">Daftarkan Tamu Affiliate</h2>
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
          <label>
            <span className={labelClass}>Barcode Kartu Affiliate</span>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={affiliateBarcode} onChange={(e) => setAffiliateBarcode(e.target.value)} required placeholder="Scan atau ketik barcode..." className={`${inputClass} pl-10`} />
            </div>
          </label>

          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary">Kembali</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Menyimpan...' : 'Daftar & Terbitkan Kartu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetailPanel({ registration, onClose, onChanged }: { registration: Registration; onClose: () => void; onChanged: () => void }) {
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const status = statusOf(registration)

  const runAction = async (action: 'swapToVendor' | 'returnVendor' | 'returnAffiliate') => {
    if (!barcode.trim()) { setError('Barcode wajib diisi.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${registration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, barcode: barcode.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal memproses.'); return }
      onChanged()
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  const row = (label: string, value: string) => (
    <div className="grid grid-cols-[160px_1fr] border-b border-border last:border-0">
      <div className="border-r border-border bg-secondary/40 px-4 py-3 text-sm font-semibold text-foreground">{label}</div>
      <div className="px-4 py-3 text-sm font-medium text-foreground">{value}</div>
    </div>
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
        <h2 className="text-sm font-bold uppercase tracking-wide">{registration.full_name}</h2>
        <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-7 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
          <X className="size-4" />
        </button>
      </div>

      {row('PIC JAI :', registration.pic_jai)}
      {row('Tujuan :', registration.purpose)}
      {row('Keterangan :', registration.company_remark)}
      {row('Status :', status.label)}

      <div className="p-4">
        {registration.current_card_type === 'visitor' && (
          <div className="rounded-xl bg-accent/10 p-4">
            <p className="mb-2 text-xs font-semibold text-foreground">Tukar ke Kartu VENDOR</p>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus placeholder="Scan barcode kartu Vendor..." className={`${inputClass} pl-10`} />
            </div>
            <button type="button" disabled={submitting} onClick={() => runAction('swapToVendor')} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Memproses...' : 'Tukar Kartu'}
            </button>
          </div>
        )}
        {registration.current_card_type === 'vendor' && (
          <div className="rounded-xl bg-accent/10 p-4">
            <p className="mb-2 text-xs font-semibold text-foreground">Kembalikan Kartu VENDOR</p>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus placeholder="Scan barcode kartu Vendor yang dikembalikan..." className={`${inputClass} pl-10`} />
            </div>
            <button type="button" disabled={submitting} onClick={() => runAction('returnVendor')} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Memproses...' : 'Kembalikan ke Kartu Visitor'}
            </button>
          </div>
        )}
        {registration.current_card_type === 'affiliate' && (
          <div className="rounded-xl bg-accent/10 p-4">
            <p className="mb-2 text-xs font-semibold text-foreground">Kembalikan Kartu AFFILIATE</p>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus placeholder="Scan barcode kartu Affiliate yang dikembalikan..." className={`${inputClass} pl-10`} />
            </div>
            <button type="button" disabled={submitting} onClick={() => runAction('returnAffiliate')} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Memproses...' : 'Tutup Pendaftaran'}
            </button>
          </div>
        )}
        {(registration.stage === 'pending_approval' || registration.stage === 'closed') && (
          <p className="text-center text-xs text-muted-foreground">
            {registration.stage === 'pending_approval' ? 'Tamu ini belum di-approve di Pos Security.' : 'Pendaftaran ini sudah selesai.'}
          </p>
        )}
        {error && <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

export function LobbyView() {
  const { adminUser, logout } = useAuth()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Registration | null>(null)
  const [searchBarcode, setSearchBarcode] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [affiliateOpen, setAffiliateOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations?sort=newest`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRegistrations(data.registrations ?? [])
      setListError(null)
    } catch (e) {
      setRegistrations([])
      setListError(e instanceof Error ? e.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    if (!searchBarcode.trim()) return
    setSearchError(null)
    setSearching(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/search?barcode=${encodeURIComponent(searchBarcode.trim())}`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { setSearchError(data.message ?? 'Tidak ditemukan.'); setSelected(null); return }
      setSelected(data.registration)
      setSearchBarcode('')
      searchInputRef.current?.focus()
    } catch {
      setSearchError('Tidak dapat menghubungi server.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-primary px-6 py-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white/15"><ShieldCheck className="size-5" /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/65">PT. Jatim Autocomp Indonesia</p>
            <h1 className="text-lg font-bold">Admin Lobby</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-primary-foreground/75 sm:inline">{adminUser?.username}</span>
          <button onClick={() => logout()} className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-3 py-2 text-xs transition-colors hover:bg-primary-foreground/10">
            <LogOut className="size-4" />Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="portal-eyebrow mb-2">Scan Kartu Tamu</p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input ref={searchInputRef} value={searchBarcode} onChange={(e) => setSearchBarcode(e.target.value)} autoFocus placeholder="Scan atau ketik barcode kartu (Visitor/Vendor/Affiliate)..." className={`${inputClass} pl-10`} />
            </div>
            <button type="submit" disabled={searching} className="rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              Cari
            </button>
          </form>
          {searchError && <p className="mt-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{searchError}</p>}
        </div>

        {selected && (
          <div className="mb-6">
            <DetailPanel registration={selected} onClose={() => setSelected(null)} onChanged={load} />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="portal-eyebrow">Semua Pendaftaran</p>
            <p className="mt-1 text-sm text-muted-foreground">{registrations.length} data</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
              <RotateCcw className="size-3.5" />Muat Ulang
            </button>
            <button type="button" onClick={() => setAffiliateOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
              <UserPlus className="size-4" />Daftarkan Affiliate
            </button>
          </div>
        </div>

        {listError && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{listError}</p>}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-secondary/55">
                <tr>
                  {['Tanggal/Jam', 'Nama Lengkap', 'PIC JAI', 'Keterangan', 'Asal', 'Status'].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
                )}
                {!loading && registrations.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-16 text-center text-sm text-muted-foreground">Belum ada pendaftaran.</td></tr>
                )}
                {registrations.map((r, index) => {
                  const status = statusOf(r)
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer transition-colors hover:bg-secondary/40 ${index % 2 ? 'bg-secondary/20' : ''}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.registered_at)}</td>
                      <td className="min-w-[160px] px-4 py-3 font-medium text-foreground">{r.full_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_jai}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.company_remark}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.entry_path === 'security' ? 'Security' : 'Affiliate'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STAGE_BADGE[status.key]}`}>{status.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {affiliateOpen && <AffiliateModal onClose={() => setAffiliateOpen(false)} onSaved={load} />}
    </div>
  )
}
