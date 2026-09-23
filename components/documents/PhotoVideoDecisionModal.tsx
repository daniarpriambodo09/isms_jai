'use client'

import { useEffect, useState } from 'react'
import { Camera, Check, Plus, ScanLine, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { useEscapeClose } from '@/hooks/useEscapeClose'

export type PhotoVideoRequest = {
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
  decided_by: string | null
  decision_note: string | null
  pic_approve_id: number | null
  pic_approve_name: string | null
  taken_at: string | null
  taken_ack_at: string | null
  camera_control_no: string | null
  photo_id_no: string | null
  pic_jai: string | null
}

type CameraItem = { id: number; code: string; department_id: number | null; department_name: string | null }
type Department = { id: number; name: string }

const inputClass = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function PhotoVideoDecisionModal({ request, onClose, onDecided, readOnly = false }: { request: PhotoVideoRequest; onClose: () => void; onDecided?: () => void; readOnly?: boolean }) {
  const [note, setNote] = useState('')
  const [cameras, setCameras] = useState<CameraItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [cameraControlNo, setCameraControlNo] = useState(request.camera_control_no ?? '')
  const [photoIdNo, setPhotoIdNo] = useState(request.photo_id_no ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [addingCamera, setAddingCamera] = useState(false)
  const [newCameraCode, setNewCameraCode] = useState('')
  const [newCameraDeptId, setNewCameraDeptId] = useState('')
  const [addCameraError, setAddCameraError] = useState<string | null>(null)
  const [addingCameraSubmitting, setAddingCameraSubmitting] = useState(false)

  useEscapeClose(true, onClose)

  const loadCameras = () => {
    fetch(`${API_BASE_PATH}/api/camera-equipment`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { cameras: [] }))
      .then((data: { cameras: CameraItem[] }) => setCameras(data.cameras ?? []))
      .catch(() => setCameras([]))
  }

  useEffect(() => {
    loadCameras()
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { departments: [] }))
      .then((data: { departments: Department[] }) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]))
  }, [])

  const submitNewCamera = async () => {
    if (!newCameraCode.trim()) return
    setAddingCameraSubmitting(true)
    setAddCameraError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/camera-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCameraCode.trim(), departmentId: newCameraDeptId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal menambahkan kontrol kamera.')
      setCameraControlNo(data.camera.code)
      loadCameras()
      setAddingCamera(false)
      setNewCameraCode('')
      setNewCameraDeptId('')
    } catch (e) {
      setAddCameraError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setAddingCameraSubmitting(false)
    }
  }

  const generalCameras = cameras.filter((c) => c.department_id === null)
  const groupedCameras = cameras.reduce<Record<string, CameraItem[]>>((acc, c) => {
    if (c.department_id === null) return acc
    const key = c.department_name ?? 'Lainnya'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const decide = async (status: 'approved' | 'rejected') => {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_PATH}/api/photo-video-requests/${request.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          decisionNote: note,
          cameraControlNo: status === 'approved' ? cameraControlNo : null,
          photoIdNo: status === 'approved' ? photoIdNo : null,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? 'Gagal menyimpan keputusan.')
        return
      }
      onDecided?.()
      onClose()
    } catch {
      setError('Tidak dapat menghubungi server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-label={`Keputusan pengajuan ${request.requester_name}`} className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-primary px-6 py-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <span className="grid size-9 flex-shrink-0 place-items-center rounded-lg bg-primary-foreground/15"><Camera className="size-4" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground/65">
                {request.request_type === 'internal' ? 'Pengajuan Internal' : 'Visitor Registration'}
              </p>
              <h2 className="text-lg font-bold">{request.requester_name}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-8 flex-shrink-0 place-items-center rounded-full text-primary-foreground/70 transition hover:bg-primary-foreground/15 hover:text-primary-foreground">
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="p-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            {request.nik && (<><dt className="text-muted-foreground">NIK</dt><dd className="text-foreground">{request.nik}</dd></>)}
            <dt className="text-muted-foreground">{request.request_type === 'internal' ? 'Dept/Seksi' : 'Company/Organization'}</dt>
            <dd className="text-foreground">{request.dept_or_company}</dd>
            {request.dept && (<><dt className="text-muted-foreground">Department</dt><dd className="text-foreground">{request.dept}</dd></>)}
            {request.pic_jai && (<><dt className="text-muted-foreground">PIC JAI</dt><dd className="text-foreground">{request.pic_jai}</dd></>)}
            {request.dept_pic_kamera && (<><dt className="text-muted-foreground">Dept. PIC Kamera</dt><dd className="text-foreground">{request.dept_pic_kamera}</dd></>)}
            <dt className="text-muted-foreground">Dari</dt><dd className="text-foreground">{formatDateTime(request.from_at)}</dd>
            <dt className="text-muted-foreground">Sampai</dt><dd className="text-foreground">{formatDateTime(request.to_at)}</dd>
            <dt className="text-muted-foreground">Lokasi</dt><dd className="text-foreground">{request.location}</dd>
            <dt className="text-muted-foreground">Tujuan</dt><dd className="text-foreground">{request.objective}</dd>
            <dt className="text-muted-foreground">Diajukan</dt><dd className="text-foreground">{formatDateTime(request.submitted_at)}</dd>
            {request.camera_control_no && (<><dt className="text-muted-foreground">Kontrol No. Kamera</dt><dd className="text-foreground">{request.camera_control_no}</dd></>)}
            {request.photo_id_no && (<><dt className="text-muted-foreground">No ID Photography</dt><dd className="text-foreground">{request.photo_id_no}</dd></>)}
          </dl>

          {request.status !== 'pending' && (
            <p className="mt-4 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              Sudah diputuskan: <strong className="text-foreground">{request.status === 'approved' ? 'Disetujui' : 'Ditolak'}</strong> oleh {request.decided_by} pada {request.decided_at ? formatDateTime(request.decided_at) : '-'}.
              {request.decision_note && <> Catatan: {request.decision_note}</>}
            </p>
          )}

          {readOnly || request.status !== 'pending' ? (
            <p className="mt-5 rounded-lg bg-secondary/40 px-3 py-2 text-center text-xs text-muted-foreground">
              {request.status !== 'pending'
                ? 'Pengajuan ini sudah diputuskan dan tidak bisa diubah lagi dari sini.'
                : 'Tampilan lihat saja — keputusan hanya dapat diproses oleh Admin ISM.'}
            </p>
          ) : (
            <>
              <div className="mt-5 rounded-xl bg-accent/10 p-4">
                <p className="mb-3 text-xs font-semibold text-foreground">Kelengkapan approval (diisi kalau disetujui)</p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Kontrol No. Kamera</span>
                      {!addingCamera && (
                        <button
                          type="button"
                          onClick={() => { setAddingCamera(true); setNewCameraCode(''); setNewCameraDeptId(''); setAddCameraError(null) }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          <Plus className="size-3" /> Tambah baru
                        </button>
                      )}
                    </div>
                    {addingCamera ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5">
                        <input value={newCameraCode} onChange={(e) => setNewCameraCode(e.target.value)} placeholder="Contoh: TRN-CAM-02" autoFocus className={inputClass} />
                        <select value={newCameraDeptId} onChange={(e) => setNewCameraDeptId(e.target.value)} className={inputClass}>
                          <option value="">Semua Departemen</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {addCameraError && <p className="text-xs text-destructive">{addCameraError}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setAddingCamera(false)} className="flex-1 rounded-lg border border-border bg-card py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary">Batal</button>
                          <button type="button" onClick={submitNewCamera} disabled={addingCameraSubmitting || !newCameraCode.trim()} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                            <Check className="size-3.5" />{addingCameraSubmitting ? 'Menyimpan...' : 'Simpan & Pilih'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <select value={cameraControlNo} onChange={(e) => setCameraControlNo(e.target.value)} className={inputClass}>
                        <option value="">Pilih kontrol kamera...</option>
                        {generalCameras.length > 0 && (
                          <optgroup label="Semua Departemen">
                            {generalCameras.map((c) => <option key={c.id} value={c.code}>{c.code}</option>)}
                          </optgroup>
                        )}
                        {Object.entries(groupedCameras).map(([deptName, list]) => (
                          <optgroup key={deptName} label={deptName}>
                            {list.map((c) => <option key={c.id} value={c.code}>{c.code}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">No ID Photography</span>
                    <div className="relative">
                      <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={photoIdNo} onChange={(e) => setPhotoIdNo(e.target.value)} placeholder="Scan atau ketik ID..." className={`${inputClass} pl-10`} />
                    </div>
                  </label>
                </div>
              </div>

              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Catatan keputusan (opsional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15"
                />
              </label>

              {error && <p className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => decide('rejected')}
                  className="flex-1 rounded-lg border border-destructive/30 bg-destructive/10 py-2.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => decide('approved')}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  style={{ background: 'linear-gradient(135deg, oklch(0.48 0.12 180) 0%, oklch(0.58 0.14 165) 100%)' }}
                >
                  Setujui
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
