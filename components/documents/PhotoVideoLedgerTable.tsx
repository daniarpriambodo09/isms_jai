// components/documents/PhotoVideoLedgerTable.tsx
//
// The Internal/Visitor recap table — columns matching each type's own
// registration form — shared between the full-page ledger (/rekap-foto-video)
// and the compact panel embedded in the Lobby kiosk view, so both stay in
// sync instead of drifting into two copies.
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, Camera, Check, Download, Eye, Loader2, Search, Send, Sparkles, Trash2, Users, RotateCcw, ShieldCheck, CheckCircle2, AlertCircle, HardDrive, Smartphone, CreditCard, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useAuth } from '@/context/AuthContext'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usePagination } from '@/hooks/usePagination'
import { Pagination } from '@/components/pagination'
import { downloadExcel } from '@/lib/excel-export'
import { EscortPicker, useEscortList } from '@/components/escort-picker'

type LedgerRequest = {
  id: number
  request_type: 'internal' | 'visitor'
  nik: string | null
  requester_name: string
  dept_or_company: string
  dept: string | null
  dept_pic_kamera: string | null
  from_at: string
  to_at: string
  location: string
  objective: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  decided_at: string | null
  pic_approve_name: string | null
  camera_control_no: string | null
  photo_id_no: string | null
  camera_serial_no: string | null
  pic_jai: string | null
  escort_name: string | null
  escort_dept: string | null
  escort_set_by: string | null
  taken_at: string | null
  usb_control_no: string | null
  smart_device_control_no: string | null
  returned_at: string | null
  returned_by: string | null
  return_notes: string | null
  virus_check?: boolean | null
  delete_or_format?: string | null
  companions?: Array<{ name: string; nik?: string | null; photo_id_no?: string | null; returned_at?: string | null }> | null
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-[#fff3d6] text-[#8a6100]',
  approved: 'bg-[#dff5e6] text-[#1a6e3a]',
  rejected: 'bg-[#fdecec] text-[#b3413a]',
}
const STATUS_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' }

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function StatusCell({ r }: { r: LedgerRequest }) {
  return (
    <td className="whitespace-nowrap px-4 py-3">
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
      {r.decided_at && <span className="mt-1 block text-[10px] text-muted-foreground">{formatDateTime(r.decided_at)}</span>}
    </td>
  )
}

// canViewPdf: who gets the Visitor "Aksi" (view PDF) column — enabled
// by default so all ledger viewers (including general/public) can view the PDF.
export function PhotoVideoLedgerTable({ canViewPdf = true }: { canViewPdf?: boolean }) {
  const [requests, setRequests] = useState<LedgerRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locale, setLocale] = useState<'internal' | 'visitor'>('internal')
  const [query, setQuery] = useState('')
  const [sortDesc, setSortDesc] = useState(true)
  // Deleting is ISM Admin only (the DELETE API enforces it too) — kiosk
  // staff and the public see the ledger read-only.
  const { adminUser } = useAuth()
  const canDelete = adminUser?.role === 'ism_admin'
  // PIC Pendamping: picked by Lobby / Pos Security / the ISM Admin; everyone else just reads it.
  const canAssignEscort = !!adminUser
  const escorts = useEscortList(canAssignEscort)
  const escortCell = (r: LedgerRequest) => (
    <td className="px-4 py-3 text-xs text-muted-foreground">
      {canAssignEscort ? (
        <EscortPicker
          current={r.escort_name ? { name: r.escort_name, dept: r.escort_dept } : null}
          setBy={r.escort_set_by}
          escorts={escorts}
          closed={r.status === 'rejected'}
          // Approved, still in force and not done yet: someone has to accompany them.
          urgent={r.status === 'approved' && !r.taken_at && Date.parse(r.to_at) > Date.now()}
          onSave={async (choice) => {
            const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${r.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setEscort', ...choice }) }).catch(() => null)
            if (!res?.ok) return false
            const data = await res.json().catch(() => null)
            const saved = data?.request as Pick<LedgerRequest, 'escort_name' | 'escort_dept' | 'escort_set_by'> | undefined
            setRequests((current) => current.map((row) => (row.id === r.id ? { ...row, escort_name: saved?.escort_name ?? null, escort_dept: saved?.escort_dept ?? null, escort_set_by: saved?.escort_set_by ?? null } : row)))
            return true
          }}
        />
      ) : r.escort_name ? <>{r.escort_name}{r.escort_dept && <span className="block text-[11px] text-muted-foreground/80">{r.escort_dept}</span>}</> : '—'}
    </td>
  )
  const [deleteTarget, setDeleteTarget] = useState<LedgerRequest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resendingId, setResendingId] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Return ("Catat Kembali") state — directly executable by device owners without login
  const [pendingReturn, setPendingReturn] = useState<LedgerRequest | null>(null)
  const [returnCondition, setReturnCondition] = useState<'good' | 'issue'>('good')
  const [returnedBy, setReturnedBy] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [submittingReturn, setSubmittingReturn] = useState(false)
  const [returnError, setReturnError] = useState<string | null>(null)

  // Prevent background scroll while return modal is open
  useEffect(() => {
    if (pendingReturn) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [pendingReturn])

  const handleSaveReturn = async () => {
    if (!pendingReturn) return
    if (!returnedBy.trim()) {
      setReturnError('Nama penerima / PIC departemen pemilik barang wajib diisi.')
      return
    }
    setSubmittingReturn(true)
    setReturnError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${pendingReturn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark-returned',
          returnedBy: returnedBy.trim(),
          returnNotes: returnCondition === 'issue'
            ? `[Kondisi: Catatan/Kendala] ${returnNotes.trim() || 'Ada kendala fisik'}`
            : (returnNotes.trim() || null),
          virusCheck: pendingReturn.virus_check ?? true,
          deleteOrFormat: pendingReturn.delete_or_format ?? 'delete',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setReturnError(data.message || 'Gagal mencatat pengembalian.')
        return
      }
      const nowIso = new Date().toISOString()
      setRequests((prev) =>
        prev.map((row) =>
          row.id === pendingReturn.id
            ? {
                ...row,
                returned_at: nowIso,
                returned_by: returnedBy.trim(),
                return_notes: returnCondition === 'issue'
                  ? `[Kondisi: Catatan/Kendala] ${returnNotes.trim() || 'Ada kendala fisik'}`
                  : (returnNotes.trim() || null),
              }
            : row
        )
      )
      setNotice(`Pengembalian perangkat untuk "${pendingReturn.requester_name}" berhasil dicatat oleh ${returnedBy.trim()}.`)
      setPendingReturn(null)
    } catch {
      setReturnError('Tidak dapat menghubungi server.')
    } finally {
      setSubmittingReturn(false)
    }
  }

  const handleResendEmail = async (r: LedgerRequest) => {
    setResendingId(r.id)
    setNotice(null)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${r.id}/resend`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Gagal mengirim ulang email.')
      setNotice(`Email persetujuan untuk ${r.requester_name} berhasil dikirim ulang ke approver.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim ulang email.')
    } finally {
      setResendingId(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/ledger`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRequests(data.requests ?? [])
      setError(null)
    } catch (e) {
      setRequests([])
      setError(e instanceof Error ? e.message : 'Gagal memuat rekap pengajuan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${deleteTarget.id}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message ?? 'Gagal menghapus pengajuan.')
      setRequests((current) => current.filter((r) => r.id !== deleteTarget.id))
      setNotice(`Pengajuan ${deleteTarget.requester_name} dihapus.`)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus pengajuan.')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const deleteButton = (r: LedgerRequest) => (
    <button
      type="button"
      onClick={() => { setNotice(null); setDeleteTarget(r) }}
      aria-label={`Hapus pengajuan ${r.requester_name}`}
      title="Hapus pengajuan"
      className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </button>
  )

  const typedRequests = useMemo(() => requests.filter((r) => r.request_type === locale), [requests, locale])

  const filteredRequests = useMemo(() => {
    const value = query.trim().toLowerCase()
    const base = !value
      ? typedRequests
      : typedRequests.filter((r) =>
          r.requester_name.toLowerCase().includes(value) ||
          (r.nik ?? '').toLowerCase().includes(value) ||
          r.dept_or_company.toLowerCase().includes(value) ||
          (r.dept ?? '').toLowerCase().includes(value) ||
          (r.pic_jai ?? '').toLowerCase().includes(value) ||
          r.location.toLowerCase().includes(value) ||
          r.objective.toLowerCase().includes(value)
        )
    const sorted = [...base].sort((a, b) =>
      sortDesc
        ? new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
        : new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    )
    return sorted
  }, [typedRequests, query, sortDesc])

  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filteredRequests, 25)
  useEffect(() => { setPage(1) }, [query, locale, setPage])

  const handleExportCsv = () => {
    if (locale === 'internal') {
      downloadExcel(
        `rekap-foto-video-internal-${new Date().toISOString().slice(0, 10)}.xlsx`,
        ['Tanggal Daftar', 'NIK', 'Nama', 'Dept/Seksi', 'Dept. PIC Kamera', 'No. Kontrol Kamera', 'No. ID Photography', 'No. Kontrol USB', 'No. Kontrol Smart Device', 'PIC Approve', 'PIC Pendamping JAI', 'Dari', 'Sampai', 'Waktu Dikembalikan', 'VIRUS CHECK *)', 'DELETE / FORMAT **)', 'Lokasi', 'Tujuan', 'Status', 'Tanggal Keputusan'],
        filteredRequests.map((r) => [
          formatDateTime(r.submitted_at),
          r.nik ?? '',
          r.requester_name,
          r.dept_or_company,
          r.dept_pic_kamera ?? '',
          r.camera_control_no ?? '',
          r.photo_id_no ?? '',
          r.usb_control_no ?? '',
          r.smart_device_control_no ?? '',
          r.pic_approve_name ?? '',
          r.escort_name ? `${r.escort_name}${r.escort_dept ? ` (${r.escort_dept})` : ''}` : '',
          formatDateTime(r.from_at),
          formatDateTime(r.to_at),
          r.returned_at ? formatDateTime(r.returned_at) : 'Belum Dikembalikan',
          r.virus_check ? 'OK' : '—',
          r.delete_or_format ? (r.delete_or_format === 'delete' ? 'Delete' : r.delete_or_format === 'format' ? 'Format' : 'Delete & Format') : '—',
          r.location,
          r.objective,
          STATUS_LABEL[r.status],
          formatDateTime(r.decided_at),
        ])
      )
    } else {
      downloadExcel(
        `rekap-foto-video-visitor-${new Date().toISOString().slice(0, 10)}.xlsx`,
        ['Tanggal Daftar', 'Nama', 'Company / Organization', 'Department', 'PIC JAI', 'Serial No. Kamera', 'No ID Photography', 'PIC Pendamping JAI', 'Dari', 'Sampai', 'Waktu Dikembalikan', 'Lokasi', 'Tujuan', 'Status', 'Tanggal Keputusan'],
        filteredRequests.map((r) => [
          formatDateTime(r.submitted_at),
          r.requester_name,
          r.dept_or_company,
          r.dept ?? '',
          r.pic_jai ?? '',
          r.camera_serial_no ?? '',
          r.photo_id_no ?? '',
          r.escort_name ? `${r.escort_name}${r.escort_dept ? ` (${r.escort_dept})` : ''}` : '',
          formatDateTime(r.from_at),
          formatDateTime(r.to_at),
          r.returned_at ? formatDateTime(r.returned_at) : 'Belum Dikembalikan',
          r.location,
          r.objective,
          STATUS_LABEL[r.status],
          formatDateTime(r.decided_at),
        ])
      )
    }
  }

  const visitorActions = canViewPdf || canDelete || !!adminUser
  const internalColCount = canDelete ? 22 : 21
  const visitorColCount = visitorActions ? 16 : 15

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setLocale('internal')}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${locale === 'internal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="size-3.5" /> Internal
          </button>
          <button
            type="button"
            onClick={() => setLocale('visitor')}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${locale === 'visitor' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Sparkles className="size-3.5" /> Visitor
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div><p className="portal-eyebrow">Controlled ledger</p><p className="mt-1 text-sm text-muted-foreground">{filteredRequests.length} pengajuan{query ? ` dari ${typedRequests.length}` : ''}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSortDesc((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
            <ArrowDownUp className="size-3.5" />{sortDesc ? 'Terbaru dulu' : 'Terlama dulu'}
          </button>
          <button type="button" onClick={handleExportCsv} disabled={filteredRequests.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
            <Download className="size-3.5" />Export Excel
          </button>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, dept, lokasi..." className="w-full rounded-lg border border-input bg-card py-2.5 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/25" />
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-600/20 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          {locale === 'internal' ? (
            <table className="w-full min-w-[1800px] text-sm">
              <thead className="table-head-gradient">
                <tr>
                  {['No', 'Tanggal Daftar', 'NIK', 'Nama', 'Dept/Seksi', 'Dept. PIC Kamera', 'No. Kontrol Kamera', 'No. ID Photography', 'No. Kontrol USB', 'No. Kontrol Smart Device', 'PIC Approve', 'PIC Pendamping JAI', 'Dari', 'Sampai', 'Waktu Dikembalikan', 'VIRUS CHECK *)', 'DELETE / FORMAT **)', 'Lokasi', 'Tujuan', 'Status', ...(canDelete ? ['Aksi'] : [])].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={internalColCount} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat rekap...</p></td></tr>
                )}
                {!loading && filteredRequests.length === 0 && (
                  <tr><td colSpan={internalColCount} className="px-5 py-16 text-center"><Camera className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{query ? 'Tidak ada yang cocok' : 'Belum ada pengajuan'}</p></td></tr>
                )}
                {pageItems.map((r, index) => (
                  <tr key={r.id} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{(page - 1) * pageSize + index + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.submitted_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.nik ?? '—'}</td>
                    <td className="min-w-[140px] px-4 py-3 font-medium text-foreground">
                      <div>{r.requester_name}</div>
                      {(r.companions?.length ?? 0) > 0 && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground font-normal" title={r.companions?.map((c) => c.name).join(', ')}>
                          + {r.companions?.length} orang: {r.companions?.map((c) => c.name).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept_or_company}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept_pic_kamera ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.camera_control_no ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      <div>{r.photo_id_no ?? '—'}</div>
                      {r.companions?.filter((c) => c.photo_id_no).map((c, i) => (
                        <div key={i} className="text-[11px] text-muted-foreground font-mono">
                          {c.photo_id_no} ({c.name})
                        </div>
                      ))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-mono font-medium text-primary">{r.usb_control_no ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">{r.smart_device_control_no ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_approve_name ?? '—'}</td>
                    {escortCell(r)}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.from_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.to_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {r.returned_at ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                            <Check className="size-3 text-emerald-600" />
                            {formatDateTime(r.returned_at)}
                          </span>
                          {r.returned_by && (
                            <p className="text-[10px] text-muted-foreground">
                              PIC: <span className="font-semibold text-foreground">{r.returned_by}</span>
                            </p>
                          )}
                          {r.return_notes && (
                            <p className="text-[10px] italic text-muted-foreground truncate max-w-[150px]" title={r.return_notes}>
                              {r.return_notes}
                            </p>
                          )}
                        </div>
                      ) : r.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingReturn(r)
                            setReturnedBy('')
                            setReturnNotes('')
                            setReturnCondition('good')
                            setReturnError(null)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          <RotateCcw className="size-3" />
                          <span>Catat Kembali</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-mono">
                      {r.virus_check ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-bold">
                          <Check className="size-3 text-emerald-600" /> [✓] Passed
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">[ ] Belum</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-mono">
                      {r.delete_or_format ? (
                        <span className="inline-flex items-center rounded bg-sky-50 text-sky-700 border border-sky-300 dark:bg-sky-950 dark:text-sky-300 px-2 py-0.5 text-[11px] font-bold">
                          {r.delete_or_format === 'delete' ? 'DELETE' : r.delete_or_format === 'format' ? 'FORMAT' : 'DELETE & FORMAT'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.location}</td>
                    <td className="min-w-[160px] px-4 py-3 text-xs text-muted-foreground">{r.objective}</td>
                    <StatusCell r={r} />
                    {canDelete && <td className="whitespace-nowrap px-4 py-3">{deleteButton(r)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className={`w-full text-sm ${visitorActions ? 'min-w-[1600px]' : 'min-w-[1520px]'}`}>
              <thead className="table-head-gradient">
                <tr>
                  {['No', 'Tanggal Daftar', 'Nama', 'Company / Organization', 'Department', 'PIC JAI', 'Serial No. Kamera', 'No ID Photography', 'PIC Pendamping JAI', 'Dari', 'Sampai', 'Waktu Dikembalikan', 'Lokasi', 'Tujuan', 'Status', ...(visitorActions ? ['Aksi'] : [])].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={visitorColCount} className="px-5 py-16 text-center"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-b-ring" /><p className="text-sm text-muted-foreground">Memuat rekap...</p></td></tr>
                )}
                {!loading && filteredRequests.length === 0 && (
                  <tr><td colSpan={visitorColCount} className="px-5 py-16 text-center"><Camera className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium text-muted-foreground">{query ? 'Tidak ada yang cocok' : 'Belum ada pengajuan'}</p></td></tr>
                )}
                {pageItems.map((r, index) => (
                  <tr key={r.id} className={`table-row-glow ${index % 2 ? 'bg-secondary/20' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{(page - 1) * pageSize + index + 1}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.submitted_at)}</td>
                    <td className="min-w-[140px] px-4 py-3 font-medium text-foreground">
                      <div>{r.requester_name}</div>
                      {(r.companions?.length ?? 0) > 0 && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground font-normal" title={r.companions?.map((c) => c.name).join(', ')}>
                          + {r.companions?.length} orang: {r.companions?.map((c) => c.name).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept_or_company}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.dept ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.pic_jai ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{r.camera_serial_no ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      <div>{r.photo_id_no ?? '—'}</div>
                      {r.companions?.filter((c) => c.photo_id_no).map((c, i) => (
                        <div key={i} className="text-[11px] text-muted-foreground font-mono">
                          {c.photo_id_no} ({c.name})
                        </div>
                      ))}
                    </td>
                    {escortCell(r)}
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.from_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.to_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {r.returned_at ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                            <Check className="size-3 text-emerald-600" />
                            {formatDateTime(r.returned_at)}
                          </span>
                          {r.returned_by && (
                            <p className="text-[10px] text-muted-foreground">
                              PIC: <span className="font-semibold text-foreground">{r.returned_by}</span>
                            </p>
                          )}
                        </div>
                      ) : r.status === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingReturn(r)
                            setReturnedBy('')
                            setReturnNotes('')
                            setReturnCondition('good')
                            setReturnError(null)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          <RotateCcw className="size-3" />
                          <span>Catat Kembali</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.location}</td>
                    <td className="min-w-[160px] px-4 py-3 text-xs text-muted-foreground">{r.objective}</td>
                    <StatusCell r={r} />
                    {visitorActions && (
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1">
                          {adminUser && r.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleResendEmail(r)}
                              disabled={resendingId === r.id}
                              aria-label={`Kirim ulang email persetujuan ${r.requester_name}`}
                              title="Kirim ulang email persetujuan ke approver"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 transition disabled:opacity-50"
                            >
                              {resendingId === r.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Send className="size-3" />
                              )}
                              <span>Kirim Ulang</span>
                            </button>
                          )}
                          {canViewPdf && (r.status !== 'pending' ? (
                            <a
                              href={`${API_BASE_PATH}/api/photo-video-requests/${r.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Lihat surat pengajuan PDF ${r.requester_name}`}
                              title="Lihat hasil pengajuan (surat pengajuan PDF)"
                              className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                            >
                              <Eye className="size-3.5" />
                            </a>
                          ) : (
                            <span className="grid size-8 place-items-center text-muted-foreground/40">—</span>
                          ))}
                          {canDelete && deleteButton(r)}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && filteredRequests.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRequests.length} pageSize={pageSize} />
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus pengajuan foto/video?"
        message={deleteTarget ? `Pengajuan ${deleteTarget.request_type === 'internal' ? 'Internal' : 'Visitor'} atas nama "${deleteTarget.requester_name}" (${formatDateTime(deleteTarget.submitted_at)}) akan dihapus permanen dari rekap, termasuk surat pengajuan PDF-nya. Tindakan ini tidak dapat dibatalkan.` : ''}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* MODAL PENCATATAN PENGEMBALIAN PERANGKAT (BEBAS LOGIN - KHUSUS DEPT PEMILIK BARANG) */}
      {pendingReturn && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="return-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingReturn) {
              setPendingReturn(null)
            }
          }}
        >
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-border p-4 sm:p-5 bg-secondary/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <RotateCcw className="size-5" />
                </div>
                <div>
                  <h3 id="return-modal-title" className="text-sm font-bold text-foreground">
                    Pemeriksaan &amp; Pengembalian Perangkat
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Penerimaan kembali oleh Dept. Pemilik Aset: <strong className="text-foreground">{pendingReturn.dept_pic_kamera || 'Departemen Pemilik Barang'}</strong> (Tanpa Login)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingReturn(null)}
                disabled={submittingReturn}
                aria-label="Tutup"
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
              {/* Ringkasan Peminjaman */}
              <div className="rounded-xl border border-border bg-secondary/20 p-3.5 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/80">Pemohon:</span>
                    <span className="font-semibold text-foreground">{pendingReturn.requester_name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/80">Dept/Perusahaan:</span>
                    <span className="font-semibold text-foreground">{pendingReturn.dept_or_company}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/80">Lokasi:</span>
                    <span className="text-foreground">{pendingReturn.location}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground/80">Waktu Jadwal:</span>
                    <span className="text-foreground">{formatDateTime(pendingReturn.from_at)}</span>
                  </div>
                </div>
              </div>

              {/* Perangkat yang Dipinjam */}
              <div>
                <label className="block text-[11px] font-bold text-foreground uppercase tracking-wider mb-2">
                  1. Perangkat yang Dikembalikan:
                </label>
                <div className="space-y-2">
                  {(pendingReturn.camera_control_no || pendingReturn.camera_serial_no) && (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                      <Camera className="size-4 text-primary shrink-0" />
                      <div className="flex-1 text-xs">
                        <span className="font-mono font-bold text-foreground">
                          Kamera: {pendingReturn.camera_control_no || pendingReturn.camera_serial_no}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">Unit kamera diserahkan kembali.</span>
                      </div>
                    </div>
                  )}

                  {pendingReturn.photo_id_no && (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                      <CreditCard className="size-4 text-primary shrink-0" />
                      <div className="flex-1 text-xs">
                        <span className="font-mono font-bold text-foreground">
                          Kartu ID Photography: {pendingReturn.photo_id_no}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">Kartu nomor izin dan tali gantungan diserahkan.</span>
                      </div>
                    </div>
                  )}

                  {pendingReturn.usb_control_no && (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                      <HardDrive className="size-4 text-primary shrink-0" />
                      <div className="flex-1 text-xs">
                        <span className="font-mono font-bold text-foreground">
                          Flashdisk / USB: {pendingReturn.usb_control_no}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">Media penyimpanan USB diserahkan kembali.</span>
                      </div>
                    </div>
                  )}

                  {pendingReturn.smart_device_control_no && (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                      <Smartphone className="size-4 text-primary shrink-0" />
                      <div className="flex-1 text-xs">
                        <span className="font-mono font-bold text-foreground">
                          Smart Device: {pendingReturn.smart_device_control_no}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">Tablet / HP khusus diserahkan kembali.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Komitmen ISMS (Telah Disetujui Pemohon Saat Pengajuan) */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <ShieldCheck className="size-4" />
                  <span>Komitmen Keamanan ISMS (Telah Disetujui Pemohon Saat Pengajuan)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] bg-card p-2 rounded-lg border border-border">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span>Virus Check: Passed</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] bg-card p-2 rounded-lg border border-border">
                    <CheckCircle2 className="size-3.5 text-sky-600 shrink-0" />
                    <span>Pembersihan: {pendingReturn.delete_or_format === 'delete' ? 'DELETE' : pendingReturn.delete_or_format === 'format' ? 'FORMAT' : (pendingReturn.delete_or_format === 'both' ? 'DELETE & FORMAT' : 'DELETE')}</span>
                  </div>
                </div>
              </div>

              {/* Form Input Penerimaan oleh Dept Pemilik */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Nama Penerima (PIC Dept. Pemilik Aset) <span className="text-destructive">*</span>:
                  </label>
                  <input
                    type="text"
                    value={returnedBy}
                    onChange={(e) => setReturnedBy(e.target.value)}
                    placeholder="Contoh: Budi (Dept. Produksi) / PIC Kamera"
                    className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                    required
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Petugas dari departemen pemilik yang menerima fisik barang dan memastikan barang telah kembali.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Kondisi Fisik Perangkat:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReturnCondition('good')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${
                        returnCondition === 'good'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Kondisi Baik &amp; Lengkap</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnCondition('issue')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${
                        returnCondition === 'issue'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      <AlertCircle className="size-3.5" />
                      <span>Ada Kerusakan / Catatan</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Catatan Pengembalian (Opsional):
                  </label>
                  <textarea
                    rows={2}
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Ketik catatan tambahan jika ada..."
                    className="w-full rounded-xl border border-input bg-card p-2.5 text-xs text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                {returnError && (
                  <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                    {returnError}
                  </p>
                )}
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 border-t border-border p-4 bg-secondary/30 shrink-0">
              <button
                type="button"
                onClick={() => setPendingReturn(null)}
                disabled={submittingReturn}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition disabled:opacity-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveReturn}
                disabled={submittingReturn || !returnedBy.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submittingReturn ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    <span>Konfirmasi Pengembalian</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
