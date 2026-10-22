// app/kelola-permintaan-foto-video/page.tsx

'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Camera, Check, Eye, Loader2, RotateCcw, Search, Send, Settings, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { PhotoVideoDecisionModal, type PhotoVideoRequest } from '@/components/documents/PhotoVideoDecisionModal'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagination } from '@/components/pagination'
import { usePagination } from '@/hooks/usePagination'

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
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
  const { isLoggedIn, isLoading, adminUser } = useAuth()
  const isApproverAdmin = adminUser?.role === 'ism_admin' || adminUser?.role === 'it'
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? '')
  const [query, setQuery] = useState('')
  const [requests, setRequests] = useState<PhotoVideoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PhotoVideoRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PhotoVideoRequest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingMarkTaken, setPendingMarkTaken] = useState<PhotoVideoRequest | null>(null)
  const [markingTaken, setMarkingTaken] = useState(false)
  const [unmarkingId, setUnmarkingId] = useState<number | null>(null)
  const [pendingReturn, setPendingReturn] = useState<PhotoVideoRequest | null>(null)
  const [returnNotes, setReturnNotes] = useState('')
  const [returning, setReturning] = useState(false)
  const [unmarkingReturnId, setUnmarkingReturnId] = useState<number | null>(null)
  const [resendingId, setResendingId] = useState<number | null>(null)
  const [resendNotice, setResendNotice] = useState<string | null>(null)

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
  }, [statusFilter, typeFilter])

  useEffect(() => { if (isLoggedIn) load() }, [isLoggedIn, load])

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.message ?? 'Gagal menghapus pengajuan.'); setDeleting(false); setPendingDelete(null); return }
      await load()
    } catch { setError('Tidak dapat menghubungi server.') }
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
      if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.message ?? 'Gagal menandai pengajuan.'); setMarkingTaken(false); setPendingMarkTaken(null); return }
      await load()
    } catch { setError('Tidak dapat menghubungi server.') }
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
      if (!response.ok) { const data = await response.json().catch(() => null); setError(data?.message ?? 'Gagal membatalkan tanda.'); return }
      await load()
    } catch { setError('Tidak dapat menghubungi server.') } finally { setUnmarkingId(null) }
  }

  const confirmReturn = async () => {
    if (!pendingReturn) return
    setReturning(true)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${pendingReturn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-returned', returnNotes: returnNotes.trim() || null }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal mencatat pengembalian.')
        return
      }
      setPendingReturn(null)
      setReturnNotes('')
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

  const filteredRequests = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return requests
    return requests.filter((req) =>
      req.requester_name.toLowerCase().includes(value) ||
      (req.nik ?? '').toLowerCase().includes(value) ||
      req.dept_or_company.toLowerCase().includes(value) ||
      req.location.toLowerCase().includes(value)
    )
  }, [requests, query])
  const { page, setPage, totalPages, pageItems, pageSize } = usePagination(filteredRequests, 20)

  if (!isLoading && !isLoggedIn) {
    return <AdminGate />
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
              <Settings className="size-3.5" /> Admin workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Permintaan Foto/Video</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Tinjau dan putuskan pengajuan izin pengambilan foto/video dari karyawan dan visitor.</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setStatusFilter(tab.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${statusFilter === tab.value ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setTypeFilter(tab.value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${typeFilter === tab.value ? 'border-transparent bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>
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
          placeholder="Cari nama, NIK, dept/company, atau lokasi..."
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

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="admin-table w-full min-w-[900px] text-sm">
            <thead className="bg-secondary/55">
              <tr>
                {['Tanggal', 'Tipe', 'Nama/NIK', 'Dept/Company', 'Lokasi', 'Periode', 'ID Photography', 'Status', 'Aksi'].map((head) => (
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
                <tr><td colSpan={9} className="px-5 py-16 text-center text-sm text-muted-foreground">Tidak ada yang cocok dengan pencarian.</td></tr>
              )}
              {!loading && pageItems.map((req, index) => (
                <tr key={req.id} className={index % 2 ? 'bg-secondary/20' : ''}>
                  <td data-label="Diajukan" className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(req.submitted_at)}</td>
                  <td data-label="Tipe" className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{req.request_type === 'internal' ? 'Internal' : 'Visitor'}</td>
                  <td data-cell="title" className="min-w-[160px] px-4 py-3 font-medium text-foreground">{req.requester_name}{req.nik && <span className="block text-xs text-muted-foreground">NIK: {req.nik}</span>}{req.escort_name && <span className="block text-xs font-normal text-muted-foreground">PIC Pendamping JAI: {req.escort_name}{req.escort_dept ? ` (${req.escort_dept})` : ''}</span>}</td>
                  <td data-label="Dept/Company" className="px-4 py-3 text-xs text-muted-foreground">{req.dept_or_company}</td>
                  <td data-label="Lokasi" className="px-4 py-3 text-xs text-muted-foreground">{req.location}</td>
                  <td data-label="Periode" className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDateTime(req.from_at)} &ndash;<br />{formatDateTime(req.to_at)}</td>
                  <td data-label="ID / Perangkat" className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    <span>{req.photo_id_no ?? '—'}</span>
                    {req.camera_control_no && (
                      <span className="block text-[11px] font-mono text-foreground font-medium">Cam: {req.camera_control_no}</span>
                    )}
                    {req.usb_control_no && (
                      <span className="block text-[11px] font-mono font-bold text-primary">USB: {req.usb_control_no}</span>
                    )}
                  </td>
                  <td data-label="Status" className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[req.status]}`}>{STATUS_LABEL[req.status]}</span>
                    {req.status === 'pending' && new Date(req.to_at).getTime() < Date.now() && (
                      <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-destructive" title="Periode yang diajukan sudah lewat tapi belum diputuskan">
                        <AlertTriangle className="size-3" /> Terlewat
                      </span>
                    )}
                    {req.taken_at && (
                      <span className="mt-1 block text-[10px] font-semibold text-accent-foreground">
                        {req.taken_ack_at ? 'Sudah diambil · dikonfirmasi' : 'Sudah diambil · menunggu dikonfirmasi'}
                      </span>
                    )}
                    {req.returned_at ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                        ✓ Kembali: {formatDateTime(req.returned_at)}
                      </span>
                    ) : req.taken_at ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                        Dipinjam (Belum Kembali)
                      </span>
                    ) : null}
                  </td>
                  <td data-cell="actions" className="w-px px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap min-[760px]:grid min-[760px]:grid-cols-[4rem_7rem_7rem_2rem_2rem]">
                      {isApproverAdmin && req.status === 'pending' ? (
                        <button type="button" onClick={() => setSelected(req)} className="rounded-md bg-primary px-3 py-1.5 text-center text-xs font-semibold text-primary-foreground transition hover:opacity-90">
                          Tinjau
                        </button>
                      ) : (
                        <button type="button" onClick={() => setSelected(req)} className="rounded-md border border-border px-3 py-1.5 text-center text-xs font-semibold text-foreground transition hover:bg-secondary">
                          Lihat
                        </button>
                      )}
                      {/* Resend Approval Email for Visitor pending */}
                      {req.request_type === 'visitor' && req.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => resendApprovalEmail(req)}
                          disabled={resendingId === req.id}
                          title="Kirim ulang email persetujuan ke approver"
                          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-center text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          {resendingId === req.id ? 'Mengirim...' : 'Kirim Ulang'}
                        </button>
                      ) : isApproverAdmin && req.status === 'approved' && !req.taken_at ? (
                        <button type="button" onClick={() => setPendingMarkTaken(req)} className="rounded-md border border-border px-3 py-1.5 text-center text-xs font-semibold text-foreground transition hover:bg-secondary">
                          Sudah Diambil
                        </button>
                      ) : isApproverAdmin && req.status === 'approved' && req.taken_at && !req.returned_at ? (
                        <button type="button" onClick={() => unmarkTaken(req)} disabled={unmarkingId === req.id} className="rounded-md border border-border px-3 py-1.5 text-center text-xs font-semibold text-muted-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
                          {unmarkingId === req.id ? '...' : 'Batal Ambil'}
                        </button>
                      ) : <span className="hidden min-[760px]:block" />}

                      {/* Return Action: Catat Kembali / Batal Kembali */}
                      {isApproverAdmin && req.status === 'approved' && req.taken_at && !req.returned_at ? (
                        <button
                          type="button"
                          onClick={() => { setPendingReturn(req); setReturnNotes('') }}
                          className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-center text-xs font-bold text-white shadow-2xs transition hover:bg-emerald-700"
                        >
                          Catat Kembali
                        </button>
                      ) : isApproverAdmin && req.status === 'approved' && req.returned_at ? (
                        <button
                          type="button"
                          onClick={() => unmarkReturned(req)}
                          disabled={unmarkingReturnId === req.id}
                          className="rounded-md border border-border px-2.5 py-1.5 text-center text-xs font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
                        >
                          {unmarkingReturnId === req.id ? '...' : 'Batal Kembali'}
                        </button>
                      ) : <span className="hidden min-[760px]:block" />}

                      {req.request_type === 'visitor' && req.status !== 'pending' ? (
                        <a
                          href={`${API_BASE_PATH}/api/photo-video-requests/${req.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Lihat surat pengajuan PDF ${req.requester_name}`}
                          title="Lihat hasil pengajuan (surat pengajuan PDF)"
                          className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <Eye className="size-3.5" />
                        </a>
                      ) : <span className="hidden min-[760px]:block" />}
                      {isApproverAdmin && (
                        <button type="button" onClick={() => setPendingDelete(req)} aria-label={`Hapus pengajuan ${req.requester_name}`} title="Hapus pengajuan" className="grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredRequests.length} pageSize={pageSize} />
      </div>

      {selected && (
        <PhotoVideoDecisionModal request={selected} onClose={() => setSelected(null)} onDecided={load} readOnly={!isApproverAdmin} />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus pengajuan?"
        message={`Pengajuan foto/video dari "${pendingDelete?.requester_name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={!!pendingMarkTaken}
        title="Konfirmasi Foto/Video Sudah Diambil"
        message={`Pengajuan dari "${pendingMarkTaken?.requester_name}" akan ditandai sudah diambil, dan notifikasi akan dikirim ke admin lain. Kamu masih bisa membatalkan tanda ini nanti kalau perlu.`}
        danger={false}
        confirmLabel="Tandai"
        pending={markingTaken}
        onConfirm={confirmMarkTaken}
        onCancel={() => setPendingMarkTaken(null)}
      />

      {/* Return Dialog Modal */}
      {pendingReturn && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <RotateCcw className="size-4 text-emerald-600" />
                <span>Konfirmasi Pengembalian Kamera / USB</span>
              </h3>
              <button type="button" onClick={() => setPendingReturn(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="text-xs space-y-2 text-muted-foreground">
              <p>Catat pengembalian peralatan untuk pemohon <strong className="text-foreground">{pendingReturn.requester_name}</strong>.</p>
              <p className="bg-secondary/40 p-2.5 rounded-xl text-foreground font-medium">
                Waktu pengembalian resmi (Jam Selesai Aktual) akan dicatat pada <strong className="text-emerald-700">{new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</strong>.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Catatan Kondisi / Kelengkapan (Opsional)</label>
              <input
                type="text"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Contoh: Kamera &amp; USB kembali lengkap, kondisi baik"
                className="h-10 w-full rounded-xl border border-input bg-card px-3 text-xs outline-none focus:border-ring"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPendingReturn(null)} className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
                Batal
              </button>
              <button
                type="button"
                disabled={returning}
                onClick={confirmReturn}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
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
