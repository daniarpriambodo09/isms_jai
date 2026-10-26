// components/kiosk/SecurityView.tsx
//
// Pos Security: guests are registered here as a Visitor, a Vendor or a
// Supplier (one button each), wait for approval, and get the Security card
// of that kind when approved (scan). The Lobby has its own cards — a guest
// swaps there, and the visit is closed here when the guest hands the
// Security card back. The two posts' cards are different sets, which is
// why this post has its own flow instead of the Lobby's "register + issue a
// card" buttons.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowDownUp, Ban, Briefcase, Camera, Check, Download, KeyRound, LogOut, Pencil, RotateCcw, ScanLine, ShieldAlert, ShieldCheck, Trash2, Truck, Undo2, UserPlus, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ActiveCardsWidget } from '@/components/kiosk/ActiveCardsWidget'
import { ScanCardBox } from '@/components/kiosk/ScanCardBox'
import { KioskThemePicker } from '@/components/kiosk/KioskThemePicker'
import { ReturnCardDialog } from '@/components/kiosk/ReturnCardDialog'
import { CompanionsField, IdStatusBadge, MAX_COMPANIONS, ScheduledGuestsBanner, formatVisitDate, idStatusText, toCompanionInputs, type CompanionInput } from '@/components/kiosk/guest-form-fields'
import { ManualCloseDialog } from '@/components/kiosk/ManualCloseDialog'
import { ChangePasswordModal } from '@/components/change-password-modal'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PhotoVideoRequestsPanel } from '@/components/kiosk/PhotoVideoRequestsPanel'
import { SpecialAreaRequestsPanel } from '@/components/kiosk/SpecialAreaRequestsPanel'
import { downloadExcel } from '@/lib/excel-export'
import { MONTH_LABELS, availableYears, matchesPeriod } from '@/lib/period-filter'
import { CARD_BARCODE_FIELD, SECURITY_CARD_LABEL, SECURITY_CARD_TYPES, formatDateTime, formatTimeParts, holdsSecurityCard, inputClass, labelClass, markScanned, stationOf, useKioskAutoRefresh, usePermitCards, type Registration, type SecurityCardType } from '@/components/kiosk/kiosk-shared'

const SECURITY_CARD_ICON: Record<SecurityCardType, typeof UserPlus> = { visitor: UserPlus, vendor: Briefcase, supplier: Truck }
const SECURITY_CARD_BADGE: Record<SecurityCardType, string> = {
  visitor: 'bg-[#dff5e6] text-[#1a6e3a]',
  vendor: 'bg-[#edf6ff] text-[#1a5fa0]',
  supplier: 'bg-[#e0f5f3] text-[#0f6b63]',
}

type GuestHistory = { full_name: string; id_card: string; company_remark: string; pic_jai: string; visits: number }

// Handles both "Daftarkan …" (new) and "Edit Data" (existing) — same fields
// either way, just POST vs. PUT action=editDetails underneath. cardType: the
// kind the guest is registered as; it can be corrected until the card is out.
function RegisterModal({ cardType: initialCardType = 'visitor', editing, onClose, onSaved }: { cardType?: SecurityCardType; editing?: Registration | null; onClose: () => void; onSaved: () => void }) {
  const [cardType, setCardType] = useState<SecurityCardType>(editing?.security_card_type ?? initialCardType)
  const cardTypeLocked = Boolean(editing) && editing?.stage !== 'pending_approval'
  const title = editing ? 'Edit Data Pendaftaran' : `Pendaftaran ${SECURITY_CARD_LABEL[cardType]}`
  const [fullName, setFullName] = useState(editing?.full_name ?? '')
  const [idCard, setIdCard] = useState(editing?.id_card ?? '')
  const [picJai, setPicJai] = useState(editing?.pic_jai ?? '')
  const [purpose, setPurpose] = useState(editing?.purpose ?? '')
  const [companyRemark, setCompanyRemark] = useState(editing?.company_remark ?? '')
  const [visitDate, setVisitDate] = useState(editing?.visit_date ?? '')
  const [companions, setCompanions] = useState<CompanionInput[]>(toCompanionInputs(editing))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lookup, setLookup] = useState('')
  const [history, setHistory] = useState<GuestHistory[]>([])
  const [savedCompanies, setSavedCompanies] = useState<string[]>([])

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/vendor-registrations/history?q=`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.companies && Array.isArray(data.companies)) {
          setSavedCompanies(data.companies)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (editing || lookup.trim().length < 2) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch(`${API_BASE_PATH}/api/vendor-registrations/history?q=${encodeURIComponent(lookup.trim())}`, { credentials: 'include', signal: ctrl.signal })
        .then((res) => (res.ok ? res.json() : { history: [] }))
        .then((data) => {
          setHistory(data.history ?? [])
          if (data?.companies && Array.isArray(data.companies)) {
            setSavedCompanies((prev) => Array.from(new Set([...prev, ...data.companies])))
          }
        })
        .catch(() => {})
    }, 250)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [lookup, editing])

  const allCompanies = useMemo(() => {
    return Array.from(new Set([...savedCompanies, ...history.map((h) => h.company_remark)])).filter(Boolean)
  }, [savedCompanies, history])

  function onNameChange(value: string) {
    setFullName(value)
    setLookup(value)
    const match = history.find((h) => h.full_name.toLowerCase() === value.toLowerCase())
    if (match && !editing) {
      setIdCard((v) => v || match.id_card)
      setCompanyRemark((v) => v || match.company_remark)
      setPicJai((v) => v || match.pic_jai)
    }
  }

  function onCompanyChange(value: string) {
    setCompanyRemark(value)
    setLookup(value)
    const match = history.find((h) => h.company_remark.toLowerCase() === value.toLowerCase())
    if (match && !editing) {
      setPicJai((v) => v || match.pic_jai)
    }
  }

  useEscapeClose(true, onClose)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = editing
        ? await fetch(`${API_BASE_PATH}/api/vendor-registrations/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ action: 'editDetails', fullName, idCard, picJai, purpose, companyRemark, visitDate, companions, securityCardType: cardType }),
          })
        : await fetch(`${API_BASE_PATH}/api/vendor-registrations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ fullName, idCard, picJai, purpose, companyRemark, visitDate, companions, securityCardType: cardType }),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-[2px] overflow-hidden">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between bg-primary px-6 py-4 text-primary-foreground flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-8 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 overscroll-contain">
            {/* 1. Jenis Kartu */}
            <div role="group" aria-label="Jenis kartu">
              <span className={labelClass}>Jenis Kartu</span>
              <div className="flex flex-wrap gap-1.5">
                {SECURITY_CARD_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={cardType === type}
                    disabled={cardTypeLocked}
                    onClick={() => setCardType(type)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed ${cardType === type ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary disabled:opacity-50'}`}
                  >
                    {SECURITY_CARD_LABEL[type]}
                  </button>
                ))}
              </div>
              {cardTypeLocked && <p className="mt-1.5 text-[11px] text-muted-foreground">Kartu sudah diberikan — jenisnya tidak bisa diubah lagi.</p>}
            </div>

            {/* 2. Nama Perusahaan / Instansi (Paling Atas) */}
            <label className="block">
              <span className={labelClass}>Nama Perusahaan / Instansi</span>
              <input
                value={companyRemark}
                onChange={(e) => onCompanyChange(e.target.value)}
                list="guest-history-companies"
                autoComplete="off"
                required
                placeholder="Ketik atau pilih nama perusahaan..."
                className={inputClass}
              />
              <datalist id="guest-history-companies">
                {allCompanies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-muted-foreground">Perusahaan otomatis tersimpan dan disarankan untuk kunjungan berikutnya.</p>
            </label>

            {/* 3. Data Tamu & KTP + Tombol Tambah Orang langsung di bawahnya */}
            <div className="rounded-xl border border-border/80 bg-secondary/15 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  Identitas Tamu {companions.length > 0 ? `(Tamu Utama + ${companions.length} Rombongan)` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setCompanions([...companions, { name: '', idNo: '' }])}
                  disabled={companions.length >= MAX_COMPANIONS}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                >
                  <UserPlus className="size-3.5" />
                  Tambah Orang
                </button>
              </div>

              <label className="block">
                <span className={labelClass}>Nama Lengkap {companions.length > 0 ? '(Tamu Utama / PIC)' : ''}</span>
                <input
                  value={fullName}
                  onChange={(e) => onNameChange(e.target.value)}
                  list="guest-history-names"
                  autoComplete="off"
                  required
                  autoFocus
                  placeholder="Nama lengkap tamu..."
                  className={inputClass}
                />
                <datalist id="guest-history-names">
                  {history.map((h) => (
                    <option key={`${h.full_name}|${h.id_card}`} value={h.full_name}>
                      {`${h.company_remark} · ${h.visits}x berkunjung`}
                    </option>
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className={labelClass}>Kartu Identitas (KTP/SIM/Paspor)</span>
                <input
                  value={idCard}
                  onChange={(e) => setIdCard(e.target.value)}
                  required
                  placeholder="Nomor identitas (KTP/SIM/Paspor)..."
                  className={inputClass}
                />
              </label>

              {/* Rombongan Tambahan */}
              {companions.length > 0 && (
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    Orang Tambahan (Rombongan, KTP masing-masing):
                  </span>
                  {companions.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-center flex-shrink-0">#{i + 2}</span>
                      <input
                        value={c.name}
                        onChange={(e) => setCompanions(companions.map((comp, idx) => (idx === i ? { ...comp, name: e.target.value } : comp)))}
                        placeholder="Nama"
                        aria-label={`Nama orang tambahan ${i + 1}`}
                        className={inputClass}
                        required
                      />
                      <input
                        value={c.idNo}
                        onChange={(e) => setCompanions(companions.map((comp, idx) => (idx === i ? { ...comp, idNo: e.target.value } : comp)))}
                        placeholder="Nomor KTP"
                        aria-label={`Nomor KTP orang tambahan ${i + 1}`}
                        className={inputClass}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setCompanions(companions.filter((_, j) => j !== i))}
                        aria-label={`Hapus orang tambahan ${i + 1}`}
                        className="grid size-10 flex-shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. PIC JAI yang Ditemui */}
            <label className="block">
              <span className={labelClass}>PIC JAI yang Ditemui</span>
              <input
                value={picJai}
                onChange={(e) => setPicJai(e.target.value)}
                required
                placeholder="Nama PIC atau departemen di JAI..."
                className={inputClass}
              />
            </label>

            {/* 5. Tujuan */}
            <label className="block">
              <span className={labelClass}>Tujuan</span>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                placeholder="Keperluan / tujuan kunjungan..."
                className={inputClass}
              />
            </label>

            {/* 6. Tanggal Kunjungan */}
            <label className="block">
              <span className={labelClass}>Tanggal Kunjungan (opsional, isi jika dijadwalkan)</span>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className={inputClass}
              />
            </label>

            {error && (
              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          {/* Fixed Footer Buttons - Selalu terlihat dan tidak terpotong */}
          <div className="flex-shrink-0 flex gap-3 p-4 sm:px-6 sm:py-4 border-t border-border bg-card/95 backdrop-blur-xs">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              {submitting ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Daftar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Small "scan the physical card" confirmation prompt, reused for both
// Approve (issuing the guest's Security card) and Close (accepting it back).
function ScanPrompt({
  title,
  description,
  submitLabel,
  expectedBarcode,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  submitLabel: string
  expectedBarcode?: string | null
  onClose: () => void
  onSubmit: (barcode: string) => Promise<string | null>
}) {
  const [barcode, setBarcode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // A second read of the same card while the first is on its way is dropped, not glued onto it.
  const submittingRef = useRef(false)

  useEscapeClose(true, onClose)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submittingRef.current) return
    if (!barcode.trim()) { setError('Barcode wajib diisi.'); return }
    setError(null)
    const code = barcode.trim()
    submittingRef.current = true
    setSubmitting(true)
    setBarcode('')
    const message = await onSubmit(code)
    submittingRef.current = false
    setSubmitting(false)
    if (message) setError(message)
  }

  const trimmed = barcode.trim()
  const matches = expectedBarcode ? trimmed === expectedBarcode : null

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
          {expectedBarcode && (
            <div className="rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nomor Kartu Terdaftar</p>
              <p className="font-mono text-sm font-bold tracking-wide text-foreground">{expectedBarcode}</p>
            </div>
          )}
          <div className="relative">
            <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={barcode} onChange={(e) => { if (!submittingRef.current) setBarcode(e.target.value) }} autoFocus placeholder="Scan atau ketik barcode..." className={`${inputClass} pl-10`} />
          </div>
          {expectedBarcode && trimmed && (
            matches
              ? <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Check className="size-3.5" />Nomor kartu cocok</p>
              : <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive"><X className="size-3.5" />Nomor kartu tidak cocok dengan yang terdaftar</p>
          )}
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
  ...SECURITY_CARD_BADGE,
  working: 'bg-[#edf6ff] text-[#1a5fa0]',
  closed: 'bg-secondary text-muted-foreground',
}

function statusOf(r: Registration): { key: string; label: string } {
  if (r.stage === 'pending_approval') return { key: 'pending_approval', label: 'Menunggu Approval' }
  if (r.stage === 'closed') return { key: 'closed', label: r.closed_note ? 'Selesai (Tutup Manual)' : 'Selesai' }
  if (holdsSecurityCard(r)) return { key: r.security_card_type, label: `Kartu ${SECURITY_CARD_LABEL[r.security_card_type]}` }
  // a card the Lobby issued by itself (rows from when this post had the Lobby's buttons)
  if (r.entry_path !== 'security') return { key: 'working', label: 'Kartu Lobby' }
  return { key: 'working', label: 'Di Area Kerja' }
}

export function SecurityView() {
  const { adminUser, logout } = useAuth()
  // A month/year badge elsewhere in the portal (e.g. the Form Aplikasi group
  // header) can deep-link here as ?month=0-11&year=YYYY to land pre-filtered
  // on that period instead of the unfiltered full list.
  const searchParams = useSearchParams()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [formOpen, setFormOpen] = useState<SecurityCardType | null>(null)
  const [photoPermitOpen, setPhotoPermitOpen] = useState(false)
  const [specialAreaPermitOpen, setSpecialAreaPermitOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Registration | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Registration | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // "Tutup Manual": a visit whose card can't be scanned back
  const [manualTarget, setManualTarget] = useState<Registration | null>(null)
  const [scanTarget, setScanTarget] = useState<{ registration: Registration; action: 'approve' | 'close' } | null>(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [idBusy, setIdBusy] = useState<number | null>(null)

  const idAction = async (r: Registration, action: 'verifyId' | 'returnId') => {
    setIdBusy(r.id)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${r.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRegistrations((list) => list.map((x) => (x.id === r.id ? { ...x, ...data.registration } : x)))
      setDeleteError(null)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Gagal memperbarui status KTP.')
    } finally {
      setIdBusy(null)
    }
  }
  // "Pengembalian Kartu ID": a window that only takes this post's cards back
  const [returnOpen, setReturnOpen] = useState(false)
  const [filterMonth, setFilterMonth] = useState(searchParams.get('month') ?? '')
  const [filterYear, setFilterYear] = useState(searchParams.get('year') ?? '')
  const permitCards = usePermitCards()

  // silent = background refresh (no spinner, keeps the current list on a
  // transient error) — see useKioskAutoRefresh.
  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations?sort=${sort}`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      // This post's guests: registered through "Pendaftaran" here, or at this post while it had the Lobby's buttons.
      setRegistrations(((data.registrations ?? []) as Registration[]).filter((r) => r.entry_path === 'security' || stationOf(r) === 'security'))
      setError(null)
    } catch (e) {
      if (silent) return
      setRegistrations([])
      setError(e instanceof Error ? e.message : 'Gagal memuat data.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [sort])

  useEffect(() => { load() }, [load])
  const refreshSilently = useCallback(() => { load({ silent: true }) }, [load])
  useKioskAutoRefresh(refreshSilently)

  const years = useMemo(() => availableYears(registrations, (r) => r.registered_at), [registrations])
  const filteredRegistrations = useMemo(
    () => registrations.filter((r) => matchesPeriod(r.registered_at, filterMonth, filterYear)),
    [registrations, filterMonth, filterYear]
  )

  const handleExportCsv = () => {
    downloadExcel(
      `rekap-tamu-security-${new Date().toISOString().slice(0, 10)}.xlsx`,
      ['Tanggal/Jam', 'Tanggal Kunjungan', 'Jenis', 'Nama Lengkap', 'Orang Tambahan', 'Kartu Identitas', 'Status KTP', 'PIC JAI', 'Tujuan', 'Keterangan', 'Jam Masuk', 'Jam Keluar', 'Status', 'Nomor Kartu Security'],
      filteredRegistrations.map((r) => [
        formatDateTime(r.registered_at),
        r.visit_date ?? '',
        r.entry_path === 'security' ? SECURITY_CARD_LABEL[r.security_card_type] : '',
        r.full_name,
        (r.companions ?? []).map((c) => `${c.name} (${c.id_no})`).join('; '),
        r.id_card,
        idStatusText(r),
        r.pic_jai,
        r.purpose,
        r.company_remark,
        formatDateTime(r.entry_at),
        formatDateTime(r.exit_at),
        statusOf(r).label,
        r.entry_path === 'security' ? (r.security_card_barcode ?? '') : '',
      ])
    )
  }

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
    markScanned(barcode)
    setScanTarget(null)
    load()
    return null
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${pendingDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setDeleteError(data?.message ?? 'Gagal menghapus.'); return }
      setPendingDelete(null)
      load()
    } catch {
      setDeleteError('Tidak dapat menghubungi server.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-primary px-4 py-4 text-primary-foreground sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 flex-shrink-0 place-items-center rounded-xl bg-white/15"><ShieldCheck className="size-5" /></span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/65">PT. Jatim Autocomp Indonesia</p>
            <h1 className="text-lg font-bold leading-tight">Pos Security</h1>
            <p className="hidden text-[11px] text-primary-foreground/70 sm:block">Pendaftaran Visitor / Vendor / Supplier</p>
          </div>
        </div>
        {/* On a phone the two buttons shrink to their icons. */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="hidden text-xs text-primary-foreground/75 sm:inline">{adminUser?.username}</span>
          <KioskThemePicker station="security" />
          <button onClick={() => setPasswordModalOpen(true)} aria-label="Ganti Password" title="Ganti Password" className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-2.5 py-2 text-xs transition-colors hover:bg-primary-foreground/10 sm:px-3">
            <KeyRound className="size-4" /><span className="hidden sm:inline">Ganti Password</span>
          </button>
          <button onClick={() => logout()} aria-label="Logout" title="Logout" className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-2.5 py-2 text-xs transition-colors hover:bg-primary-foreground/10 sm:px-3">
            <LogOut className="size-4" /><span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {/* As at the Lobby, registering comes first: one button per kind of Security card,
            one column on a phone, one row from tablet width up. */}
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Pendaftaran tamu">
          {SECURITY_CARD_TYPES.map((type) => {
            const Icon = SECURITY_CARD_ICON[type]
            return (
              <button key={type} type="button" onClick={() => setFormOpen(type)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5">
                <Icon className="size-4" />Daftarkan {SECURITY_CARD_LABEL[type]}
              </button>
            )
          })}
        </div>
        {/* As at the Lobby: take a card back in its own window, refresh. (Cards are swapped at the Lobby only.) */}
        <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Menu Pos Security">
          <button type="button" onClick={() => setReturnOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary">
            <Undo2 className="size-4" />Pengembalian Kartu ID
          </button>
          <button type="button" onClick={() => load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary">
            <RotateCcw className="size-4" />Refresh
          </button>
        </div>
        {/* The permits are registrations too: right under the registration buttons. */}
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Pengajuan izin">
          <button type="button" onClick={() => setPhotoPermitOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087b9a] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5">
            <Camera className="size-4" />Ajukan Izin Foto/Video
          </button>
          <button type="button" onClick={() => setSpecialAreaPermitOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c7161e] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5">
            <ShieldAlert className="size-4" />Ajukan Izin Area Special
          </button>
        </div>

        {/* Scan a card — a card in use closes that guest's visit, a new one goes to a guest waiting for approval. Right above the list. */}
        <ScanCardBox station="security" onChanged={load} />

        {/* The guest list right under the scan box; the cards in use at the bottom. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="portal-eyebrow">Semua Pendaftaran</p>
            <p className="mt-1 text-sm text-muted-foreground">{filteredRegistrations.length} data</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
              <ArrowDownUp className="size-3.5" />{sort === 'newest' ? 'Urutan Terlama' : 'Urutan Terbaru'}
            </button>
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
          <span className="text-xs text-muted-foreground">{filteredRegistrations.length} data</span>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRegistrations.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-3.5" />Export ke Excel
          </button>
        </div>

        <ScheduledGuestsBanner registrations={registrations} />

        {error && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
        {deleteError && <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{deleteError}</p>}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-secondary/55">
                <tr>
                  {['Tanggal/Jam', 'Jenis', 'Nama Lengkap', 'Kartu Identitas', 'PIC JAI', 'Tujuan', 'Keterangan', 'Jam Masuk', 'Jam Keluar', 'Status', 'Aksi'].map((head) => (
                    <th key={head} className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={11} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
                )}
                {!loading && registrations.length === 0 && (
                  <tr><td colSpan={11} className="px-5 py-16 text-center text-sm text-muted-foreground">Belum ada pendaftaran.</td></tr>
                )}
                {!loading && registrations.length > 0 && filteredRegistrations.length === 0 && (
                  <tr><td colSpan={11} className="px-5 py-16 text-center text-sm text-muted-foreground">Tidak ada data pada periode ini.</td></tr>
                )}
                {filteredRegistrations.map((r, index) => {
                  const status = statusOf(r)
                  return (
                    <tr key={r.id} className={index % 2 ? 'bg-secondary/20' : ''}>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="block text-xs font-medium tabular-nums text-foreground">{formatTimeParts(r.registered_at)?.time}</span>
                        <span className="block text-[10px] text-muted-foreground">{formatTimeParts(r.registered_at)?.date}</span>
                        {r.visit_date && <span className="mt-1 inline-block rounded bg-[#fff3d6] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6100]">Jadwal {formatVisitDate(r.visit_date)}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {r.entry_path === 'security'
                          ? <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${SECURITY_CARD_BADGE[r.security_card_type]}`}>{SECURITY_CARD_LABEL[r.security_card_type]}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="min-w-[160px] px-3 py-3 font-medium text-foreground">
                        {r.full_name}
                        {(r.companions?.length ?? 0) > 0 && (
                          <span className="mt-1 block text-[10px] font-normal text-muted-foreground" title={r.companions?.map((c) => `${c.name} (${c.id_no})`).join(', ')}>
                            + {r.companions?.length} orang: {r.companions?.map((c) => c.name).join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {r.id_card}
                        <IdStatusBadge r={r} />
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{r.pic_jai}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{r.purpose}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{r.company_remark}</td>
                      <td className="whitespace-nowrap px-3 py-3" data-testid="jam-masuk">
                        {(() => {
                          const at = formatTimeParts(r.entry_at)
                          return at
                            ? <><span className="block text-sm font-semibold tabular-nums text-foreground">{at.time}</span><span className="block text-[10px] text-muted-foreground">{at.date}</span></>
                            : <span className="text-xs text-muted-foreground">—</span>
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3" data-testid="jam-keluar">
                        {(() => {
                          const at = formatTimeParts(r.exit_at)
                          return at
                            ? <><span className="block text-sm font-semibold tabular-nums text-foreground">{at.time}</span><span className="block text-[10px] text-muted-foreground">{at.date}</span></>
                            : <span className="text-xs text-muted-foreground">—</span>
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span title={r.closed_note ?? undefined} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STAGE_BADGE[status.key]}`}>{status.label}</span>
                        {r.closed_note && <span className="mt-1 block max-w-[220px] whitespace-normal text-[10px] text-muted-foreground">{r.closed_note}</span>}
                        {r.current_card_type && (
                          <span className="mt-1 block font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                            {r[CARD_BARCODE_FIELD[r.current_card_type]] ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {r.stage !== 'closed' && !r.id_verified_at && (
                            <button type="button" disabled={idBusy === r.id} onClick={() => idAction(r, 'verifyId')} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50">
                              <Check className="size-3.5" />Verifikasi KTP
                            </button>
                          )}
                          {r.id_verified_at && !r.id_returned_at && (
                            <button type="button" disabled={idBusy === r.id} onClick={() => idAction(r, 'returnId')} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50">
                              <Undo2 className="size-3.5" />KTP Dikembalikan
                            </button>
                          )}
                          {r.stage === 'pending_approval' && (
                            <button type="button" onClick={() => setScanTarget({ registration: r, action: 'approve' })} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
                              <ScanLine className="size-3.5" />Approve
                            </button>
                          )}
                          {holdsSecurityCard(r) && (
                            <button type="button" onClick={() => setScanTarget({ registration: r, action: 'close' })} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary">
                              <ScanLine className="size-3.5" />Kartu Dikembalikan
                            </button>
                          )}
                          {r.stage === 'active' && r.current_card_type && !holdsSecurityCard(r) && (
                            <span className="whitespace-nowrap rounded-md bg-secondary/60 px-2 py-1 text-[11px] font-medium text-muted-foreground" title={r.entry_path === 'security' ? 'Tamu masih memegang kartu Lobby — kartu harus ditukar kembali ke kartu Security di Lobby sebelum bisa ditutup di sini' : 'Kartu ini diterbitkan langsung (bukan lewat Pendaftaran) — kunjungannya ditutup di Lobby'}>
                              {r.entry_path === 'security' ? 'Tukar kartu di Lobby dulu' : 'Tutup di Lobby'}
                            </span>
                          )}
                          {r.stage !== 'closed' && (
                            <button type="button" onClick={() => setManualTarget(r)} aria-label={`Tutup manual ${r.full_name}`} title="Tutup Manual — kartu hilang / tidak bisa di-scan" className="grid size-8 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                              <Ban className="size-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => setEditTarget(r)} aria-label={`Edit data ${r.full_name}`} title="Edit data" className="grid size-8 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                            <Pencil className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => setPendingDelete(r)} aria-label={`Hapus pendaftaran ${r.full_name}`} title="Hapus pendaftaran" className="grid size-8 flex-shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8">
          <ActiveCardsWidget registrations={registrations} cardTypes={['visitor', 'vendor', 'supplier', 'special_area', 'photography']} permitCards={permitCards} />
        </div>

        <section className="mt-8" aria-label="Rekap dan izin">
          <div className="mb-3">
            <p className="portal-eyebrow">Rekap &amp; Izin</p>
            <p className="mt-1 text-sm text-muted-foreground">Pantau pengajuan izin foto/video dan area special.</p>
          </div>
          <PhotoVideoRequestsPanel canSubmit={false} formOpen={photoPermitOpen} onFormOpenChange={setPhotoPermitOpen} />
          <SpecialAreaRequestsPanel canSubmit={false} formOpen={specialAreaPermitOpen} onFormOpenChange={setSpecialAreaPermitOpen} />
        </section>
      </main>

      {formOpen && <RegisterModal cardType={formOpen} onClose={() => setFormOpen(null)} onSaved={load} />}
      {editTarget && <RegisterModal editing={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />}
      {passwordModalOpen && <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />}
      {manualTarget && <ManualCloseDialog registration={manualTarget} onClose={() => setManualTarget(null)} onDone={() => { setManualTarget(null); load() }} />}
      {returnOpen && <ReturnCardDialog station="security" registrations={registrations} onClose={() => setReturnOpen(false)} onChanged={load} />}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus pendaftaran?"
        message={pendingDelete ? `Data pendaftaran "${pendingDelete.full_name}" akan dihapus permanen dan tidak bisa dikembalikan.` : ''}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { setPendingDelete(null); setDeleteError(null) }}
      />
      {scanTarget && (() => {
        const kind = SECURITY_CARD_LABEL[scanTarget.registration.security_card_type]
        return (
        <ScanPrompt
          title={scanTarget.action === 'approve' ? `Approve — Scan Kartu ${kind}` : `Scan Kartu ${kind} yang Dikembalikan`}
          description={scanTarget.action === 'approve'
            ? `Scan barcode kartu ${kind.toUpperCase()} yang akan diberikan kepada ${scanTarget.registration.full_name}.`
            : `Scan barcode kartu ${kind.toUpperCase()} yang dikembalikan oleh ${scanTarget.registration.full_name}.`}
          submitLabel={scanTarget.action === 'approve' ? 'Approve' : 'Tutup Pendaftaran'}
          expectedBarcode={scanTarget.action === 'close' ? scanTarget.registration.security_card_barcode : null}
          onClose={() => setScanTarget(null)}
          onSubmit={handleScanSubmit}
        />
        )
      })()}
    </div>
  )
}
