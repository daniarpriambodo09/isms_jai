// app/kelola-permintaan-foto-video/page.tsx

'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Camera,
  Check,
  Eye,
  Loader2,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  UserCog,
  Users,
  X,
  Building2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Smartphone,
  CreditCard,
  ShieldCheck,
  Info,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { PhotoVideoDecisionModal, type PhotoVideoRequest } from '@/components/documents/PhotoVideoDecisionModal'
import { VisitorApproverSettings } from '@/components/documents/VisitorApproverSettings'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/pagination'
import { usePagination } from '@/hooks/usePagination'

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Menyetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

const TYPE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Semua Tipe' },
  { value: 'internal', label: 'Internal' },
  { value: 'visitor', label: 'Visitor' },
]

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-[#fff3d6] text-[#8a6100]',
  approved: 'bg-[#dff5e6] text-[#1a6e3a]',
  rejected: 'bg-[#fdecec] text-[#b3413a]',
}
const STATUS_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' }

function KelolaPermintaanFotoVideoContent() {
  const { isLoading, adminUser, sessionUser } = useAuth()
  const isApproverAdmin = sessionUser?.role === 'ism_admin' || sessionUser?.role === 'it'
  const isApprover = sessionUser?.role === 'approver'
  const userDept = sessionUser?.department || null

  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? '')
  const [deptFilter, setDeptFilter] = useState(searchParams.get('dept') ?? '')
  const [availableDepts, setAvailableDepts] = useState<string[]>([])

  const [query, setQuery] = useState('')
  const [requests, setRequests] = useState<PhotoVideoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PhotoVideoRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PhotoVideoRequest | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Pickup ("Sudah Diambil") state
  const [pendingMarkTaken, setPendingMarkTaken] = useState<PhotoVideoRequest | null>(null)
  const [markingTaken, setMarkingTaken] = useState(false)
  const [unmarkingId, setUnmarkingId] = useState<number | null>(null)

  // Return ("Catat Kembali") state & detailed checklist
  const [pendingReturn, setPendingReturn] = useState<PhotoVideoRequest | null>(null)
  const [returnCondition, setReturnCondition] = useState<'good' | 'issue'>('good')
  const [camChecked, setCamChecked] = useState(true)
  const [idChecked, setIdChecked] = useState(true)
  const [usbChecked, setUsbChecked] = useState(true)
  const [smartChecked, setSmartChecked] = useState(true)
  const [dataWipedChecked, setDataWipedChecked] = useState(true)
  const [virusCheck, setVirusCheck] = useState(true)
  const [isDelete, setIsDelete] = useState(true)
  const [isFormat, setIsFormat] = useState(false)
  const [returnedBy, setReturnedBy] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [returning, setReturning] = useState(false)
  const [unmarkingReturnId, setUnmarkingReturnId] = useState<number | null>(null)

  const [resendingId, setResendingId] = useState<number | null>(null)
  const [resendNotice, setResendNotice] = useState<string | null>(null)
  const [activeApprover, setActiveApprover] = useState<{ id: number; fullName: string | null; title: string | null; email: string | null } | null>(null)

  // Load departments list for department filter tabs
  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`)
      .then((res) => res.json())
      .then((data) => {
        if (data.departments && Array.isArray(data.departments)) {
          const names: string[] = data.departments.map((d: any) => d.name)
          setAvailableDepts(names)
        }
      })
      .catch(() => {})
  }, [])

  // If user is approver with specific department, auto-default dept filter if not set
  useEffect(() => {
    if (isApprover && userDept && !deptFilter && !searchParams.get('dept')) {
      setDeptFilter(userDept)
    }
  }, [isApprover, userDept, deptFilter, searchParams])

  const loadApprover = useCallback(() => {
    fetch(`${API_BASE_PATH}/api/pic-approvers/visitor-default`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { approver: null }))
      .then((data: { approver: { id: number; fullName: string | null; title: string | null; email: string | null } | null }) => {
        if (data?.approver) setActiveApprover(data.approver)
      })
      .catch(() => {})
  }, [])

  const resendApprovalEmail = async (req: PhotoVideoRequest) => {
    setResendingId(req.id)
    setResendNotice(null)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${req.id}/resend`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Gagal mengirim ulang email.')
      setResendNotice(`Email persetujuan untuk ${req.requester_name} berhasil dikirim ulang ke approver.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim ulang email.')
    } finally {
      setResendingId(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter) params.set('type', typeFilter)
      if (deptFilter && deptFilter !== 'all') params.set('dept', deptFilter)
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)
      setRequests(data.requests ?? [])
      setError(null)
    } catch (e) {
      setRequests([])
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar pengajuan.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, deptFilter])

  useEffect(() => {
    if (sessionUser) {
      load()
      loadApprover()
    }
  }, [sessionUser, load, loadApprover])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal menghapus pengajuan.')
        setDeleting(false)
        setPendingDelete(null)
        return
      }
      await load()
    } catch {
      setError('Tidak dapat menghubungi server.')
    }
    setDeleting(false)
    setPendingDelete(null)
  }

  const confirmMarkTaken = async () => {
    if (!pendingMarkTaken) return
    setMarkingTaken(true)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${pendingMarkTaken.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-taken' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal menandai pengajuan.')
        setMarkingTaken(false)
        setPendingMarkTaken(null)
        return
      }
      await load()
    } catch {
      setError('Tidak dapat menghubungi server.')
    }
    setMarkingTaken(false)
    setPendingMarkTaken(null)
  }

  const unmarkTaken = async (req: PhotoVideoRequest) => {
    setUnmarkingId(req.id)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unmark-taken' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal membatalkan tanda.')
        return
      }
      await load()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setUnmarkingId(null)
    }
  }

  const openReturnModal = (req: PhotoVideoRequest) => {
    setPendingReturn(req)
    setReturnCondition('good')
    setCamChecked(true)
    setIdChecked(true)
    setUsbChecked(true)
    setSmartChecked(true)
    setDataWipedChecked(true)
    setVirusCheck(true)
    setIsDelete(true)
    setIsFormat(false)
    setReturnedBy(sessionUser?.username || 'PIC Departemen')
    setReturnNotes('')
  }

  const confirmReturn = async () => {
    if (!pendingReturn) return
    setReturning(true)
    try {
      const conditionSummary = returnCondition === 'good' ? 'Kondisi: Baik & Lengkap' : 'Kondisi: Ada Kendala / Kerusakan'
      const itemsList: string[] = []
      if (pendingReturn.camera_control_no) itemsList.push(`Kamera (${pendingReturn.camera_control_no}): ${camChecked ? 'Lengkap/OK' : 'Bermasalah'}`)
      if (pendingReturn.photo_id_no) itemsList.push(`ID (${pendingReturn.photo_id_no}): ${idChecked ? 'Kembali' : 'Belum Kembali'}`)
      if (pendingReturn.usb_control_no) itemsList.push(`USB (${pendingReturn.usb_control_no}): ${usbChecked ? 'Kembali/OK' : 'Bermasalah'}`)
      if (pendingReturn.smart_device_control_no) itemsList.push(`Smart (${pendingReturn.smart_device_control_no}): ${smartChecked ? 'Lengkap/OK' : 'Bermasalah'}`)
      if (virusCheck) itemsList.push('Virus Check: OK')
      const deleteOrFormat = isDelete && isFormat ? 'delete_format' : isDelete ? 'delete' : isFormat ? 'format' : null
      if (deleteOrFormat) itemsList.push(`Sanitasi: ${deleteOrFormat.toUpperCase()}`)
      if (dataWipedChecked) itemsList.push('SOP ISMS: File Checked')

      const combinedNotes = `[${conditionSummary}] ${itemsList.join(' · ')}${returnNotes.trim() ? ` — Catatan: ${returnNotes.trim()}` : ''}`

      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${pendingReturn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-returned',
          returnedBy: returnedBy.trim() || sessionUser?.username || 'PIC Departemen',
          returnNotes: combinedNotes,
          virusCheck,
          deleteOrFormat,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal mencatat pengembalian.')
        return
      }
      setPendingReturn(null)
      await load()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setReturning(false)
    }
  }

  const unmarkReturned = async (req: PhotoVideoRequest) => {
    setUnmarkingReturnId(req.id)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unmark-returned' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal membatalkan pengembalian.')
        return
      }
      await load()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setUnmarkingReturnId(null)
    }
  }

  // Check if current user has permission to manage actions on a specific request
  const canManageRow = (req: PhotoVideoRequest) => {
    if (isApproverAdmin) return true
    if (sessionUser?.role === 'lobby' || sessionUser?.role === 'security') return true
    if (isApprover) {
      if (!userDept) return true
      if (req.dept_pic_kamera && userDept.toLowerCase().trim() === req.dept_pic_kamera.toLowerCase().trim()) return true
    }
    return false
  }

  const filteredRequests = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return requests
    return requests.filter((req) =>
      req.requester_name.toLowerCase().includes(value) ||
      (req.nik ?? '').toLowerCase().includes(value) ||
      req.dept_or_company.toLowerCase().includes(value) ||
      (req.dept_pic_kamera ?? '').toLowerCase().includes(value) ||
      (req.camera_control_no ?? '').toLowerCase().includes(value) ||
      (req.usb_control_no ?? '').toLowerCase().includes(value) ||
      req.location.toLowerCase().includes(value)
    )
  }, [requests, query])

  // Count active borrowed equipment per department
  const borrowedByDept = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of requests) {
      if (r.status === 'approved' && r.taken_at && !r.returned_at && r.dept_pic_kamera) {
        counts[r.dept_pic_kamera] = (counts[r.dept_pic_kamera] || 0) + 1
      }
    }
    return counts
  }, [requests])

  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filteredRequests, 20)

  // Auth gate check
  const canAccess = sessionUser && (sessionUser.role === 'ism_admin' || sessionUser.role === 'it' || sessionUser.role === 'approver' || sessionUser.role === 'lobby' || sessionUser.role === 'security')
  if (!isLoading && !canAccess) {
    return <AdminGate message="Halaman ini khusus untuk Admin ISMS, IT, atau Approver / PIC Departemen. Masuk terlebih dahulu untuk melanjutkan." />
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <Settings className="size-3.5" /> Manajemen Peralatan Foto, Video &amp; USB
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Permintaan Foto/Video &amp; Peminjaman Alat</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">
              Kelola izin foto/video, serah terima pengambilan alat, dan pencatatan pengembalian kamera/USB per departemen pemilik aset.
            </p>
          </div>
          {isApproverAdmin && (
            <div className="flex flex-wrap gap-2">
              <VisitorApproverSettings
                onSaved={(appr) => setActiveApprover(appr)}
                triggerButton={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/25 bg-primary-foreground/15 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/25 shadow-xs"
                  >
                    <UserCog className="size-4" /> Setting Approver
                  </button>
                }
              />
              <Link
                href="/kelola-pic-approve"
                className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20"
              >
                <Users className="size-4" /> Kelola PIC Approve
              </Link>
              <Link
                href="/kelola-kamera"
                className="inline-flex items-center gap-2 rounded-lg border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/20"
              >
                <Camera className="size-4" /> Kelola Kontrol Kamera
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Mode Informasi Departemen untuk Akun Approver / PIC */}
      {isApprover && userDept && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-4 text-xs text-foreground shadow-xs">
          <Building2 className="size-5 shrink-0 text-primary" />
          <div className="space-y-0.5">
            <p className="font-bold">
              Mode PIC Departemen: <span className="text-primary">{userDept}</span>
            </p>
            <p className="text-muted-foreground">
              Sebagai PIC / Pemilik Aset Departemen <strong className="text-foreground">{userDept}</strong>, Anda berwenang menandai saat pemohon mengambil barang (<strong>Sudah Diambil</strong>) dan melakukan checklist pemeriksaan fisik saat perangkat dikembalikan (<strong>Catat Kembali</strong>).
            </p>
          </div>
        </div>
      )}

      {/* Active Approver Banner (Admin only) */}
      {isApproverAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-card p-4 sm:px-6 shadow-xs">
          <div className="flex items-center gap-3.5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
              <UserCog className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Approver Resmi Foto/Video:</span>
                <span className="font-bold text-foreground text-sm">
                  {activeApprover?.fullName || 'Teguh Sunjoyo'}
                </span>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {activeApprover?.title || 'Information Assets Administrator'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Nama dan jabatan ini otomatis dicetak di bawah barcode QR persetujuan pada dokumen resmi.
                {activeApprover?.email && ` · Email otorisasi: ${activeApprover.email}`}
              </p>
            </div>
          </div>
          <VisitorApproverSettings
            onSaved={(appr) => setActiveApprover(appr)}
            triggerButton={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-secondary"
              >
                <Settings className="size-3.5" /> Ubah Setting Approver
              </button>
            }
          />
        </div>
      )}

      {/* FILTER DEPARTEMEN PEMILIK BARANG (DEPT. PIC KAMERA) */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Building2 className="size-4 text-primary" />
            <span>Filter Departemen Pemilik Barang (Dept. PIC Kamera / USB):</span>
          </div>
          {deptFilter && (
            <button
              type="button"
              onClick={() => setDeptFilter('')}
              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
            >
              Reset ke Semua Departemen
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDeptFilter('')}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              !deptFilter
                ? 'border-transparent bg-primary text-primary-foreground shadow-2xs'
                : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            Semua Departemen ({requests.length})
          </button>
          {availableDepts.map((dName) => {
            const activeBorrowed = borrowedByDept[dName] || 0
            const isSelected = deptFilter.toLowerCase().trim() === dName.toLowerCase().trim()
            return (
              <button
                key={dName}
                type="button"
                onClick={() => setDeptFilter(dName)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  isSelected
                    ? 'border-transparent bg-primary text-primary-foreground shadow-2xs'
                    : 'border-border bg-card text-foreground hover:bg-secondary'
                }`}
              >
                <span>{dName}</span>
                {activeBorrowed > 0 && (
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isSelected ? 'bg-primary-foreground text-primary' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {activeBorrowed} dipinjam
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* FILTER STATUS & TIPE PENGAJUAN */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                statusFilter === tab.value
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTypeFilter(tab.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                typeFilter === tab.value
                  ? 'border-transparent bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama pemohon, NIK, lokasi, no kamera, no USB..."
          className="h-10 w-full max-w-sm rounded-xl border border-input bg-card pl-10 pr-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15"
        />
      </div>

      {resendNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 shadow-sm">
          <span>{resendNotice}</span>
          <button type="button" onClick={() => setResendNotice(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {/* TABEL PENGAJUAN */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="admin-table w-full min-w-[950px] text-sm">
            <thead className="bg-secondary/55">
              <tr>
                {['Tanggal', 'Tipe', 'Nama/NIK', 'Dept Pemohon', 'Dept. Pemilik Barang', 'Lokasi', 'Perangkat Dipinjam', 'Status & Riwayat', 'Aksi'].map((head) => (
                  <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={9} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat...</p></td></tr>
              )}
              {!loading && requests.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-16 text-center"><Camera className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">Tidak ada pengajuan</p></td></tr>
              )}
              {!loading && requests.length > 0 && filteredRequests.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-16 text-center text-sm text-muted-foreground">Tidak ada yang cocok dengan pencarian / filter ini.</td></tr>
              )}
              {!loading && pageItems.map((req, index) => {
                const canManage = canManageRow(req)
                return (
                  <tr key={req.id} className={index % 2 ? 'bg-secondary/20' : ''}>
                    <td data-label="Diajukan" className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(req.submitted_at)}</td>
                    <td data-label="Tipe" className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        req.request_type === 'internal' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      }`}>
                        {req.request_type === 'internal' ? 'Internal' : 'Visitor'}
                      </span>
                    </td>
                    <td data-cell="title" className="min-w-[150px] px-4 py-3 font-medium text-foreground">
                      {req.requester_name}
                      {req.nik && <span className="block text-xs text-muted-foreground font-mono">NIK: {req.nik}</span>}
                      {(req.companions?.length ?? 0) > 0 && (
                        <span className="block text-[11px] text-muted-foreground font-normal" title={req.companions?.map((c) => c.name).join(', ')}>
                          + {req.companions?.length} orang: {req.companions?.map((c) => c.name).join(', ')}
                        </span>
                      )}
                    </td>
                    <td data-label="Dept Pemohon" className="px-4 py-3 text-xs text-muted-foreground">{req.dept_or_company}</td>
                    
                    {/* DEPARTEMEN PEMILIK BARANG (Dept. PIC Kamera) */}
                    <td data-label="Dept. Pemilik" className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary font-mono whitespace-nowrap">
                        <Building2 className="size-3" />
                        {req.dept_pic_kamera || '—'}
                      </span>
                    </td>

                    <td data-label="Lokasi" className="px-4 py-3 text-xs text-muted-foreground">{req.location}</td>

                    {/* PERANGKAT DIPINJAM */}
                    <td data-label="Perangkat" className="whitespace-nowrap px-4 py-3 text-xs">
                      {req.camera_control_no ? (
                        <span className="block font-mono text-[11px] font-bold text-foreground">
                          📷 Cam: {req.camera_control_no}
                        </span>
                      ) : (
                        <span className="block text-[10px] text-muted-foreground italic">Tidak pinjam kamera</span>
                      )}
                      {req.usb_control_no && (
                        <span className="block font-mono text-[11px] font-bold text-primary">
                          💾 USB: {req.usb_control_no}
                        </span>
                      )}
                      {req.photo_id_no && (
                        <span className="block font-mono text-[10.5px] text-muted-foreground">
                          💳 ID: {req.photo_id_no}
                        </span>
                      )}
                      {req.companions?.filter((c) => c.photo_id_no).map((c, i) => (
                        <span key={i} className="block font-mono text-[10px] text-muted-foreground">
                          💳 ID {c.name}: {c.photo_id_no}
                        </span>
                      ))}
                      {req.smart_device_control_no && (
                        <span className="block font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                          📱 Smart: {req.smart_device_control_no}
                        </span>
                      )}
                    </td>

                    {/* STATUS & RIWAYAT PENGAMBILAN/PENGEMBALIAN */}
                    <td data-label="Status" className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[req.status]}`}>
                        {STATUS_LABEL[req.status]}
                      </span>
                      {req.status === 'pending' && new Date(req.to_at).getTime() < Date.now() && (
                        <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-destructive" title="Periode yang diajukan sudah lewat tapi belum diputuskan">
                          <AlertTriangle className="size-3" /> Terlewat
                        </span>
                      )}
                      {req.taken_at && (
                        <span className="mt-1 block text-[10px] font-semibold text-accent-foreground">
                          {req.taken_ack_at ? 'Sudah diambil · dikonfirmasi' : 'Sudah diambil'}
                        </span>
                      )}
                      {req.returned_at ? (
                        <div className="mt-1 flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Check className="size-3 text-emerald-600" />
                            <span>Kembali: {formatDateTime(req.returned_at)}</span>
                          </span>
                          {req.returned_by && (
                            <span className="text-[10px] text-muted-foreground">
                              Penerima: <strong className="text-foreground">{req.returned_by}</strong>
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {req.virus_check && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 font-mono text-[9px] font-bold border border-emerald-300">
                                <Check className="size-2.5 text-emerald-600" /> Virus Check: OK
                              </span>
                            )}
                            {req.delete_or_format && (
                              <span className="inline-flex items-center rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 font-mono text-[9px] font-semibold border border-sky-300">
                                {req.delete_or_format === 'delete' ? 'Deleted' : req.delete_or_format === 'format' ? 'Formatted' : 'Del & Fmt'}
                              </span>
                            )}
                          </div>
                          {req.return_notes && (
                            <span className="text-[9.5px] text-muted-foreground/85 italic max-w-[190px] truncate" title={req.return_notes}>
                              {req.return_notes}
                            </span>
                          )}
                        </div>
                      ) : req.taken_at ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Dipinjam (Belum Kembali)
                        </span>
                      ) : null}
                    </td>

                    {/* AKSI (TINJAU, SUDAH DIAMBIL, CATAT KEMBALI) */}
                    <td data-cell="actions" className="w-px px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap min-[760px]:grid min-[760px]:grid-cols-[4rem_7rem_7rem_2rem_2rem]">
                        {isApproverAdmin && req.status === 'pending' ? (
                          <button type="button" onClick={() => setSelected(req)} className="rounded-md bg-primary px-3 py-1.5 text-center text-xs font-semibold text-primary-foreground transition hover:opacity-90 cursor-pointer">
                            Tinjau
                          </button>
                        ) : (
                          <button type="button" onClick={() => setSelected(req)} className="rounded-md border border-border px-3 py-1.5 text-center text-xs font-semibold text-foreground transition hover:bg-secondary cursor-pointer">
                            Lihat
                          </button>
                        )}

                        {/* Pengambilan: Tombol "Sudah Diambil" */}
                        {canManage && req.status === 'approved' && !req.taken_at ? (
                          <button
                            type="button"
                            onClick={() => setPendingMarkTaken(req)}
                            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-center text-xs font-bold text-primary transition hover:bg-primary/20 cursor-pointer"
                          >
                            Sudah Diambil
                          </button>
                        ) : canManage && req.status === 'approved' && req.taken_at && !req.returned_at ? (
                          <button
                            type="button"
                            onClick={() => unmarkTaken(req)}
                            disabled={unmarkingId === req.id}
                            className="rounded-md border border-border px-3 py-1.5 text-center text-xs font-semibold text-muted-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                          >
                            {unmarkingId === req.id ? '...' : 'Batal Ambil'}
                          </button>
                        ) : <span className="hidden min-[760px]:block" />}

                        {/* Pengembalian: Tombol "Catat Kembali" (Khusus Dept Pemilik / Admin / Lobby) */}
                        {canManage && req.status !== 'rejected' && ((req.status === 'approved' && req.taken_at) || req.request_type === 'visitor' || Boolean(req.photo_id_no)) && !req.returned_at ? (
                          <button
                            type="button"
                            onClick={() => openReturnModal(req)}
                            className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-center text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700 cursor-pointer flex items-center justify-center gap-1"
                          >
                            <RotateCcw className="size-3" />
                            <span>Catat Kembali</span>
                          </button>
                        ) : canManage && req.returned_at ? (
                          <button
                            type="button"
                            onClick={() => unmarkReturned(req)}
                            disabled={unmarkingReturnId === req.id}
                            className="rounded-md border border-border px-2.5 py-1.5 text-center text-xs font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-50 cursor-pointer"
                          >
                            {unmarkingReturnId === req.id ? '...' : 'Batal Kembali'}
                          </button>
                        ) : <span className="hidden min-[760px]:block" />}

                        {/* PDF View */}
                        {req.status !== 'pending' ? (
                          <a
                            href={`${API_BASE_PATH}/api/photo-video-requests/${req.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Lihat surat pengajuan PDF ${req.requester_name}`}
                            title="Lihat surat pengajuan resmi PDF"
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                          >
                            <Eye className="size-3.5" />
                          </a>
                        ) : <span className="hidden min-[760px]:block" />}

                        {/* Hapus Pengajuan (Hanya Admin ISMS/IT) */}
                        {isApproverAdmin && (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(req)}
                            aria-label={`Hapus pengajuan ${req.requester_name}`}
                            title="Hapus pengajuan"
                            className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRequests.length} pageSize={pageSize} />
      </div>

      {selected && (
        <PhotoVideoDecisionModal request={selected} onClose={() => setSelected(null)} onDecided={load} readOnly={!isApproverAdmin} />
      )}

      {/* DIALOG KONFIRMASI PENGHAPUSAN */}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus pengajuan?"
        message={`Pengajuan foto/video dari "${pendingDelete?.requester_name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {/* DIALOG KONFIRMASI PENGAMBILAN ALAT */}
      <ConfirmDialog
        open={!!pendingMarkTaken}
        title="Konfirmasi Perangkat Sudah Diambil"
        message={`Konfirmasi bahwa pemohon "${pendingMarkTaken?.requester_name}" telah mengambil perangkat (Kamera/USB/ID) di ruangan departemen ${pendingMarkTaken?.dept_pic_kamera || ''}.`}
        danger={false}
        confirmLabel="Konfirmasi Diambil"
        pending={markingTaken}
        onConfirm={confirmMarkTaken}
        onCancel={() => setPendingMarkTaken(null)}
      />

      {/* MODAL CHECKLIST PEMERIKSAAN & PENGEMBALIAN BARANG (HANYA PEMILIK BARANG) */}
      {pendingReturn && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <RotateCcw className="size-4 text-emerald-600" />
                  <span>Pemeriksaan &amp; Pengembalian Perangkat</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Khusus PIC Departemen Pemilik Aset: <strong className="text-primary font-mono">{pendingReturn.dept_pic_kamera || 'Departemen Pemilik'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingReturn(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Info Singkat Pemohon */}
            <div className="rounded-2xl border border-border bg-secondary/30 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pemohon:</span>
                <span className="font-bold text-foreground">{pendingReturn.requester_name} ({pendingReturn.dept_or_company})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Lokasi Pengambilan Foto:</span>
                <span className="font-medium text-foreground">{pendingReturn.location}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Waktu Pengembalian Aktual:</span>
                <span className="font-mono font-bold text-emerald-600">{new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>

            {/* CHECKLIST FISIK PERANGKAT YANG DIPINJAM */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                1. Checklist Kelengkapan Barang yang Dikembalikan:
              </label>

              {pendingReturn.camera_control_no && (
                <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer hover:bg-secondary/40 transition">
                  <input
                    type="checkbox"
                    checked={camChecked}
                    onChange={(e) => setCamChecked(e.target.checked)}
                    className="size-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <Camera className="size-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <span className="block font-bold text-xs text-foreground font-mono">
                      Kamera {pendingReturn.camera_control_no}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Fisik unit kamera, lensa &amp; baterai dalam kondisi utuh dan bersih.
                    </span>
                  </div>
                </label>
              )}

              {pendingReturn.photo_id_no && (
                <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer hover:bg-secondary/40 transition">
                  <input
                    type="checkbox"
                    checked={idChecked}
                    onChange={(e) => setIdChecked(e.target.checked)}
                    className="size-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <CreditCard className="size-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <span className="block font-bold text-xs text-foreground font-mono">
                      Kartu ID Photography ({pendingReturn.photo_id_no})
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Kartu nomor izin foto/video dan tali gantungan diserahkan kembali.
                    </span>
                  </div>
                </label>
              )}

              {pendingReturn.usb_control_no && (
                <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer hover:bg-secondary/40 transition">
                  <input
                    type="checkbox"
                    checked={usbChecked}
                    onChange={(e) => setUsbChecked(e.target.checked)}
                    className="size-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <HardDrive className="size-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <span className="block font-bold text-xs text-foreground font-mono">
                      Flashdisk / USB ({pendingReturn.usb_control_no})
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Media penyimpanan USB terkontrol diserahkan kembali.
                    </span>
                  </div>
                </label>
              )}

              {pendingReturn.smart_device_control_no && (
                <label className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer hover:bg-secondary/40 transition">
                  <input
                    type="checkbox"
                    checked={smartChecked}
                    onChange={(e) => setSmartChecked(e.target.checked)}
                    className="size-4 rounded text-emerald-600 accent-emerald-600"
                  />
                  <Smartphone className="size-4 text-primary shrink-0" />
                  <div className="flex-1">
                    <span className="block font-bold text-xs text-foreground font-mono">
                      Smart Device ({pendingReturn.smart_device_control_no})
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      Tablet / HP khusus diserahkan kembali dalam kondisi utuh dan berfungsi normal.
                    </span>
                  </div>
                </label>
              )}

              {/* Data Sanitization SOP ISMS */}
              <label className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dataWipedChecked}
                  onChange={(e) => setDataWipedChecked(e.target.checked)}
                  className="size-4 rounded text-emerald-600 accent-emerald-600"
                />
                <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  Data foto/video telah dipindahkan ke folder aman &amp; memori diperiksa sesuai SOP ISMS.
                </span>
              </label>
            </div>

            {/* 2 TABEL TENGAH SOP: VIRUS CHECK *) & DELETE / FORMAT **) */}
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-primary/15 pb-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="size-4" /> Pemeriksaan Keamanan ISMS (Form Internal):
                </span>
              </div>

              {/* VIRUS CHECK *) */}
              <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 cursor-pointer hover:bg-secondary/40 transition">
                <input
                  type="checkbox"
                  checked={virusCheck}
                  onChange={(e) => setVirusCheck(e.target.checked)}
                  className="mt-0.5 size-4 rounded text-emerald-600 accent-emerald-600"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">VIRUS CHECK *)</span>
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      virusCheck ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {virusCheck ? '[✓] Passed / Aman' : '[ ] Belum Dicek'}
                    </span>
                  </div>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Memori/USB telah dipindai antivirus &amp; dipastikan bersih sebelum data dipindahkan.
                  </span>
                </div>
              </label>

              {/* DELETE / FORMAT **) */}
              <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-foreground">DELETE / FORMAT **)</span>
                  <span className="font-mono text-[10px] text-sky-700 dark:text-sky-300 font-bold bg-sky-50 dark:bg-sky-950 px-1.5 py-0.5 rounded border border-sky-300">
                    {isDelete ? '[✓]' : '[ ]'} DELETE / {isFormat ? '[✓]' : '[ ]'} FORMAT
                  </span>
                </div>
                <span className="block text-[11px] text-muted-foreground">
                  Pilih tindakan pembersihan media penyimpanan/kamera setelah dokumentasi disalin:
                </span>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/30 p-2.5 cursor-pointer hover:bg-secondary/60 transition">
                    <input
                      type="checkbox"
                      checked={isDelete}
                      onChange={(e) => setIsDelete(e.target.checked)}
                      className="size-4 rounded text-sky-600 accent-sky-600"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-foreground block">DELETE</span>
                      <span className="text-[10px] text-muted-foreground block">Hapus file di memori</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/30 p-2.5 cursor-pointer hover:bg-secondary/60 transition">
                    <input
                      type="checkbox"
                      checked={isFormat}
                      onChange={(e) => setIsFormat(e.target.checked)}
                      className="size-4 rounded text-sky-600 accent-sky-600"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-foreground block">FORMAT</span>
                      <span className="text-[10px] text-muted-foreground block">Format bersih total</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* STATUS KONDISI KESELURUHAN */}
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                2. Status Kondisi Fisik Keseluruhan:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReturnCondition('good')}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${
                    returnCondition === 'good'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ring-2 ring-emerald-500/30'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Baik &amp; Lengkap (Normal)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReturnCondition('issue')}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${
                    returnCondition === 'issue'
                      ? 'border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <AlertCircle className="size-4 text-destructive" />
                  <span>Ada Kerusakan / Kendala</span>
                </button>
              </div>
            </div>

            {/* NAMA PIC PENERIMA & CATATAN */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Nama PIC Pemeriksa (Penerima di Departemen Pemilik) <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={returnedBy}
                  onChange={(e) => setReturnedBy(e.target.value)}
                  placeholder="Nama PIC pemeriksa departemen..."
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none focus:border-ring"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Catatan Tambahan Pengembalian (Opsional)
                </label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Contoh: Baterai terisi penuh, kondisi lensa bersih, tidak ada cacat fisik"
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs outline-none focus:border-ring"
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setPendingReturn(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={returning || !returnedBy.trim()}
                onClick={confirmReturn}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                {returning ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                <span>Simpan Pengembalian</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function KelolaPermintaanFotoVideoPage() {
  return (
    <Suspense fallback={null}>
      <KelolaPermintaanFotoVideoContent />
    </Suspense>
  )
}
