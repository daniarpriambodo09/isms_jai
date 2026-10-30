'use client'

import { useEffect, useState, type FormEvent, Fragment } from 'react'
import { CalendarDays, Camera, Check, CheckCircle2, Clock, Copy, History, MapPin, ScanLine, Search, Send } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useAuth } from '@/context/AuthContext'
import { cardsChanged } from '@/components/kiosk/kiosk-shared'
import { ESCORT_OTHER, EscortOptions, escortFromChoice, useEscortList } from '@/components/escort-picker'

type Section = { id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }
type Pic = { id: number; name: string; department_id: number | null }
type CameraItem = { id: number; code: string; department_id: number | null; department_name: string | null; section_id: number | null; section_name: string | null }
type PhotoIdItem = { id: number; code: string; department_id: number | null; department_name: string | null; section_id: number | null; section_name: string | null }
type UsbItem = { id: number; code: string; department_id: number | null; department_name: string | null; section_id: number | null; section_name: string | null }
type SmartDeviceItem = { id: number; code: string; department_id: number | null; department_name: string | null; section_id: number | null; section_name: string | null }
type VisitorApprover = { id: number; fullName: string | null; title: string | null; email?: string | null; salutation?: string | null }

type LookupRequest = {
  id: number
  requester_name: string
  location: string
  from_at: string
  to_at: string
  status: 'pending' | 'approved' | 'rejected'
  taken_at: string | null
  submitted_at: string
}

const inputClass = 'h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const labelClass = 'mb-1.5 block text-xs font-semibold text-muted-foreground'
const STATUS_LABEL: Record<LookupRequest['status'], string> = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }
const STATUS_TONE: Record<LookupRequest['status'], string> = { pending: 'bg-[#fff3d6] text-[#8a6100]', approved: 'bg-[#dff5e6] text-[#1a6e3a]', rejected: 'bg-[#fdecec] text-[#b3413a]' }

// Self-service "what's the status of my request?" lookup, available to both
// internal and visitor requesters — before this, visitors had no way at all
// to check back on a pending/approved/rejected request. Internal employees
// can still search their whole history by NIK; everyone (internal or
// visitor) can also look up one specific request by the reference number
// shown right after submitting, and cancel it themselves while it's still
// pending. Kept collapsed by default so it doesn't crowd the form for the
// common case of a first-time submission.
// initialRef: opened from a status link (?ref=… in the e-mail or the one shown
// after submitting) — the lookup opens and checks that request right away.
function StatusLookup({ isInternal, initialRef }: { isInternal: boolean; initialRef?: string | null }) {
  const [open, setOpen] = useState(!!initialRef)
  const [mode, setMode] = useState<'ref' | 'nik'>('ref')
  const [nik, setNik] = useState('')
  const [ref, setRef] = useState(initialRef ?? '')
  const [results, setResults] = useState<LookupRequest[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<number | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const search = async (override?: string) => {
    const value = override ?? (mode === 'nik' ? nik.trim() : ref.trim())
    if (!value) return
    setSearching(true)
    setError(null)
    setCancelError(null)
    try {
      const param = mode === 'nik' && override === undefined ? `nik=${encodeURIComponent(value)}` : `ref=${encodeURIComponent(value)}`
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/lookup?${param}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) { setError(data?.message ?? 'Gagal memuat status.'); setResults(null); return }
      setResults(data.requests ?? [])
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSearching(false)
    }
  }

  // Opened from a status link: check it straight away (once).
  useEffect(() => {
    if (initialRef) void search(initialRef.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRef])

  const cancelRequest = async (id: number) => {
    // Cancelling needs the full secret reference code, not just the id.
    setCancelingId(id)
    setCancelError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/lookup?ref=${encodeURIComponent(ref.trim())}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setCancelError(data?.message ?? 'Gagal membatalkan pengajuan.'); return }
      setResults((prev) => prev?.filter((r) => r.id !== id) ?? null)
    } catch {
      setCancelError('Tidak dapat menghubungi server.')
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/15"
      >
        <History className="size-4" /> {open ? 'Sembunyikan' : 'Cek status pengajuan saya'}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-4">
          {isInternal && (
            <div className="mb-3 flex gap-1.5">
              <button type="button" onClick={() => { setMode('ref'); setResults(null); setError(null) }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === 'ref' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'}`}>Nomor Referensi</button>
              <button type="button" onClick={() => { setMode('nik'); setResults(null); setError(null) }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${mode === 'nik' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-secondary'}`}>NIK (semua riwayat)</button>
            </div>
          )}
          <div className="flex gap-2">
            {mode === 'nik' ? (
              <input value={nik} onChange={(e) => setNik(e.target.value)} placeholder="Masukkan NIK" className={inputClass} />
            ) : (
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Contoh: 42-A1B2C3D4E5" className={inputClass} />
            )}
            <button type="button" onClick={() => search()} disabled={searching || !(mode === 'nik' ? nik.trim() : ref.trim())} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              <Search className="size-4" /> {searching ? 'Mencari...' : 'Cek'}
            </button>
          </div>
          {mode === 'ref' && <p className="mt-1.5 text-[11px] text-muted-foreground">Kode referensi ditampilkan setelah Anda mengirim pengajuan.</p>}
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {cancelError && <p className="mt-2 text-xs text-destructive">{cancelError}</p>}
          {results && results.length === 0 && !error && <p className="mt-3 text-xs text-muted-foreground">Tidak ada pengajuan yang cocok.</p>}
          {results && results.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {results.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-xs">
                  <span className="text-foreground">
                    #{r.id} &middot; {new Date(r.from_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} &middot; {r.location}
                    {r.taken_at && <span className="ml-1.5 text-muted-foreground">(sudah diambil)</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    {r.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => cancelRequest(r.id)}
                        disabled={cancelingId === r.id}
                        className="rounded-md border border-destructive/30 px-2 py-1 text-[10px] font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cancelingId === r.id ? 'Membatalkan...' : 'Batalkan'}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function todayDateStr() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function nowTimeStr() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// "Sampai Jam" starts one hour after "Dari Jam" (kept within the same day).
function hourAfter(time: string) {
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  return h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function Field({ label, span = 1, children }: { label: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : undefined}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  )
}

// Sections of the form, for the step bar that stays in view while scrolling.
const STEP_IDS = ['pv-step-1', 'pv-step-2', 'pv-step-3']

// Which section the reader is in right now.
function useCurrentStep() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const update = () => {
      let current = 0
      STEP_IDS.forEach((id, index) => {
        const el = document.getElementById(id)
        // "current" once its heading is in the upper part of the screen
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.42) current = index
      })
      // Bottom of the page: the last step, even if its marker never reaches the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && document.getElementById(STEP_IDS[2])) {
        const last = document.getElementById(STEP_IDS[2])!.getBoundingClientRect()
        if (last.top < window.innerHeight) current = 2
      }
      setStep(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  return step
}

export function PhotoVideoRequestForm({ locale, initialRef = null }: { locale: 'internal' | 'visitor'; initialRef?: string | null }) {
  const currentStep = useCurrentStep()
  const isInternal = locale === 'internal'
  const [requesterEmail, setRequesterEmail] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  // PIC Pendamping: offered when Lobby / Pos Security / the ISM Admin fill the
  // form in (they are the ones who assign one); it can also be picked later in the recap.
  const { adminUser } = useAuth()
  const isStaff = !!adminUser
  const escorts = useEscortList(isStaff)
  const [escortChoice, setEscortChoice] = useState('')
  const [escortName, setEscortName] = useState('')
  const [escortDept, setEscortDept] = useState('')

  const [nik, setNik] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [deptId, setDeptId] = useState('')
  const [sectionId, setSectionId] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [photoIdNo, setPhotoIdNo] = useState('')
  const [dept, setDept] = useState('')
  const [cameraSerialNo, setCameraSerialNo] = useState('')
  const [deptPicKameraId, setDeptPicKameraId] = useState('')
  const [sectionPicKameraId, setSectionPicKameraId] = useState('')
  const [cameraControlNo, setCameraControlNo] = useState('')
  const [picApproveId, setPicApproveId] = useState('')
  const [fromDate, setFromDate] = useState(todayDateStr)
  const [fromTime, setFromTime] = useState(nowTimeStr)
  const [toDate, setToDate] = useState(todayDateStr)
  const [toTime, setToTime] = useState(() => hourAfter(nowTimeStr()))
  const [location, setLocation] = useState('')
  const [objective, setObjective] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [pics, setPics] = useState<Pic[]>([])
  const [cameras, setCameras] = useState<CameraItem[]>([])
  const [photoIds, setPhotoIds] = useState<PhotoIdItem[]>([])
  const [usbs, setUsbs] = useState<UsbItem[]>([])
  const [usbControlNo, setUsbControlNo] = useState('')
  const [smartDevices, setSmartDevices] = useState<SmartDeviceItem[]>([])
  const [smartDeviceControlNo, setSmartDeviceControlNo] = useState('')
  const [visitorApprover, setVisitorApprover] = useState<VisitorApprover | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ id: number; referenceCode: string; submittedAt: string; emailed: boolean } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isInternal) return
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data: { departments: Department[] }) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]))
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) return
    fetch(`${API_BASE_PATH}/api/pic-approvers`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { pics: [] }))
      .then((data: { pics: Pic[] }) => setPics(data.pics ?? []))
      .catch(() => setPics([]))
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) return
    fetch(`${API_BASE_PATH}/api/camera-equipment`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { cameras: [] }))
      .then((data: { cameras: CameraItem[] }) => setCameras(data.cameras ?? []))
      .catch(() => setCameras([]))
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) return
    fetch(`${API_BASE_PATH}/api/photo-id-equipment`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { photoIds: [] }))
      .then((data: { photoIds: PhotoIdItem[] }) => setPhotoIds(data.photoIds ?? []))
      .catch(() => setPhotoIds([]))
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) return
    fetch(`${API_BASE_PATH}/api/usb-equipment`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { usbList: [] }))
      .then((data: { usbList: UsbItem[] }) => setUsbs(data.usbList ?? []))
      .catch(() => setUsbs([]))
  }, [isInternal])

  useEffect(() => {
    if (!isInternal) return
    fetch(`${API_BASE_PATH}/api/smart-device-equipment`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { smartDeviceList: [] }))
      .then((data: { smartDeviceList: SmartDeviceItem[] }) => setSmartDevices(data.smartDeviceList ?? []))
      .catch(() => setSmartDevices([]))
  }, [isInternal])

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/pic-approvers/visitor-default`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { approver: null }))
      .then((data: { approver: VisitorApprover | null }) => {
        setVisitorApprover(data.approver)
        if (!isInternal && data.approver?.id) {
          setPicApproveId(String(data.approver.id))
        }
      })
      .catch(() => setVisitorApprover(null))
  }, [isInternal])

  const selectedDept = departments.find((d) => String(d.id) === deptId)
  const selectedCameraDept = departments.find((d) => String(d.id) === deptPicKameraId)
  const selectedCameraSection = selectedCameraDept?.sections.find((s) => String(s.id) === sectionPicKameraId)

  // A PIC with no department applies everywhere (e.g. a general/HQ approver).
  const availablePics = pics.filter((pic) => pic.department_id === null || String(pic.department_id) === deptId)
  const displayedPics = availablePics.length > 0 ? availablePics : pics

  // Same convention — a camera/ID with no department is general-purpose and
  // shows up regardless of which Dept./Seksi PIC Kamera was picked; one with
  // a department but no section applies to every section within it; one
  // with both set is restricted to that exact section.
  const matchesCameraScope = (item: CameraItem | PhotoIdItem | UsbItem | SmartDeviceItem) => {
    if (item.department_id === null) return true
    if (String(item.department_id) !== deptPicKameraId) return false
    if (item.section_id === null) return true
    return String(item.section_id) === sectionPicKameraId
  }
  const availableCameras = cameras.filter(matchesCameraScope)
  const availablePhotoIds = photoIds.filter(matchesCameraScope)
  const availableUsbs = usbs.filter(matchesCameraScope)
  const availableSmartDevices = smartDevices.filter(matchesCameraScope)

  const resetForm = () => {
    setNik(''); setRequesterName(''); setRequesterEmail(''); setDeptId(''); setSectionId(''); setCompanyName(''); setPhotoIdNo(''); setDept(''); setCameraSerialNo(''); setDeptPicKameraId(''); setSectionPicKameraId(''); setCameraControlNo(''); setUsbControlNo(''); setSmartDeviceControlNo(''); setPicApproveId('')
    setFromDate(todayDateStr()); setFromTime(nowTimeStr()); setToDate(todayDateStr()); setToTime(hourAfter(nowTimeStr())); setLocation(''); setObjective('')
    setEscortChoice(''); setEscortName(''); setEscortDept('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccessInfo(null)
    setSubmitting(true)
    try {
      const section = selectedDept?.sections.find((s) => String(s.id) === sectionId)
      const deptOrCompany = isInternal
        ? `${selectedDept?.name ?? ''}${section ? ` - ${section.name}` : ''}`
        : companyName
      const escort = isStaff ? escortFromChoice(escortChoice, escorts, { name: escortName, dept: escortDept }) : null
      if (isStaff && escortChoice === ESCORT_OTHER && !escort) { setError('Tulis nama PIC pendamping JAI, atau kosongkan pilihannya.'); return }
      if (isInternal) {
        if (!picApproveId) {
          setError('Pilih PIC Approve yang akan menyetujui permohonan foto/video.')
          return
        }
        const hasCamera = Boolean(cameraControlNo && cameraControlNo.trim())
        const hasUsb = Boolean(usbControlNo && usbControlNo.trim())
        const hasSmartDevice = Boolean(smartDeviceControlNo && smartDeviceControlNo.trim())
        if (!hasCamera && !hasUsb && !hasSmartDevice) {
          setError('Pilih minimal 1 perangkat yang dipinjam (Kamera, USB Flashdisk, atau Smart Device).')
          return
        }
      }
      const payload = {
        requestType: locale,
        requesterName,
        requesterEmail: isInternal ? requesterEmail.trim() || null : null,
        deptOrCompany,
        fromAt: fromDate && fromTime ? new Date(`${fromDate}T${fromTime}`).toISOString() : '',
        toAt: toDate && toTime ? new Date(`${toDate}T${toTime}`).toISOString() : '',
        location,
        objective,
        // Visitor requests are always routed to whichever PIC is configured
        // as the Visitor default — the server resolves it and ignores
        // picApproveId entirely for this type (see /api/photo-video-requests).
        ...(isInternal
          ? {
              nik,
              deptPicKamera: selectedCameraDept?.name ?? '',
              deptPicKameraSection: selectedCameraSection?.name ?? null,
              cameraControlNo: cameraControlNo.trim() || null,
              photoIdNo: photoIdNo.trim() || null,
              usbControlNo: usbControlNo.trim() || null,
              smartDeviceControlNo: smartDeviceControlNo.trim() || null,
              picApproveId,
            }
          : { dept, cameraSerialNo, photoIdNo }),
        ...(isStaff ? { escortName: escort?.name ?? null, escortDept: escort?.dept ?? null } : {}),
      }
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) { setError(data?.message ?? 'Gagal mengirim pengajuan.'); return }
      setSuccessInfo({ id: data?.request?.id, referenceCode: data?.referenceCode ?? `#${data?.request?.id}`, submittedAt: data?.request?.submitted_at ?? new Date().toISOString(), emailed: isInternal && !!requesterEmail.trim() })
      resetForm()
      cardsChanged()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitLabel = isInternal ? 'Kirim Pengajuan' : 'Submit Registration'
  const noteText = isInternal ? 'Lengkapi seluruh kolom di atas sebelum mengirim.' : 'Please complete every field above before submitting.'

  return (
    <div className="mx-auto w-full max-w-4xl">
      <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="h-1 w-full bg-primary" />

        {/* Compact ISMS Document Bar + Step Progress */}
        <div className="flex flex-col gap-3 border-b border-border bg-secondary/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-primary">
              {isInternal ? 'ISMS-F-01-00-002' : 'ISMS-F-005-001'}
            </span>
            <span className="text-xs font-semibold text-foreground">
              {isInternal ? 'Formulir Izin Foto/Video & Peminjaman Kamera/USB' : 'Visitor Photo/Video Recording Registration'}
            </span>
            <span className="hidden text-xs text-muted-foreground md:inline">
              &bull; 写真・ビデオ撮影許可申請書
            </span>
          </div>

          <nav aria-label={isInternal ? 'Langkah pengisian' : 'Form steps'} className="flex items-center gap-1.5">
            {(isInternal ? ['Data Pemohon', 'Info Foto/Video', 'Kirim'] : ['Requester', 'Recording Info', 'Submit']).map((label, index) => (
              <Fragment key={label}>
                {index > 0 && <span aria-hidden className={`h-px w-4 transition-colors duration-300 ${index <= currentStep ? 'bg-primary' : 'bg-border'}`} />}
                <button
                  type="button"
                  onClick={() => document.getElementById(STEP_IDS[index])?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  aria-current={index === currentStep ? 'step' : undefined}
                  className={`flex flex-none items-center gap-1.5 rounded-lg py-1 pl-1.5 pr-2.5 text-[11px] font-semibold transition-colors duration-300 cursor-pointer ${index === currentStep ? 'bg-primary text-primary-foreground' : index < currentStep ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <span className={`grid size-5 place-items-center rounded font-mono text-[10px] font-bold ${index === currentStep ? 'bg-primary-foreground/20' : index < currentStep ? 'bg-primary/15 text-primary' : 'bg-secondary'}`}>{index + 1}</span>
                  <span className={index === currentStep ? '' : 'max-[520px]:hidden'}>{label}</span>
                </button>
              </Fragment>
            ))}
          </nav>
        </div>

        <div className="divide-y divide-border p-6 sm:p-8 [&>div+div]:pt-8 space-y-8">
          <div id="pv-step-1" className="scroll-mt-32 space-y-5">
            <StatusLookup key={initialRef ?? 'none'} isInternal={isInternal} initialRef={initialRef} />
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                01
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  {isInternal ? 'Data Pemohon (Applicant Identity)' : 'Requester Details'}
                </h2>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {isInternal ? 'Identitas karyawan PT. JAI yang mengajukan izin dokumentasi' : 'Visitor identity and organization details'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isInternal && (
                <Field label="NIK">
                  <input value={nik} onChange={(e) => setNik(e.target.value)} placeholder="Nomor Induk Karyawan" className={`${inputClass} font-mono`} />
                </Field>
              )}
              <Field label={isInternal ? 'Nama Lengkap' : 'Full Name'} span={1}>
                <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} autoComplete="name" required className={inputClass} />
              </Field>
              {isInternal ? (
                <>
                  <Field label="Dept.">
                    <select value={deptId} onChange={(e) => { setDeptId(e.target.value); setSectionId(''); setPicApproveId('') }} required className={inputClass}>
                      <option value="">Pilih departemen...</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Seksi">
                    <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!selectedDept || selectedDept.sections.length === 0} className={inputClass}>
                      <option value="">{selectedDept && selectedDept.sections.length === 0 ? 'Tidak ada section' : 'Pilih section (opsional)...'}</option>
                      {selectedDept?.sections.map((section) => (
                        <option key={section.id} value={section.id}>{section.name}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : (
                <Field label="Company / Organization">
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" required className={inputClass} />
                </Field>
              )}
              {!isInternal && (
                <Field label="Department">
                  <input value={dept} onChange={(e) => setDept(e.target.value)} required className={inputClass} />
                </Field>
              )}
              {/* Internal only: a visitor is told the result at the Lobby / Pos Security (or by the status link). */}
              {isInternal && (
                <Field label="Email (opsional)" span={2}>
                  <input type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} placeholder="nama@jai.co.id" autoComplete="email" className={inputClass} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Isi bila ingin menerima hasil keputusan (disetujui/ditolak) lewat email.</p>
                </Field>
              )}
            </div>
          </div>

          <div id="pv-step-2" className="scroll-mt-32 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <span className="grid size-7 place-items-center rounded-lg font-mono text-xs font-bold bg-primary text-primary-foreground">
                02
              </span>
              <div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  {isInternal ? 'Informasi Pengambilan Foto/Video & Perangkat' : 'Recording Photo/Video Information'}
                </h2>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {isInternal ? 'Pilihan kamera/USB/Smart Device terkontrol, approver, jadwal, dan lokasi' : 'Device serial number, schedule, location, and recording objective'}
                </p>
              </div>
            </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isInternal && (
            <>
              <Field label="Dept. PIC Kamera">
                <select
                  value={deptPicKameraId}
                  onChange={(e) => { setDeptPicKameraId(e.target.value); setSectionPicKameraId(''); setCameraControlNo(''); setPhotoIdNo(''); setUsbControlNo(''); setSmartDeviceControlNo('') }}
                  required
                  className={inputClass}
                >
                  <option value="">Pilih Dept. kamera yang dipinjam...</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Seksi PIC Kamera">
                <select
                  value={sectionPicKameraId}
                  onChange={(e) => { setSectionPicKameraId(e.target.value); setCameraControlNo(''); setPhotoIdNo(''); setUsbControlNo(''); setSmartDeviceControlNo('') }}
                  disabled={!selectedCameraDept || selectedCameraDept.sections.length === 0}
                  className={inputClass}
                >
                  <option value="">{selectedCameraDept && selectedCameraDept.sections.length === 0 ? 'Tidak ada section' : 'Pilih section (opsional)...'}</option>
                  {selectedCameraDept?.sections.map((section) => (
                    <option key={section.id} value={section.id}>{section.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="No. Kontrol Kamera (opsional jika hanya pinjam USB/Smart Device)" span={2}>
                <select
                  value={cameraControlNo}
                  onChange={(e) => setCameraControlNo(e.target.value)}
                  className={inputClass}
                  disabled={!deptPicKameraId}
                >
                  <option value="">{!deptPicKameraId ? 'Pilih Dept. PIC Kamera terlebih dahulu...' : 'Tidak Meminjam Kamera (Hanya Pinjam USB / Smart Device)'}</option>
                  {availableCameras.map((cam) => (
                    <option key={cam.id} value={cam.code}>{cam.code}</option>
                  ))}
                </select>
                {deptPicKameraId && availableCameras.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Belum ada kamera terdaftar untuk departemen ini (opsional jika hanya meminjam Flashdisk/Smart Device).</p>
                )}
              </Field>
              <Field label="No. ID Photography (opsional jika tidak pinjam kamera)" span={2}>
                <select
                  value={photoIdNo}
                  onChange={(e) => setPhotoIdNo(e.target.value)}
                  className={inputClass}
                  disabled={!deptPicKameraId}
                >
                  <option value="">{!deptPicKameraId ? 'Pilih Dept. PIC Kamera terlebih dahulu...' : 'Tidak Meminjam Kartu ID Photography (Opsional)'}</option>
                  {availablePhotoIds.map((p) => (
                    <option key={p.id} value={p.code}>{p.code}</option>
                  ))}
                </select>
                {deptPicKameraId && availablePhotoIds.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">Belum ada ID Photography terdaftar untuk departemen ini (opsional jika hanya meminjam Flashdisk/Smart Device).</p>
                )}
              </Field>
              <Field label="No. Kontrol USB (opsional)" span={2}>
                <select
                  value={usbControlNo}
                  onChange={(e) => setUsbControlNo(e.target.value)}
                  className={inputClass}
                  disabled={!deptPicKameraId}
                >
                  <option value="">{!deptPicKameraId ? 'Pilih Dept. PIC Kamera terlebih dahulu...' : 'Tidak Meminjam Flashdisk / USB (Opsional)'}</option>
                  {availableUsbs.map((u) => (
                    <option key={u.id} value={u.code}>{u.code}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">Opsional — dapat dipinjam secara fleksibel (bersama kamera atau berdiri sendiri tanpa kamera).</p>
              </Field>
              <Field label="No. Kontrol Smart Device (opsional)" span={2}>
                <select
                  value={smartDeviceControlNo}
                  onChange={(e) => setSmartDeviceControlNo(e.target.value)}
                  className={inputClass}
                  disabled={!deptPicKameraId}
                >
                  <option value="">{!deptPicKameraId ? 'Pilih Dept. PIC Kamera terlebih dahulu...' : 'Tidak Meminjam Smart Device (Opsional)'}</option>
                  {availableSmartDevices.map((s) => (
                    <option key={s.id} value={s.code}>{s.code}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">Opsional — pilih nomor kontrol Smart Device jika Anda meminjam Tablet / HP khusus (bisa bersama kamera atau tanpa kamera).</p>
              </Field>
            </>
          )}
          {!isInternal && (
            <>
              <Field label="Serial No. Kamera / Smart Device" span={2}>
                <input value={cameraSerialNo} onChange={(e) => setCameraSerialNo(e.target.value)} placeholder="Contoh: PRIBADI" className={inputClass} />
                <p className="mt-1 text-[11px] text-muted-foreground">Opsional — isi &quot;PRIBADI&quot; jika menggunakan kamera / HP / Smart Device milik sendiri.</p>
              </Field>
              <Field label="No ID Photography" span={2}>
                <div className="relative">
                  <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={photoIdNo} onChange={(e) => setPhotoIdNo(e.target.value)} placeholder="Scan atau ketik ID..." className={`${inputClass} pl-10`} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Opsional — scan kartu ID Photography atau ketik manual nomornya.</p>
              </Field>
            </>
          )}
          {isInternal ? (
            <Field label="PIC Approve" span={2}>
              <select
                value={picApproveId}
                onChange={(e) => setPicApproveId(e.target.value)}
                required
                className={inputClass}
                disabled={!deptId}
              >
                <option value="">
                  {!deptId ? 'Pilih Dept. terlebih dahulu...' : 'Pilih PIC yang akan menyetujui...'}
                </option>
                {displayedPics.map((pic) => (
                  <option key={pic.id} value={pic.id}>
                    {pic.name}
                  </option>
                ))}
              </select>
              {deptId && displayedPics.length === 0 && (
                <p className="mt-1 text-[11px] text-destructive">
                  Belum ada PIC Approve terdaftar untuk departemen ini — hubungi Admin ISMS.
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pilih PIC / Approver di departemen Anda yang berwenang menyetujui izin foto/video.
              </p>
            </Field>
          ) : (
            <Field label="Approver Izin Foto/Video" span={2}>
              <div className={`${inputClass} flex items-center justify-between bg-muted/40 font-semibold text-foreground`}>
                <span>{visitorApprover?.fullName || 'Teguh Sunjoyo'}</span>
                <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {visitorApprover?.title || 'Information Assets Administrator'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Pengajuan izin pengambilan foto/video untuk Visitor otomatis diteruskan ke Approver di atas ({visitorApprover?.fullName || 'Bpk. Teguh Sunjoyo'}) — tidak perlu memilih.
              </p>
            </Field>
          )}
          {isStaff && (
            <Field label="PIC Pendamping JAI (opsional)" span={2}>
              <select value={escortChoice} onChange={(e) => setEscortChoice(e.target.value)} aria-label="PIC Pendamping JAI" className={inputClass}>
                <option value="">Belum ditentukan — bisa dipilih nanti di rekap</option>
                <EscortOptions escorts={escorts} />
                <option value={ESCORT_OTHER}>Lainnya (ketik nama)…</option>
              </select>
              {escortChoice === ESCORT_OTHER && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input value={escortName} onChange={(e) => setEscortName(e.target.value)} placeholder="Nama PIC pendamping JAI" maxLength={150} className={inputClass} />
                  <input value={escortDept} onChange={(e) => setEscortDept(e.target.value)} placeholder="Dept./Seksi (opsional)" maxLength={150} className={inputClass} />
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">Karyawan yang mendampingi selama pengambilan foto/video. Daftar namanya diatur Admin ISMS di Izin Area Special → Daftar PIC Pendamping JAI.</p>
            </Field>
          )}
          <Field label={isInternal ? 'Dari Tanggal' : 'From Date'}>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Sampai Tanggal' : 'To Date'}>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Dari Jam' : 'From Time'}>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="time" value={fromTime} onChange={(e) => {
                const next = e.target.value
                setFromTime(next)
                // On the same day the end can't come before the start: push it to an hour later.
                if (fromDate === toDate && next && (!toTime || toTime <= next)) setToTime(hourAfter(next))
              }} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <Field label={isInternal ? 'Sampai Jam' : 'To Time'}>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="time"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                required
                className={`${inputClass} pl-10`}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isInternal
                ? 'Catatan: Jam aktual pengembalian kamera / USB / Smart Device akan dicatat saat alat diserahkan kembali.'
                : 'Expected return time.'}
            </p>
          </Field>
          <Field label={isInternal ? 'Lokasi' : 'Location'}>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={location} onChange={(e) => setLocation(e.target.value)} required className={`${inputClass} pl-10`} />
            </div>
          </Field>
            <Field label={isInternal ? 'Tujuan' : 'Objective'}>
              <input value={objective} onChange={(e) => setObjective(e.target.value)} required className={inputClass} />
            </Field>
          </div>
        </div>

        <div id="pv-step-3" className="scroll-mt-32 border-t border-border bg-secondary/25 px-6 py-4 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">{noteText}</p>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-xs transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Mengirim...' : <><Send className="size-4" />{submitLabel}</>}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
          )}
          {successInfo && (
            <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
              <p className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="size-4 flex-none" />
                {isInternal ? 'Pengajuan terkirim' : 'Registration submitted'} &middot; {new Date(successInfo.submittedAt).toLocaleString('id-ID')}
              </p>
              {successInfo.id != null && (() => {
                // A link that opens this page with the status already checked — easy to keep or forward.
                const statusLink = typeof window === 'undefined' ? '' : `${window.location.origin}${API_BASE_PATH}/ijin-foto-video?type=${locale}&ref=${encodeURIComponent(successInfo.referenceCode)}`
                const copyLink = async () => {
                  try { await navigator.clipboard.writeText(statusLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) } catch { /* the link is selectable below */ }
                }
                return (
                  <div className="mt-2 pl-6 text-xs">
                    <p>
                      {isInternal ? 'Kode referensi: ' : 'Reference code: '}
                      <strong className="font-mono text-sm select-all">{successInfo.referenceCode}</strong>
                    </p>
                    <p className="mt-1.5">{isInternal ? 'Link status pengajuan Anda — simpan atau bagikan:' : 'Your status link — keep or share it:'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <a href={statusLink} className="min-w-0 break-all font-mono text-[11px] text-primary underline">{statusLink}</a>
                      <button type="button" onClick={copyLink} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground transition hover:bg-secondary cursor-pointer">
                        {linkCopied ? (
                          <>
                            <Check className="size-3 text-emerald-600" />
                            <span>{isInternal ? 'Tersalin' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3 text-muted-foreground" />
                            <span>{isInternal ? 'Salin link' : 'Copy link'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-1.5 text-muted-foreground">
                      {successInfo.emailed
                        ? (isInternal ? 'Hasil keputusan juga akan dikirim ke email Anda.' : 'The decision will also be sent to your email.')
                        : (isInternal ? 'Buka link ini (atau "Cek status pengajuan saya" di atas) untuk melihat hasilnya atau membatalkan pengajuan.' : 'Open this link (or "Cek status pengajuan saya" above) to see the decision or cancel the request.')}
                    </p>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
        </div>
      </form>
    </div>
  )
}
