'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { Briefcase, Camera, Check, Download, KeyRound, LogOut, Pencil, RotateCcw, ScanLine, ShieldAlert, ShieldCheck, Search, Sparkles, Trash2, UserPlus, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ActiveCardsWidget } from '@/components/kiosk/ActiveCardsWidget'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ChangePasswordModal } from '@/components/change-password-modal'
import { PhotoVideoRequestsPanel } from '@/components/kiosk/PhotoVideoRequestsPanel'
import { downloadExcel } from '@/lib/excel-export'
import { MONTH_LABELS, availableYears, matchesPeriod } from '@/lib/period-filter'
import { CARD_BARCODE_FIELD, formatDateTime, inputClass, labelClass, type Registration } from '@/components/kiosk/kiosk-shared'

type WorkAreaCardType = 'vendor' | 'special_area' | 'photography'

const WORK_AREA_TYPES: WorkAreaCardType[] = ['vendor', 'special_area', 'photography']
const WORK_AREA_LABEL: Record<WorkAreaCardType, string> = {
  vendor: 'VENDOR',
  special_area: 'SPECIAL AREA',
  photography: 'PHOTOGRAPHY',
}
const WORK_AREA_COLUMN: Record<WorkAreaCardType, 'vendor_card_barcode' | 'special_area_card_barcode' | 'photography_card_barcode'> = {
  vendor: 'vendor_card_barcode',
  special_area: 'special_area_card_barcode',
  photography: 'photography_card_barcode',
}

// The five card types Lobby can issue directly, skipping Security's
// pending-approval flow entirely — Affiliate was the original one-off;
// this generalizes the same "register + hand over the card right now"
// pattern to Visitor, Vendor, Special Area and Photography too.
type QuickCardType = 'visitor' | 'vendor' | 'special_area' | 'photography' | 'affiliate'
const QUICK_CARD_TYPES: QuickCardType[] = ['visitor', 'vendor', 'special_area', 'photography', 'affiliate']
const QUICK_CARD_LABEL: Record<QuickCardType, string> = {
  visitor: 'Visitor',
  vendor: 'Vendor',
  special_area: 'Special Area',
  photography: 'Photography',
  affiliate: 'Affiliate',
}
const QUICK_CARD_ICON: Record<QuickCardType, typeof UserPlus> = {
  visitor: UserPlus,
  vendor: Briefcase,
  special_area: ShieldAlert,
  photography: Camera,
  affiliate: Sparkles,
}

const STAGE_BADGE: Record<string, string> = {
  pending_approval: 'bg-[#fff3d6] text-[#8a6100]',
  visitor: 'bg-[#dff5e6] text-[#1a6e3a]',
  vendor: 'bg-[#edf6ff] text-[#1a5fa0]',
  affiliate: 'bg-[#f7f0ff] text-[#6a30a0]',
  special_area: 'bg-[#fde2e2] text-[#a13030]',
  photography: 'bg-[#fff3d6] text-[#8a6100]',
  closed: 'bg-secondary text-muted-foreground',
}
const CARD_LABEL: Record<WorkAreaCardType | 'affiliate', string> = {
  vendor: 'Kartu Vendor',
  special_area: 'Kartu Special Area',
  photography: 'Kartu Photography',
  affiliate: 'Kartu Affiliate',
}
function statusOf(r: Registration): { key: string; label: string } {
  if (r.stage === 'pending_approval') return { key: 'pending_approval', label: 'Menunggu Approval Security' }
  if (r.stage === 'closed') return { key: 'closed', label: 'Selesai' }
  if (r.current_card_type && r.current_card_type in CARD_LABEL) {
    return { key: r.current_card_type, label: CARD_LABEL[r.current_card_type as WorkAreaCardType | 'affiliate'] }
  }
  return { key: 'visitor', label: 'Kartu Visitor' }
}

function QuickCardModal({ cardType, onClose, onSaved }: { cardType: QuickCardType; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [picJai, setPicJai] = useState('')
  const [purpose, setPurpose] = useState('')
  const [companyRemark, setCompanyRemark] = useState('')
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const label = QUICK_CARD_LABEL[cardType]

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
        body: JSON.stringify({ fullName, idCard, picJai, purpose, companyRemark, cardType, barcode }),
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
      <div role="dialog" aria-modal="true" aria-label={`Daftarkan Tamu ${label}`} className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <h2 className="text-lg font-bold">Daftarkan Tamu {label}</h2>
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
            <span className={labelClass}>Barcode Kartu {label}</span>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} required placeholder="Scan atau ketik barcode..." className={`${inputClass} pl-10`} />
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
  const [swapTarget, setSwapTarget] = useState<WorkAreaCardType>('vendor')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editFullName, setEditFullName] = useState(registration.full_name)
  const [editIdCard, setEditIdCard] = useState(registration.id_card)
  const [editPicJai, setEditPicJai] = useState(registration.pic_jai)
  const [editPurpose, setEditPurpose] = useState(registration.purpose)
  const [editCompanyRemark, setEditCompanyRemark] = useState(registration.company_remark)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const status = statusOf(registration)

  const runAction = async (action: 'swapToWorkArea' | 'returnWorkArea' | 'returnDirect', cardType?: WorkAreaCardType) => {
    if (!barcode.trim()) { setError('Barcode wajib diisi.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${registration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, barcode: barcode.trim(), ...(cardType ? { cardType } : {}) }),
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

  const startEdit = () => {
    setEditFullName(registration.full_name)
    setEditIdCard(registration.id_card)
    setEditPicJai(registration.pic_jai)
    setEditPurpose(registration.purpose)
    setEditCompanyRemark(registration.company_remark)
    setEditError(null)
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!editFullName.trim() || !editIdCard.trim() || !editPicJai.trim() || !editPurpose.trim() || !editCompanyRemark.trim()) {
      setEditError('Semua field wajib diisi.')
      return
    }
    setEditError(null)
    setEditSaving(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${registration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'editDetails',
          fullName: editFullName.trim(),
          idCard: editIdCard.trim(),
          picJai: editPicJai.trim(),
          purpose: editPurpose.trim(),
          companyRemark: editCompanyRemark.trim(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setEditError(data?.message ?? 'Gagal menyimpan perubahan.'); return }
      setEditing(false)
      onChanged()
    } catch {
      setEditError('Tidak dapat menghubungi server.')
    } finally {
      setEditSaving(false)
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
        <div className="flex items-center gap-1">
          {!editing && (
            <button type="button" onClick={startEdit} aria-label="Edit data tamu" title="Edit data tamu" className="grid size-7 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
              <Pencil className="size-3.5" />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-7 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 p-4">
          <label>
            <span className={labelClass}>Nama Lengkap</span>
            <input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} autoFocus className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Kartu Identitas</span>
            <input value={editIdCard} onChange={(e) => setEditIdCard(e.target.value)} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>PIC JAI</span>
            <input value={editPicJai} onChange={(e) => setEditPicJai(e.target.value)} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Tujuan</span>
            <input value={editPurpose} onChange={(e) => setEditPurpose(e.target.value)} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Keterangan</span>
            <input value={editCompanyRemark} onChange={(e) => setEditCompanyRemark(e.target.value)} className={inputClass} />
          </label>
          {editError && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">{editError}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-border bg-card py-2 text-sm font-medium text-foreground transition hover:bg-secondary">Batal</button>
            <button type="button" disabled={editSaving} onClick={saveEdit} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              <Check className="size-4" />{editSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {row('PIC JAI :', registration.pic_jai)}
          {row('Tujuan :', registration.purpose)}
          {row('Keterangan :', registration.company_remark)}
          {row('Status :', status.label)}
        </>
      )}

      <div className="p-4">
        {registration.current_card_type === 'visitor' && (
          <div className="rounded-xl bg-accent/10 p-4">
            <p className="mb-2 text-xs font-semibold text-foreground">Tukar ke Kartu Area Kerja</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {WORK_AREA_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSwapTarget(type)}
                  className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all"
                  style={
                    swapTarget === type
                      ? { background: 'linear-gradient(135deg, #1a5f7a, #278e84)', color: 'white', borderColor: 'transparent' }
                      : { background: 'transparent', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
                  }
                >
                  {WORK_AREA_LABEL[type]}
                </button>
              ))}
            </div>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus placeholder={`Scan barcode kartu ${WORK_AREA_LABEL[swapTarget]}...`} className={`${inputClass} pl-10`} />
            </div>
            <button type="button" disabled={submitting} onClick={() => runAction('swapToWorkArea', swapTarget)} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Memproses...' : 'Tukar Kartu'}
            </button>
          </div>
        )}
        {registration.current_card_type === 'visitor' && registration.entry_path !== 'security' && (() => {
          const trimmed = barcode.trim()
          const matches = trimmed ? trimmed === registration.visitor_card_barcode : null
          return (
            <div className="mt-4 rounded-xl bg-accent/10 p-4">
              <p className="mb-2 text-xs font-semibold text-foreground">Kembalikan Kartu VISITOR</p>
              {registration.visitor_card_barcode && (
                <div className="mb-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nomor Kartu Terdaftar</p>
                  <p className="font-mono text-sm font-bold tracking-wide text-foreground">{registration.visitor_card_barcode}</p>
                </div>
              )}
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan barcode kartu Visitor yang dikembalikan..." className={`${inputClass} pl-10`} />
              </div>
              {trimmed && (
                matches
                  ? <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Check className="size-3.5" />Nomor kartu cocok</p>
                  : <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive"><X className="size-3.5" />Nomor kartu tidak cocok dengan yang terdaftar</p>
              )}
              <button type="button" disabled={submitting} onClick={() => runAction('returnDirect')} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Memproses...' : 'Tutup Pendaftaran'}
              </button>
            </div>
          )
        })()}
        {registration.current_card_type && WORK_AREA_TYPES.includes(registration.current_card_type as WorkAreaCardType) && (() => {
          const cardType = registration.current_card_type as WorkAreaCardType
          const expected = registration[WORK_AREA_COLUMN[cardType]]
          const trimmed = barcode.trim()
          const matches = trimmed ? trimmed === expected : null
          return (
            <div className="rounded-xl bg-accent/10 p-4">
              <p className="mb-2 text-xs font-semibold text-foreground">
                Kembalikan Kartu {WORK_AREA_LABEL[cardType]}
              </p>
              {expected && (
                <div className="mb-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nomor Kartu Terdaftar</p>
                  <p className="font-mono text-sm font-bold tracking-wide text-foreground">{expected}</p>
                </div>
              )}
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus placeholder="Scan barcode kartu yang dikembalikan..." className={`${inputClass} pl-10`} />
              </div>
              {trimmed && (
                matches
                  ? <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Check className="size-3.5" />Nomor kartu cocok</p>
                  : <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive"><X className="size-3.5" />Nomor kartu tidak cocok dengan yang terdaftar</p>
              )}
              <button type="button" disabled={submitting} onClick={() => runAction('returnWorkArea')} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Memproses...' : registration.entry_path === 'security' ? 'Kembalikan ke Kartu Visitor' : 'Tutup Pendaftaran'}
              </button>
            </div>
          )
        })()}
        {registration.current_card_type === 'affiliate' && (() => {
          const trimmed = barcode.trim()
          const matches = trimmed ? trimmed === registration.affiliate_card_barcode : null
          return (
            <div className="rounded-xl bg-accent/10 p-4">
              <p className="mb-2 text-xs font-semibold text-foreground">Kembalikan Kartu AFFILIATE</p>
              {registration.affiliate_card_barcode && (
                <div className="mb-3 rounded-xl border border-border bg-card px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nomor Kartu Terdaftar</p>
                  <p className="font-mono text-sm font-bold tracking-wide text-foreground">{registration.affiliate_card_barcode}</p>
                </div>
              )}
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} autoFocus placeholder="Scan barcode kartu Affiliate yang dikembalikan..." className={`${inputClass} pl-10`} />
              </div>
              {trimmed && (
                matches
                  ? <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Check className="size-3.5" />Nomor kartu cocok</p>
                  : <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive"><X className="size-3.5" />Nomor kartu tidak cocok dengan yang terdaftar</p>
              )}
              <button type="button" disabled={submitting} onClick={() => runAction('returnDirect')} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Memproses...' : 'Tutup Pendaftaran'}
              </button>
            </div>
          )
        })()}
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
  // A month/year badge elsewhere in the portal (e.g. the Form Aplikasi group
  // header) can deep-link here as ?month=0-11&year=YYYY to land pre-filtered
  // on that period instead of the unfiltered full list.
  const searchParams = useSearchParams()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Registration | null>(null)
  const [searchBarcode, setSearchBarcode] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [quickCardOpen, setQuickCardOpen] = useState<QuickCardType | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Registration | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [tableQuery, setTableQuery] = useState('')
  const [filterMonth, setFilterMonth] = useState(searchParams.get('month') ?? '')
  const [filterYear, setFilterYear] = useState(searchParams.get('year') ?? '')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
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

  const years = useMemo(() => availableYears(registrations, (r) => r.registered_at), [registrations])
  const filteredRegistrations = useMemo(() => {
    const value = tableQuery.trim().toLowerCase()
    return registrations.filter((r) => {
      if (!matchesPeriod(r.registered_at, filterMonth, filterYear)) return false
      if (!value) return true
      return (
        r.full_name.toLowerCase().includes(value) ||
        r.pic_jai.toLowerCase().includes(value) ||
        r.company_remark.toLowerCase().includes(value)
      )
    })
  }, [registrations, tableQuery, filterMonth, filterYear])

  const handleExportCsv = () => {
    downloadExcel(
      `rekap-tamu-lobby-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['Tanggal/Jam', 'Nama Lengkap', 'PIC JAI', 'Keterangan', 'Asal', 'Status', 'Nomor Kartu', 'Jam Masuk', 'Jam Keluar'],
      filteredRegistrations.map((r) => [
        formatDateTime(r.registered_at),
        r.full_name,
        r.pic_jai,
        r.company_remark,
        r.entry_path === 'security' ? 'Security' : 'Lobby',
        statusOf(r).label,
        r.current_card_type ? (r[CARD_BARCODE_FIELD[r.current_card_type]] ?? '') : '',
        formatDateTime(r.entry_at),
        formatDateTime(r.exit_at),
      ])
    )
  }

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

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${pendingDelete.id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setListError(data?.message ?? 'Gagal menghapus pendaftaran.')
        setDeleting(false)
        setPendingDelete(null)
        return
      }
      if (selected?.id === pendingDelete.id) setSelected(null)
      await load()
    } catch {
      setListError('Tidak dapat menghubungi server.')
    }
    setDeleting(false)
    setPendingDelete(null)
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const allVisibleSelected = filteredRegistrations.length > 0 && filteredRegistrations.every((r) => selectedIds.has(r.id))
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        filteredRegistrations.forEach((r) => next.delete(r.id))
        return next
      }
      const next = new Set(prev)
      filteredRegistrations.forEach((r) => next.add(r.id))
      return next
    })
  }

  const confirmBulkDelete = async () => {
    setBulkDeleting(true)
    const ids = Array.from(selectedIds)
    const results = await Promise.all(ids.map((id) => fetch(`${API_BASE_PATH}/api/vendor-registrations/${id}`, { method: 'DELETE', credentials: 'include' })))
    const failed = results.filter((r) => !r.ok).length
    if (failed > 0) setListError(`${failed} dari ${ids.length} pendaftaran gagal dihapus.`)
    if (selected && selectedIds.has(selected.id)) setSelected(null)
    setSelectedIds(new Set())
    await load()
    setBulkDeleting(false)
    setBulkDeleteOpen(false)
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
          <button onClick={() => setPasswordModalOpen(true)} className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-3 py-2 text-xs transition-colors hover:bg-primary-foreground/10">
            <KeyRound className="size-4" />Ganti Password
          </button>
          <button onClick={() => logout()} className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-3 py-2 text-xs transition-colors hover:bg-primary-foreground/10">
            <LogOut className="size-4" />Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <ActiveCardsWidget registrations={registrations} cardTypes={['visitor', 'vendor', 'special_area', 'photography', 'affiliate']} />
        <PhotoVideoRequestsPanel />

        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="portal-eyebrow mb-2">Scan Kartu Tamu</p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input ref={searchInputRef} value={searchBarcode} onChange={(e) => setSearchBarcode(e.target.value)} autoFocus placeholder="Scan atau ketik barcode kartu tamu..." className={`${inputClass} pl-10`} />
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
            <p className="mt-1 text-sm text-muted-foreground">{filteredRegistrations.length} data</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
              <RotateCcw className="size-3.5" />Muat Ulang
            </button>
            {QUICK_CARD_TYPES.map((type) => {
              const Icon = QUICK_CARD_ICON[type]
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setQuickCardOpen(type)}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <Icon className="size-4" />Daftarkan {QUICK_CARD_LABEL[type]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20">
            <option value="">Semua Bulan</option>
            {MONTH_LABELS.map((label, i) => <option key={label} value={i}>{label}</option>)}
          </select>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20">
            <option value="">Semua Tahun</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {(filterMonth || filterYear) && (
            <button type="button" onClick={() => { setFilterMonth(''); setFilterYear('') }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary">
              Reset Filter
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRegistrations.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-3.5" />Export ke Excel
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={tableQuery}
              onChange={(e) => setTableQuery(e.target.value)}
              placeholder="Cari nama, PIC JAI, atau keterangan..."
              className={`${inputClass} pl-10`}
            />
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
              <span className="text-xs font-semibold text-foreground">{selectedIds.size} terpilih</span>
              <button type="button" onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition hover:opacity-90">
                <Trash2 className="size-3.5" />Hapus Terpilih
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())} aria-label="Batal pilih" className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary">
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>

        {listError && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{listError}</p>}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-secondary/55">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} onClick={(e) => e.stopPropagation()} aria-label="Pilih semua" className="size-4 rounded border-border" />
                  </th>
                  {['Tanggal/Jam', 'Nama Lengkap', 'PIC JAI', 'Keterangan', 'Asal', 'Status', 'Aksi'].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={8} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
                )}
                {!loading && registrations.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-muted-foreground">Belum ada pendaftaran.</td></tr>
                )}
                {!loading && registrations.length > 0 && filteredRegistrations.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-16 text-center text-sm text-muted-foreground">Tidak ada yang cocok dengan pencarian.</td></tr>
                )}
                {filteredRegistrations.map((r, index) => {
                  const status = statusOf(r)
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer transition-colors hover:bg-secondary/40 ${index % 2 ? 'bg-secondary/20' : ''}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Pilih ${r.full_name}`} className="size-4 rounded border-border" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.registered_at)}</td>
                      <td className="min-w-[160px] px-4 py-3 font-medium text-foreground">{r.full_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_jai}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.company_remark}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.entry_path === 'security' ? 'Security' : 'Lobby'}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STAGE_BADGE[status.key]}`}>{status.label}</span>
                        {r.current_card_type && (
                          <span className="mt-1 block font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                            {r[CARD_BARCODE_FIELD[r.current_card_type]] ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setPendingDelete(r) }}
                          aria-label={`Hapus pendaftaran ${r.full_name}`}
                          title="Hapus pendaftaran"
                          className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {quickCardOpen && <QuickCardModal cardType={quickCardOpen} onClose={() => setQuickCardOpen(null)} onSaved={load} />}
      {passwordModalOpen && <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus pendaftaran?"
        message={
          pendingDelete?.stage === 'active'
            ? `Pendaftaran "${pendingDelete?.full_name}" akan dihapus permanen — tamu ini masih memegang kartu fisik yang belum dikembalikan. Pastikan kartunya sudah kembali sebelum menghapus.`
            : `Pendaftaran "${pendingDelete?.full_name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
        }
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        title="Hapus pendaftaran terpilih?"
        message={`${selectedIds.size} pendaftaran akan dihapus permanen. Pastikan tidak ada tamu yang masih memegang kartu fisik dari pendaftaran yang dipilih. Tindakan ini tidak dapat dibatalkan.`}
        pending={bulkDeleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  )
}
