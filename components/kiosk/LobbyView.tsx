'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { Briefcase, Camera, Check, Download, KeyRound, LogOut, Pencil, ListChecks, RotateCcw, ScanLine, ShieldAlert, ShieldCheck, Search, Sparkles, Trash2, Undo2, UserPlus, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ActiveCardsWidget } from '@/components/kiosk/ActiveCardsWidget'
import { ScanCardBox } from '@/components/kiosk/ScanCardBox'
import { ReturnCardDialog } from '@/components/kiosk/ReturnCardDialog'
import { CallRecordDialog } from '@/components/kiosk/CallRecordDialog'
import { ManualCloseDialog } from '@/components/kiosk/ManualCloseDialog'
import { lobbyCardProblem, lobbyCardRangeText, type LobbyCardKind } from '@/lib/card-ranges'
import { KioskThemePicker } from '@/components/kiosk/KioskThemePicker'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ChangePasswordModal } from '@/components/change-password-modal'
import { PhotoVideoRequestsPanel } from '@/components/kiosk/PhotoVideoRequestsPanel'
import { SpecialAreaRequestsPanel } from '@/components/kiosk/SpecialAreaRequestsPanel'
import { Pagination } from '@/components/pagination'
import { CompanionsField, IdStatusBadge, MAX_COMPANIONS, ScheduledGuestsBanner, detectIdType, extractIdNumber, formatIdCardValue, formatVisitDate, idStatusText, toCompanionInputs, validateGuestId, type CompanionInput, type IdType } from '@/components/kiosk/guest-form-fields'
import { downloadExcel } from '@/lib/excel-export'
import { MONTH_LABELS } from '@/lib/period-filter'
import { CARD_BARCODE_FIELD, SECURITY_CARD_LABEL, formatDateTime, formatTimeParts, holdsSecurityCard, isRepeatScan, markScanned, stationOf, inputClass, labelClass, useKioskAutoRefresh, usePermitCards, type Registration } from '@/components/kiosk/kiosk-shared'

// A card the Lobby takes back: the two it swaps into (Visitor, Vendor) and, on
// older rows, a Special Area or Photography card.
type WorkAreaCardType = 'visitor' | 'vendor' | 'special_area' | 'photography'
// "Tukar ke Kartu Area Kerja": Special Area and Photography are not offered —
// those cards go out with their permit (panels above), which lists them under
// "Kartu Sedang Digunakan" by itself.
type SwapCardType = 'visitor' | 'vendor'
const SWAP_TYPES: SwapCardType[] = ['visitor', 'vendor']

const WORK_AREA_LABEL: Record<WorkAreaCardType, string> = {
  visitor: 'VISITOR',
  vendor: 'VENDOR',
  special_area: 'SPECIAL AREA',
  photography: 'PHOTOGRAPHY',
}
const WORK_AREA_COLUMN: Record<WorkAreaCardType, 'visitor_card_barcode' | 'vendor_card_barcode' | 'special_area_card_barcode' | 'photography_card_barcode'> = {
  visitor: 'visitor_card_barcode',
  vendor: 'vendor_card_barcode',
  special_area: 'special_area_card_barcode',
  photography: 'photography_card_barcode',
}

// The five card types Lobby can issue directly, skipping Security's
// pending-approval flow entirely — Affiliate was the original one-off;
// this generalizes the same "register + hand over the card right now"
// pattern to Visitor, Vendor, Special Area and Photography too.
type QuickCardType = 'visitor' | 'vendor' | 'special_area' | 'photography' | 'affiliate'
// "Daftarkan …" buttons. Special Area and Photography have none: they go
// through their own cards above (Ajukan Izin Area Special / Ajukan Izin
// Foto/Video), so a second button here would be a duplicate.
const QUICK_REGISTER_TYPES: QuickCardType[] = ['visitor', 'vendor', 'affiliate']
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

type RegistrationContext = 'all' | 'lobby' | 'waiting_security' | 'holding_lobby' | 'closed'
const REGISTRATION_CONTEXTS: { value: RegistrationContext; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'lobby', label: 'Pendaftaran Lobby' },
  { value: 'waiting_security', label: 'Menunggu dari Security' },
  { value: 'holding_lobby', label: 'Sedang memakai kartu Lobby' },
  { value: 'closed', label: 'Kunjungan selesai' },
]

const STAGE_BADGE: Record<string, string> = {
  pending_approval: 'bg-[#fff3d6] text-[#8a6100]',
  visitor: 'bg-[#dff5e6] text-[#1a6e3a]',
  vendor: 'bg-[#edf6ff] text-[#1a5fa0]',
  supplier: 'bg-[#e0f5f3] text-[#0f6b63]',
  affiliate: 'bg-[#f7f0ff] text-[#6a30a0]',
  special_area: 'bg-[#fde2e2] text-[#a13030]',
  photography: 'bg-[#fff3d6] text-[#8a6100]',
  closed: 'bg-secondary text-muted-foreground',
}
const CARD_LABEL: Record<WorkAreaCardType | 'affiliate', string> = {
  visitor: 'Kartu Visitor',
  vendor: 'Kartu Vendor',
  special_area: 'Kartu Special Area',
  photography: 'Kartu Photography',
  affiliate: 'Kartu Affiliate',
}
function statusOf(r: Registration): { key: string; label: string } {
  if (r.stage === 'pending_approval') return { key: 'pending_approval', label: 'Menunggu Approval Security' }
  if (r.stage === 'closed') return { key: 'closed', label: r.closed_note ? 'Selesai (Tutup Manual)' : 'Selesai' }
  // still on the card Pos Security handed out (Visitor, Vendor or Supplier)
  if (holdsSecurityCard(r)) return { key: r.security_card_type, label: `Kartu ${SECURITY_CARD_LABEL[r.security_card_type]} (Security)` }
  if (r.current_card_type && r.current_card_type in CARD_LABEL) {
    return { key: r.current_card_type, label: CARD_LABEL[r.current_card_type as WorkAreaCardType | 'affiliate'] }
  }
  return { key: 'visitor', label: 'Kartu Visitor' }
}

type GuestHistory = { full_name: string; id_card: string; company_remark: string; pic_jai: string; visits: number }

function QuickCardModal({ cardType, station, initialBarcode = '', onClose, onSaved }: { cardType: QuickCardType; station: 'lobby' | 'security'; initialBarcode?: string; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState('')
  const [mainIdType, setMainIdType] = useState<IdType>('ktp')
  const [mainIdNo, setMainIdNo] = useState('')
  const [picJai, setPicJai] = useState('')
  const [purpose, setPurpose] = useState('')
  const [companyRemark, setCompanyRemark] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [companions, setCompanions] = useState<Array<{ name: string; idNo: string; idType: IdType }>>([])
  const [barcode, setBarcode] = useState(initialBarcode)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
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
    if (fullName.trim().length < 2) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch(`${API_BASE_PATH}/api/vendor-registrations/history?q=${encodeURIComponent(fullName.trim())}`, { credentials: 'include', signal: ctrl.signal })
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
  }, [fullName])

  const allCompanies = Array.from(new Set([...savedCompanies, ...history.map((h) => h.company_remark)])).filter(Boolean)
  const label = QUICK_CARD_LABEL[cardType]
  // At the Lobby each kind of card has its own numbers (lib/card-ranges.ts).
  const cardProblem = station === 'lobby' && barcode.trim() ? lobbyCardProblem(barcode, cardType as LobbyCardKind) : null
  // Affiliate guests are registered without an identity card or PIC JAI.
  const isAffiliate = cardType === 'affiliate'

  function onNameChange(value: string) {
    setFullName(value)
    const match = history.find((h) => h.full_name.toLowerCase() === value.toLowerCase())
    if (match) {
      if (!mainIdNo && !isAffiliate) {
        setMainIdType(detectIdType(match.id_card))
        setMainIdNo(extractIdNumber(match.id_card))
      }
      if (!picJai && !isAffiliate) setPicJai(match.pic_jai)
      if (!companyRemark) setCompanyRemark(match.company_remark)
    }
  }

  function handleMainIdChange(val: string) {
    if (mainIdType === 'ktp' || mainIdType === 'sim') {
      const digits = val.replace(/\D/g, '')
      setMainIdNo(mainIdType === 'ktp' ? digits.slice(0, 16) : digits.slice(0, 16))
    } else {
      setMainIdNo(val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toUpperCase())
    }
  }

  function handleMainIdTypeChange(type: IdType) {
    setMainIdType(type)
    if (type === 'ktp' || type === 'sim') {
      setMainIdNo((v) => v.replace(/\D/g, '').slice(0, 16))
    }
  }

  function handleCompanionIdChange(index: number, val: string) {
    setCompanions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c
        let cleaned = val
        if (c.idType === 'ktp' || c.idType === 'sim') {
          const digits = val.replace(/\D/g, '')
          cleaned = c.idType === 'ktp' ? digits.slice(0, 16) : digits.slice(0, 16)
        } else {
          cleaned = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15).toUpperCase()
        }
        return { ...c, idNo: cleaned }
      })
    )
  }

  function handleCompanionIdTypeChange(index: number, type: IdType) {
    setCompanions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c
        let cleaned = c.idNo
        if (type === 'ktp' || type === 'sim') cleaned = cleaned.replace(/\D/g, '').slice(0, 16)
        return { ...c, idType: type, idNo: cleaned }
      })
    )
  }

  useEscapeClose(true, onClose)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    // Validasi Tamu Utama
    if (!fullName.trim()) {
      setError('Nama lengkap Tamu Utama wajib diisi.')
      return
    }
    if (!isAffiliate) {
      const mainIdErr = validateGuestId(mainIdType, mainIdNo, 'Tamu Utama')
      if (mainIdErr) {
        setError(mainIdErr)
        return
      }
      if (!picJai.trim()) {
        setError('PIC JAI yang ditemui wajib diisi.')
        return
      }
    }

    // Validasi Rombongan
    for (let i = 0; i < companions.length; i++) {
      const c = companions[i]
      if (!c.name.trim()) {
        setError(`Nama lengkap Anggota Rombongan #${i + 2} wajib diisi.`)
        return
      }
      const compIdErr = validateGuestId(c.idType, c.idNo, `Anggota Rombongan #${i + 2}`)
      if (compIdErr) {
        setError(compIdErr)
        return
      }
    }

    // Deteksi Identitas Duplikat dalam Rombongan
    if (!isAffiliate || companions.length > 0) {
      const allFormatted = [
        ...(!isAffiliate ? [{ who: 'Tamu Utama', val: formatIdCardValue(mainIdType, mainIdNo) }] : []),
        ...companions.map((c, i) => ({ who: `Anggota Rombongan #${i + 2}`, val: formatIdCardValue(c.idType, c.idNo) })),
      ]
      const seenMap = new Map<string, string>()
      for (const item of allFormatted) {
        const key = item.val.replace(/[\s-]/g, '').toUpperCase()
        if (seenMap.has(key)) {
          setError(`Nomor identitas "${item.val}" terdeteksi ganda antara ${seenMap.get(key)} dan ${item.who}. Setiap tamu wajib memiliki nomor identitas masing-masing.`)
          return
        }
        seenMap.set(key, item.who)
      }
    }

    if (!purpose.trim()) {
      setError('Tujuan kunjungan wajib diisi.')
      return
    }
    if (!companyRemark.trim()) {
      setError('Nama perusahaan wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      const formattedIdCard = isAffiliate ? '-' : formatIdCardValue(mainIdType, mainIdNo)
      const formattedCompanions = companions.map((c) => ({
        name: c.name.trim(),
        idNo: formatIdCardValue(c.idType, c.idNo),
      }))

      const payload = {
        fullName: fullName.trim(),
        idCard: formattedIdCard,
        picJai: isAffiliate ? '-' : picJai.trim(),
        purpose: purpose.trim(),
        companyRemark: companyRemark.trim(),
        visitDate,
        companions: formattedCompanions,
        cardType,
        barcode,
        station,
      }

      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
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
      <div role="dialog" aria-modal="true" aria-label={`Daftarkan Tamu ${label}`} className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between bg-primary px-6 py-4 text-primary-foreground flex-shrink-0">
          <h2 className="text-base sm:text-lg font-bold">Daftarkan Tamu {label}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 overscroll-contain">
            {/* 1. Nama Perusahaan / Instansi (Paling Atas) */}
            <label className="block">
              <span className={labelClass}>Nama Perusahaan / Instansi</span>
              <input
                value={companyRemark}
                onChange={(e) => setCompanyRemark(e.target.value)}
                list="lobby-history-companies"
                autoComplete="off"
                required
                placeholder="Ketik atau pilih nama perusahaan..."
                className={inputClass}
              />
              <datalist id="lobby-history-companies">
                {allCompanies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="mt-1 text-[11px] text-muted-foreground">Perusahaan otomatis tersimpan dan disarankan untuk kunjungan berikutnya.</p>
            </label>

            {/* 2. Identitas Tamu (Tamu Utama & Rombongan Seragam & Ketat) */}
            <div className="rounded-xl border border-border/80 bg-secondary/15 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    Identitas Tamu {companions.length > 0 ? `(1 Tamu Utama + ${companions.length} Rombongan)` : '(1 Tamu)'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Format KTP 16 digit, SIM, atau Paspor dengan validasi ketat
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCompanions([...companions, { name: '', idNo: '', idType: 'ktp' }])}
                  disabled={companions.length >= MAX_COMPANIONS}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                >
                  <UserPlus className="size-3.5" />
                  Tambah Orang
                </button>
              </div>

              {/* Tamu Utama (#1) */}
              <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      #1
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      Tamu Utama / Penanggung Jawab
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    Penanggung Jawab
                  </span>
                </div>

                <div className={`grid grid-cols-1 ${!isAffiliate ? 'sm:grid-cols-2' : ''} gap-2.5`}>
                  <label className="block">
                    <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Nama Lengkap</span>
                    <input
                      list="lobby-history-suggestions"
                      value={fullName}
                      onChange={(e) => onNameChange(e.target.value)}
                      required
                      autoFocus
                      placeholder="Nama lengkap tamu..."
                      className={inputClass}
                    />
                    <datalist id="lobby-history-suggestions">
                      {history.map((h) => (
                        <option key={h.full_name} value={h.full_name}>
                          {h.company_remark} · PIC {h.pic_jai} ({h.visits}x kunjungan)
                        </option>
                      ))}
                    </datalist>
                  </label>

                  {!isAffiliate && (
                    <label className="block">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-muted-foreground">Kartu Identitas</span>
                        <div className="flex gap-1 text-[10px] font-bold">
                          {(['ktp', 'sim', 'paspor'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => handleMainIdTypeChange(t)}
                              className={`px-1.5 py-0.5 rounded transition ${
                                mainIdType === t
                                  ? 'bg-primary text-primary-foreground font-bold'
                                  : 'bg-secondary text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {t.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          value={mainIdNo}
                          onChange={(e) => handleMainIdChange(e.target.value)}
                          required
                          placeholder={
                            mainIdType === 'ktp'
                              ? '16 Digit NIK KTP...'
                              : mainIdType === 'sim'
                              ? '12-14 Digit No. SIM...'
                              : 'Nomor Paspor (WNA)...'
                          }
                          className={`${inputClass} ${mainIdType === 'ktp' ? 'pr-14' : ''}`}
                        />
                        {mainIdType === 'ktp' && (
                          <span
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold ${
                              mainIdNo.length === 16
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {mainIdNo.length}/16
                          </span>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Rombongan Tambahan (#2, #3, ...) */}
              {companions.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  {companions.map((c, i) => (
                    <div key={i} className="rounded-xl border border-border/70 bg-card p-3 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
                            #{i + 2}
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            Anggota Rombongan #{i + 2}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCompanions(companions.filter((_, j) => j !== i))}
                          aria-label={`Hapus anggota rombongan #${i + 2}`}
                          className="flex items-center gap-1 text-[11px] font-medium text-destructive transition hover:underline"
                        >
                          <X className="size-3.5" /> Hapus
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="block">
                          <span className="text-[11px] font-semibold text-muted-foreground block mb-1">Nama Lengkap</span>
                          <input
                            value={c.name}
                            onChange={(e) =>
                              setCompanions(
                                companions.map((comp, idx) =>
                                  idx === i ? { ...comp, name: e.target.value } : comp
                                )
                              )
                            }
                            placeholder={`Nama anggota #${i + 2}...`}
                            required
                            className={inputClass}
                          />
                        </label>

                        <label className="block">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-muted-foreground">Kartu Identitas</span>
                            <div className="flex gap-1 text-[10px] font-bold">
                              {(['ktp', 'sim', 'paspor'] as const).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => handleCompanionIdTypeChange(i, t)}
                                  className={`px-1.5 py-0.5 rounded transition ${
                                    c.idType === t
                                      ? 'bg-primary text-primary-foreground font-bold'
                                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                                  }`}
                                >
                                  {t.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              value={c.idNo}
                              onChange={(e) => handleCompanionIdChange(i, e.target.value)}
                              placeholder={
                                c.idType === 'ktp'
                                  ? '16 Digit NIK KTP...'
                                  : c.idType === 'sim'
                                  ? '12-14 Digit No. SIM...'
                                  : 'Nomor Paspor (WNA)...'
                              }
                              required
                              className={`${inputClass} ${c.idType === 'ktp' ? 'pr-14' : ''}`}
                            />
                            {c.idType === 'ktp' && (
                              <span
                                className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold ${
                                  c.idNo.length === 16
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {c.idNo.length}/16
                              </span>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. PIC JAI yang Ditemui (kecuali Affiliate) */}
            {!isAffiliate && (
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
            )}

            {/* 4. Tujuan */}
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

            {/* 5. Tanggal Kunjungan */}
            <label className="block">
              <span className={labelClass}>Tanggal Kunjungan (opsional, isi jika dijadwalkan)</span>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className={inputClass}
              />
            </label>

            {/* 6. Barcode Kartu */}
            <label className="block">
              <span className={labelClass}>Barcode Kartu {label}</span>
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  required
                  aria-label={`Barcode Kartu ${label}`}
                  placeholder={station === 'lobby' ? `Scan kartu ${label} (${lobbyCardRangeText(cardType as LobbyCardKind)})` : 'Scan atau ketik barcode...'}
                  className={`${inputClass} pl-10`}
                />
              </div>
              {cardProblem
                ? <span role="alert" className="mt-1.5 block text-xs font-medium text-destructive">{cardProblem}</span>
                : station === 'lobby' && <span className="mt-1.5 block text-[11px] text-muted-foreground">Kartu {label} bernomor {lobbyCardRangeText(cardType as LobbyCardKind)}.</span>}
            </label>

            {error && (
              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          {/* Fixed Footer Buttons */}
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
  const fromSecurity = holdsSecurityCard(registration)
  // A guest the Lobby registered itself with a Visitor card can only move on to a Vendor card.
  const swapOptions: SwapCardType[] = fromSecurity ? SWAP_TYPES : registration.stage === 'active' && registration.current_card_type === 'visitor' ? ['vendor'] : []
  const holdsWorkCard = registration.stage === 'active' && registration.current_card_type !== null && (registration.entry_path === 'security'
    ? registration.at_work_area
    : (['vendor', 'special_area', 'photography'] as string[]).includes(registration.current_card_type))
  const [swapTarget, setSwapTarget] = useState<SwapCardType>(fromSecurity ? 'visitor' : 'vendor')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // A second read of the same card while the first is on its way is dropped, not glued onto it.
  const submittingRef = useRef(false)
  const [manualClose, setManualClose] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editFullName, setEditFullName] = useState(registration.full_name)
  const [editIdCard, setEditIdCard] = useState(registration.id_card)
  const [editPicJai, setEditPicJai] = useState(registration.pic_jai)
  const [editPurpose, setEditPurpose] = useState(registration.purpose)
  const [editCompanyRemark, setEditCompanyRemark] = useState(registration.company_remark)
  const [editVisitDate, setEditVisitDate] = useState(registration.visit_date ?? '')
  const [editCompanions, setEditCompanions] = useState<CompanionInput[]>(toCompanionInputs(registration))
  const { adminUser } = useAuth()
  const canCheckId = adminUser?.role === 'security' || adminUser?.role === 'ism_admin'
  const [idBusy, setIdBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  // Picking VISITOR / VENDOR must not take the cursor away from the scan field.
  const swapInputRef = useRef<HTMLInputElement>(null)
  const onEnter = (run: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') { event.preventDefault(); if (!submittingRef.current) run() }
  }
  const status = statusOf(registration)
  const isAffiliate = registration.current_card_type === 'affiliate' || Boolean(registration.affiliate_card_barcode)

  const runAction = async (action: 'swapToWorkArea' | 'returnWorkArea' | 'returnDirect', cardType?: SwapCardType) => {
    if (submittingRef.current) return
    if (!barcode.trim()) { setError('Barcode wajib diisi.'); return }
    // The card just scanned (the Security card that opened this panel), read a second time.
    if (isRepeatScan(barcode)) { setBarcode(''); return }
    setError(null)
    const code = barcode.trim()
    submittingRef.current = true
    setSubmitting(true)
    setBarcode('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${registration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, barcode: code, ...(cardType ? { cardType } : {}) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal memproses.'); return }
      markScanned(code)
      onChanged()
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const startEdit = () => {
    setEditFullName(registration.full_name)
    setEditIdCard(registration.id_card)
    setEditPicJai(registration.pic_jai)
    setEditPurpose(registration.purpose)
    setEditCompanyRemark(registration.company_remark)
    setEditVisitDate(registration.visit_date ?? '')
    setEditCompanions(toCompanionInputs(registration))
    setEditError(null)
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!editFullName.trim() || !editPurpose.trim() || !editCompanyRemark.trim() || (!isAffiliate && (!editIdCard.trim() || !editPicJai.trim()))) {
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
          visitDate: editVisitDate,
          companions: editCompanions,
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

  const idAction = async (action: 'verifyId' | 'returnId') => {
    setIdBusy(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations/${registration.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.message ?? 'Gagal memperbarui status KTP.'); return }
      onChanged()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setIdBusy(false)
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
          {!isAffiliate && (
            <>
              <label>
                <span className={labelClass}>Kartu Identitas</span>
                <input value={editIdCard} onChange={(e) => setEditIdCard(e.target.value)} className={inputClass} />
              </label>
              <label>
                <span className={labelClass}>PIC JAI</span>
                <input value={editPicJai} onChange={(e) => setEditPicJai(e.target.value)} className={inputClass} />
              </label>
            </>
          )}
          <label>
            <span className={labelClass}>Tujuan</span>
            <input value={editPurpose} onChange={(e) => setEditPurpose(e.target.value)} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Keterangan</span>
            <input value={editCompanyRemark} onChange={(e) => setEditCompanyRemark(e.target.value)} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Tanggal Kunjungan</span>
            <input type="date" value={editVisitDate} onChange={(e) => setEditVisitDate(e.target.value)} className={inputClass} />
          </label>
          <CompanionsField value={editCompanions} onChange={setEditCompanions} />
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
          {!isAffiliate && row('Kartu Identitas :', registration.id_card)}
          {!isAffiliate && row('PIC JAI :', registration.pic_jai)}
          {row('Tujuan :', registration.purpose)}
          {row('Keterangan :', registration.company_remark)}
          {registration.visit_date && row('Tgl Kunjungan :', formatVisitDate(registration.visit_date))}
          {(registration.companions?.length ?? 0) > 0 && row('Orang Tambahan :', registration.companions!.map((c) => `${c.name} (${c.id_no})`).join(', '))}
          {row('Status KTP :', idStatusText(registration))}
          {row('Status :', status.label)}
          {row('Jam Masuk :', formatDateTime(registration.entry_at))}
          {row('Jam Keluar :', formatDateTime(registration.exit_at))}
          {registration.closed_note && row('Catatan :', registration.closed_note)}
        </>
      )}

      <div className="p-4">
        {canCheckId && (
          <div className="mb-4 flex gap-2">
            {registration.stage !== 'closed' && !registration.id_verified_at && (
              <button
                type="button"
                disabled={idBusy}
                onClick={() => idAction('verifyId')}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
              >
                <Check className="size-3.5" />Verifikasi KTP
              </button>
            )}
            {registration.id_verified_at && !registration.id_returned_at && (
              <button
                type="button"
                disabled={idBusy}
                onClick={() => idAction('returnId')}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
              >
                <Undo2 className="size-3.5" />KTP Dikembalikan
              </button>
            )}
          </div>
        )}
        {swapOptions.length > 0 && (
          <div className="rounded-xl bg-accent/10 p-4">
            <p className="mb-2 text-xs font-semibold text-foreground">Tukar ke Kartu Area Kerja</p>
            {fromSecurity && (
              <p className="mb-2 text-[11px] text-muted-foreground">
                Tamu membawa kartu {SECURITY_CARD_LABEL[registration.security_card_type]} dari Pos Security
                {registration.security_card_barcode ? <> (<span className="font-mono font-semibold">{registration.security_card_barcode}</span>)</> : null}.
              </p>
            )}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {swapOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setSwapTarget(type); swapInputRef.current?.focus() }}
                  className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all"
                  style={
                    swapTarget === type
                      ? { background: 'linear-gradient(135deg, var(--p-700), var(--p-600))', color: 'white', borderColor: 'transparent' }
                      : { background: 'transparent', color: 'var(--muted-foreground)', borderColor: 'var(--border)' }
                  }
                >
                  {WORK_AREA_LABEL[type]}
                </button>
              ))}
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">Kartu {WORK_AREA_LABEL[swapTarget]} Lobby bernomor {lobbyCardRangeText(swapTarget)}.</p>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input ref={swapInputRef} value={barcode} onChange={(e) => { if (!submittingRef.current) setBarcode(e.target.value) }} onKeyDown={onEnter(() => runAction('swapToWorkArea', swapTarget))} autoFocus placeholder={`Scan barcode kartu ${WORK_AREA_LABEL[swapTarget]}...`} className={`${inputClass} pl-10`} />
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
                <input value={barcode} onChange={(e) => { if (!submittingRef.current) setBarcode(e.target.value) }} onKeyDown={onEnter(() => runAction('returnDirect'))} placeholder="Scan barcode kartu Visitor yang dikembalikan..." className={`${inputClass} pl-10`} />
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
        {holdsWorkCard && (() => {
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
                <input value={barcode} onChange={(e) => { if (!submittingRef.current) setBarcode(e.target.value) }} onKeyDown={onEnter(() => runAction('returnWorkArea'))} autoFocus placeholder="Scan barcode kartu yang dikembalikan..." className={`${inputClass} pl-10`} />
              </div>
              {trimmed && (
                matches
                  ? <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><Check className="size-3.5" />Nomor kartu cocok</p>
                  : <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive"><X className="size-3.5" />Nomor kartu tidak cocok dengan yang terdaftar</p>
              )}
              <button type="button" disabled={submitting} onClick={() => runAction('returnWorkArea')} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Memproses...' : registration.entry_path === 'security' ? `Kembalikan ke Kartu ${SECURITY_CARD_LABEL[registration.security_card_type]} Security` : 'Tutup Pendaftaran'}
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
                <input value={barcode} onChange={(e) => { if (!submittingRef.current) setBarcode(e.target.value) }} onKeyDown={onEnter(() => runAction('returnDirect'))} autoFocus placeholder="Scan barcode kartu Affiliate yang dikembalikan..." className={`${inputClass} pl-10`} />
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
        {/* The card can't be scanned back (lost, the guest left with it): close the visit by hand. */}
        {registration.stage === 'active' && (
          <button type="button" onClick={() => setManualClose(true)} className="mt-3 w-full text-center text-xs font-semibold text-muted-foreground underline-offset-2 transition hover:text-destructive hover:underline">
            Kartu hilang / tidak bisa di-scan? Tutup Manual
          </button>
        )}
      </div>
      {manualClose && <ManualCloseDialog registration={registration} onClose={() => setManualClose(false)} onDone={() => { setManualClose(false); onChanged(); onClose() }} />}
    </div>
  )
}

// station: which post the view is opened as (name in the header, the export
// and where a guest is recorded as registered). Pos Security has its own
// view (SecurityView) — its cards are a different set from the Lobby's.
export function LobbyView({ station = 'lobby' }: { station?: 'lobby' | 'security' }) {
  const { adminUser, logout } = useAuth()
  const stationName = station === 'security' ? 'Pos Security' : 'Admin Lobby'
  // A month/year badge elsewhere in the portal (e.g. the Form Aplikasi group
  // header) can deep-link here as ?month=0-11&year=YYYY to land pre-filtered
  // on that period instead of the unfiltered full list.
  const searchParams = useSearchParams()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  // The table is paginated, but the card-return dialogs must still show every
  // card currently out, regardless of the selected table page or filter.
  const [activeRegistrations, setActiveRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Registration | null>(null)
  const [quickCardOpen, setQuickCardOpen] = useState<QuickCardType | null>(null)
  const [photoPermitOpen, setPhotoPermitOpen] = useState(false)
  const [specialAreaPermitOpen, setSpecialAreaPermitOpen] = useState(false)
  // a card scanned at "Scan Kartu" that nobody holds: the number to register a new guest with
  const [quickCardBarcode, setQuickCardBarcode] = useState('')
  const [scanFocusKey, setScanFocusKey] = useState(0)
  // The old reception screen's two windows: "Pengembalian Kartu ID" and
  // "Panggil Record" (swap a Security card for a Lobby card).
  const [returnOpen, setReturnOpen] = useState(false)
  const [callOpen, setCallOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Registration | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [tableQuery, setTableQuery] = useState('')
  const [context, setContext] = useState<RegistrationContext>('all')
  const [filterMonth, setFilterMonth] = useState(searchParams.get('month') ?? '')
  const [filterYear, setFilterYear] = useState(searchParams.get('year') ?? '')
  const [years, setYears] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [totalItems, setTotalItems] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const permitCards = usePermitCards()
  const canCheckId = adminUser?.role === 'security' || adminUser?.role === 'ism_admin'
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
      setSelected((curr) => (curr?.id === r.id ? { ...curr, ...data.registration } : curr))
      setListError(null)
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Gagal memperbarui status KTP.')
    } finally {
      setIdBusy(null)
    }
  }

  // silent = background refresh (no spinner, keeps the current list on a
  // transient error) — see useKioskAutoRefresh.
  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({ sort: 'newest', page: String(page), limit: String(pageSize) })
      if (context !== 'all') params.set('context', context)
      if (filterMonth) params.set('month', filterMonth)
      if (filterYear) params.set('year', filterYear)
      if (tableQuery.trim()) params.set('query', tableQuery.trim())
      const [res, activeRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api/vendor-registrations?${params}`, { cache: 'no-store', credentials: 'include' }),
        fetch(`${API_BASE_PATH}/api/vendor-registrations?stage=active&sort=newest`, { cache: 'no-store', credentials: 'include' }),
      ])
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      if (activeRes.ok) {
        const activeData = await activeRes.json()
        setActiveRegistrations(activeData.registrations ?? [])
      }
      const fresh: Registration[] = data.registrations ?? []
      setRegistrations(fresh)
      setTotalItems(data.pagination?.total ?? fresh.length)
      setYears(data.years ?? [])
      // Keep an open detail panel in step with changes made at the other kiosk.
      setSelected((current) => (current ? fresh.find((r) => r.id === current.id) ?? current : current))
      setListError(null)
    } catch (e) {
      if (silent) return
      setRegistrations([])
      setListError(e instanceof Error ? e.message : 'Gagal memuat data.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [context, filterMonth, filterYear, page, tableQuery])

  useEffect(() => { load() }, [load])
  const refreshSilently = useCallback(() => { load({ silent: true }) }, [load])
  useKioskAutoRefresh(refreshSilently)

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const pageItems = registrations
  const emptyMessage = loading
    ? null
    : totalItems === 0 ? 'Tidak ada pendaftaran yang cocok dengan filter.' : null

  // The detail panel sits above the list: when a row far down is tapped
  // (on a phone especially), bring the panel into view.
  const detailRef = useRef<HTMLDivElement>(null)
  const selectedId = selected?.id
  useEffect(() => {
    if (selectedId == null) return
    const el = detailRef.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedId])

  const handleExportCsv = async () => {
    const params = new URLSearchParams({ sort: 'newest', page: '1', limit: '10000' })
    if (context !== 'all') params.set('context', context)
    if (filterMonth) params.set('month', filterMonth)
    if (filterYear) params.set('year', filterYear)
    if (tableQuery.trim()) params.set('query', tableQuery.trim())
    try {
      const res = await fetch(`${API_BASE_PATH}/api/vendor-registrations?${params}`, { cache: 'no-store', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      const rows: Registration[] = data.registrations ?? []
      downloadExcel(
        `rekap-tamu-${station === 'security' ? 'pos-security' : 'lobby'}-${new Date().toISOString().slice(0, 10)}.xlsx`,
        ['Tanggal/Jam', 'Tanggal Kunjungan', 'Nama Lengkap', 'Orang Tambahan', 'PIC JAI', 'Keterangan', 'Status KTP', 'Asal', 'Status', 'Nomor Kartu', 'Jam Masuk', 'Jam Keluar'],
        rows.map((r) => [
          formatDateTime(r.registered_at),
          r.visit_date ? formatVisitDate(r.visit_date) : '-',
          r.full_name,
          (r.companions ?? []).map((c) => `${c.name} (${c.id_no})`).join('; '),
          r.pic_jai,
          r.company_remark,
          idStatusText(r),
          stationOf(r) === 'security' ? 'Security' : 'Lobby',
          statusOf(r).label,
          r.current_card_type ? (r[CARD_BARCODE_FIELD[r.current_card_type]] ?? '') : '',
          formatDateTime(r.entry_at),
          formatDateTime(r.exit_at),
        ])
      )
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Gagal mengekspor data.')
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
  const allVisibleSelected = registrations.length > 0 && registrations.every((r) => selectedIds.has(r.id))
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        registrations.forEach((r) => next.delete(r.id))
        return next
      }
      const next = new Set(prev)
      registrations.forEach((r) => next.add(r.id))
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
      <header className="flex items-center justify-between gap-3 border-b border-border bg-primary px-4 py-4 text-primary-foreground sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 flex-shrink-0 place-items-center rounded-xl bg-white/15"><ShieldCheck className="size-5" /></span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/65">PT. Jatim Autocomp Indonesia</p>
            <h1 className="text-lg font-bold">{stationName}</h1>
          </div>
        </div>
        {/* On a phone the two buttons shrink to their icons. */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="hidden text-xs text-primary-foreground/75 sm:inline">{adminUser?.username}</span>
          <KioskThemePicker station={station} />
          <button onClick={() => setPasswordModalOpen(true)} aria-label="Ganti Password" title="Ganti Password" className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-2.5 py-2 text-xs transition-colors hover:bg-primary-foreground/10 sm:px-3">
            <KeyRound className="size-4" /><span className="hidden sm:inline">Ganti Password</span>
          </button>
          <button onClick={() => logout()} aria-label="Logout" title="Logout" className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-2.5 py-2 text-xs transition-colors hover:bg-primary-foreground/10 sm:px-3">
            <LogOut className="size-4" /><span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Registering a guest is what the Lobby does all day: the buttons first.
            One column on a phone, one row from tablet width up. */}
        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Pendaftaran tamu">
          {QUICK_REGISTER_TYPES.map((type) => {
            const Icon = QUICK_CARD_ICON[type]
            return (
              <button
                key={type}
                type="button"
                onClick={() => { setQuickCardBarcode(''); setQuickCardOpen(type) }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Icon className="size-4" />Daftarkan {QUICK_CARD_LABEL[type]}
              </button>
            )
          })}
        </div>
        {/* The old reception screen's buttons: take a card back, call up the records, refresh. */}
        <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="Menu Lobby">
          <button type="button" onClick={() => setReturnOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary">
            <Undo2 className="size-4" />Pengembalian Kartu ID
          </button>
          <button type="button" onClick={() => setCallOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary">
            <ListChecks className="size-4" />Panggil Record
          </button>
          <button type="button" onClick={() => load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary">
            <RotateCcw className="size-4" />Refresh
          </button>
        </div>

        {/* Keep both primary permit actions together; the panels below are only for tracking their status. */}
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Pengajuan izin">
          <button type="button" onClick={() => setPhotoPermitOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087b9a] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5">
            <Camera className="size-4" />Ajukan Izin Foto/Video
          </button>
          <button type="button" onClick={() => setSpecialAreaPermitOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c7161e] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5">
            <ShieldAlert className="size-4" />Ajukan Izin Area Special
          </button>
        </div>
        {/* The permits are registrations too: right under their action buttons. */}

        {/* Scan a card: the guest it belongs to is handled — no searching the list. Right above the list. */}
        <ScanCardBox
          station={station}
          focusKey={scanFocusKey}
          onChanged={load}
          onSwap={setSelected}
          registerOptions={QUICK_REGISTER_TYPES.map((type) => ({ label: `Daftarkan ${QUICK_CARD_LABEL[type]}`, kind: type, onPick: (code: string) => { setQuickCardBarcode(code); setQuickCardOpen(type) } }))}
        />
        {selected && (
          <div ref={detailRef} className="mb-6 scroll-mt-4">
            <DetailPanel registration={selected} onClose={() => { setSelected(null); setScanFocusKey((key) => key + 1) }} onChanged={() => { load(); setScanFocusKey((key) => key + 1) }} />
          </div>
        )}
        {/* The guest list right under the scan box; the cards in use at the bottom. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="portal-eyebrow">Semua Pendaftaran</p>
            <p className="mt-1 text-sm text-muted-foreground">{totalItems} data</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Konteks pendaftaran">
          {REGISTRATION_CONTEXTS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={context === item.value}
              onClick={() => { setContext(item.value); setPage(1); setSelectedIds(new Set()) }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${context === item.value ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-secondary'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }} className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20">
            <option value="">Semua Bulan</option>
            {MONTH_LABELS.map((label, i) => <option key={label} value={i}>{label}</option>)}
          </select>
          <select value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setPage(1) }} className="h-9 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20">
            <option value="">Semua Tahun</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {(filterMonth || filterYear) && (
            <button type="button" onClick={() => { setFilterMonth(''); setFilterYear(''); setPage(1) }} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary">
              Reset Filter
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={totalItems === 0}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-3.5" />Export ke Excel
          </button>
        </div>

        <ScheduledGuestsBanner registrations={registrations} />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={tableQuery}
              onChange={(e) => { setTableQuery(e.target.value); setPage(1) }}
              aria-label="Cari record tamu"
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
          {/* Phone: one card per guest, everything visible without sliding sideways. */}
          <div className="md:hidden">
            {loading && <div className="px-5 py-14 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></div>}
            {emptyMessage && <p className="px-5 py-14 text-center text-sm text-muted-foreground">{emptyMessage}</p>}
            {!loading && pageItems.length > 0 && (
              <>
                <label className="flex items-center gap-3 border-b border-border bg-secondary/55 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className="size-4 rounded border-border" />Pilih semua
                </label>
                <ul className="divide-y divide-border">
                  {pageItems.map((r) => {
                    const status = statusOf(r)
                    return (
                      <li key={r.id} onClick={() => setSelected(r)} className={`flex cursor-pointer gap-3 px-4 py-3.5 transition-colors active:bg-secondary/40 ${selected?.id === r.id ? 'bg-secondary/40' : ''}`}>
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Pilih ${r.full_name}`} className="mt-1 size-4 flex-shrink-0 rounded border-border" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 break-words font-semibold text-foreground">{r.full_name}</p>
                            <span className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{stationOf(r) === 'security' ? 'Security' : 'Lobby'}</span>
                          </div>
                          {(r.companions?.length ?? 0) > 0 && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground" title={r.companions?.map((c) => `${c.name} (${c.id_no})`).join(', ')}>
                              + {r.companions?.length} orang: {r.companions?.map((c) => c.name).join(', ')}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatDateTime(r.registered_at)}
                            {r.visit_date && (
                              <span className="ml-2 inline-block rounded border border-[#f0d58a] bg-[#fff8e6] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6100]">
                                Jadwal {formatVisitDate(r.visit_date)}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            {r.pic_jai && <>PIC: <span className="text-foreground">{r.pic_jai}</span> · </>}{r.company_remark}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Masuk: <span className="font-semibold tabular-nums text-foreground">{formatTimeParts(r.entry_at)?.time ?? '—'}</span>
                            {' · '}Keluar: <span className="font-semibold tabular-nums text-foreground">{formatTimeParts(r.exit_at)?.time ?? '—'}</span>
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STAGE_BADGE[status.key]}`}>{status.label}</span>
                            <IdStatusBadge r={r} />
                            {r.current_card_type && <span className="font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">{r[CARD_BARCODE_FIELD[r.current_card_type]] ?? '—'}</span>}
                          </div>
                          {canCheckId && (
                            <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {r.stage !== 'closed' && !r.id_verified_at && (
                                <button
                                  type="button"
                                  disabled={idBusy === r.id}
                                  onClick={() => idAction(r, 'verifyId')}
                                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
                                >
                                  <Check className="size-3" />Verifikasi KTP
                                </button>
                              )}
                              {r.id_verified_at && !r.id_returned_at && (
                                <button
                                  type="button"
                                  disabled={idBusy === r.id}
                                  onClick={() => idAction(r, 'returnId')}
                                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
                                >
                                  <Undo2 className="size-3" />KTP Dikembalikan
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setPendingDelete(r) }}
                          aria-label={`Hapus pendaftaran ${r.full_name}`}
                          title="Hapus pendaftaran"
                          className="grid size-8 flex-shrink-0 place-items-center self-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-secondary/55">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} onClick={(e) => e.stopPropagation()} aria-label="Pilih semua" className="size-4 rounded border-border" />
                  </th>
                  {['Tanggal/Jam', 'Nama Lengkap', 'PIC JAI', 'Keterangan', 'Asal', 'Jam Masuk', 'Jam Keluar', 'Status', 'Aksi'].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={10} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
                )}
                {!loading && registrations.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-16 text-center text-sm text-muted-foreground">Tidak ada pendaftaran yang cocok dengan filter.</td></tr>
                )}
                {pageItems.map((r, index) => {
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
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="block text-xs font-medium tabular-nums text-foreground">{formatTimeParts(r.registered_at)?.time}</span>
                        <span className="block text-[10px] text-muted-foreground">{formatTimeParts(r.registered_at)?.date}</span>
                        {r.visit_date && (
                          <span className="mt-1 block rounded border border-[#f0d58a] bg-[#fff8e6] px-1 py-0.5 text-[10px] font-semibold text-[#8a6100]">
                            Jadwal {formatVisitDate(r.visit_date)}
                          </span>
                        )}
                      </td>
                      <td className="min-w-[160px] px-4 py-3 font-medium text-foreground">
                        {r.full_name}
                        {(r.companions?.length ?? 0) > 0 && (
                          <span className="mt-1 block text-[10px] font-normal text-muted-foreground" title={r.companions?.map((c) => `${c.name} (${c.id_no})`).join(', ')}>
                            + {r.companions?.length} orang: {r.companions?.map((c) => c.name).join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_jai}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.company_remark}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{stationOf(r) === 'security' ? 'Security' : 'Lobby'}</td>
                      <td className="whitespace-nowrap px-4 py-3" data-testid="jam-masuk">
                        {(() => {
                          const at = formatTimeParts(r.entry_at)
                          return at
                            ? <><span className="block text-sm font-semibold tabular-nums text-foreground">{at.time}</span><span className="block text-[10px] text-muted-foreground">{at.date}</span></>
                            : <span className="text-xs text-muted-foreground">—</span>
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" data-testid="jam-keluar">
                        {(() => {
                          const at = formatTimeParts(r.exit_at)
                          return at
                            ? <><span className="block text-sm font-semibold tabular-nums text-foreground">{at.time}</span><span className="block text-[10px] text-muted-foreground">{at.date}</span></>
                            : <span className="text-xs text-muted-foreground">—</span>
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STAGE_BADGE[status.key]}`}>{status.label}</span>
                        <IdStatusBadge r={r} />
                        {r.current_card_type && (
                          <span className="mt-1 block font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                            {r[CARD_BARCODE_FIELD[r.current_card_type]] ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {canCheckId && r.stage !== 'closed' && !r.id_verified_at && (
                            <button
                              type="button"
                              disabled={idBusy === r.id}
                              onClick={() => idAction(r, 'verifyId')}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
                            >
                              <Check className="size-3" />Verifikasi KTP
                            </button>
                          )}
                          {canCheckId && r.id_verified_at && !r.id_returned_at && (
                            <button
                              type="button"
                              disabled={idBusy === r.id}
                              onClick={() => idAction(r, 'returnId')}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
                            >
                              <Undo2 className="size-3" />KTP Dikembalikan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPendingDelete(r)}
                            aria-label={`Hapus pendaftaran ${r.full_name}`}
                            title="Hapus pendaftaran"
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={pageSize} />
        </div>

        <div className="mt-8">
        <ActiveCardsWidget registrations={activeRegistrations} cardTypes={['visitor', 'vendor', 'supplier', 'special_area', 'photography', 'affiliate']} permitCards={permitCards} />
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

      {callOpen && <CallRecordDialog station={station} registrations={activeRegistrations} onClose={() => { setCallOpen(false); setScanFocusKey((key) => key + 1) }} onChanged={load} />}
      {returnOpen && <ReturnCardDialog station={station} registrations={activeRegistrations} permitCards={permitCards} onClose={() => { setReturnOpen(false); setScanFocusKey((key) => key + 1) }} onChanged={load} />}
      {quickCardOpen && <QuickCardModal cardType={quickCardOpen} station={station} initialBarcode={quickCardBarcode} onClose={() => { setQuickCardOpen(null); setScanFocusKey((key) => key + 1) }} onSaved={load} />}
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
