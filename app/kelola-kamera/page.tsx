// app/kelola-kamera/page.tsx

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Check, Pencil, Plus, Settings, Trash2, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Department = { id: number; name: string; slug: string }
type CameraItem = { id: number; code: string; department_id: number | null; department_name: string | null }

const inputClass = 'h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const iconButtonClass = 'grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30'
const ALL_DEPARTMENTS_GROUP = 'Semua Departemen'

export default function KelolaKameraPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [cameras, setCameras] = useState<CameraItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  const [addingOpen, setAddingOpen] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newDeptId, setNewDeptId] = useState('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editDeptId, setEditDeptId] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [pendingDelete, setPendingDelete] = useState<CameraItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [listError, setListError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [camRes, deptsRes] = await Promise.all([
        fetch(`${API_BASE_PATH}/api/camera-equipment`, { cache: 'no-store' }),
        fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' }),
      ])
      const camData = await camRes.json()
      const deptsData = await deptsRes.json()
      setCameras(camData.cameras ?? [])
      setDepartments(deptsData.departments ?? [])
    } catch {
      setCameras([])
      setDepartments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    const map = new Map<string, CameraItem[]>()
    for (const cam of cameras) {
      const key = cam.department_name ?? ALL_DEPARTMENTS_GROUP
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(cam)
    }
    const entries = Array.from(map.entries())
    entries.sort(([a], [b]) => (a === ALL_DEPARTMENTS_GROUP ? -1 : b === ALL_DEPARTMENTS_GROUP ? 1 : a.localeCompare(b)))
    return entries
  }, [cameras])

  const submitAdd = async () => {
    if (!newCode.trim()) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/camera-equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode.trim(), departmentId: newDeptId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Gagal menambahkan kontrol kamera.')
      setNewCode(''); setNewDeptId(''); setAddingOpen(false)
      await load()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (cam: CameraItem) => {
    setEditingId(cam.id)
    setEditCode(cam.code)
    setEditDeptId(cam.department_id ? String(cam.department_id) : '')
    setEditError('')
  }

  const submitEdit = async (id: number) => {
    if (!editCode.trim()) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/camera-equipment/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: editCode.trim(), departmentId: editDeptId || null }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.message ?? 'Gagal menyimpan perubahan.')
      setEditingId(null)
      await load()
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setEditSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setListError('')
    try {
      const res = await fetch(`${API_BASE_PATH}/api/camera-equipment/${pendingDelete.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setListError(data?.message ?? 'Gagal menghapus kontrol kamera.')
        return
      }
      await load()
    } catch {
      setListError('Tidak dapat menghubungi server.')
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  if (!isLoading && !isLoggedIn) return <AdminGate />

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="absolute right-8 top-0 hidden h-full w-1/3 border-l border-primary-foreground/10 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.08)_25%,transparent_60%)] sm:block" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground"><Settings className="size-3.5" /> Admin workspace</div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola Kontrol Kamera</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">Daftar kode kontrol kamera (mis. TRN-CAM-01) yang muncul di dropdown &quot;Kontrol No. Kamera&quot; saat Admin ISM menyetujui pengajuan Ijin Foto/Video, dikelompokkan per departemen. Kode tanpa departemen muncul untuk semua pilihan.</p>
          </div>
          <button
            type="button"
            onClick={() => { setAddingOpen(true); setNewCode(''); setNewDeptId(''); setAddError('') }}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-4" /> Tambah Kontrol Kamera
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Camera className="size-5" /></div>
          <div><div className="text-2xl font-semibold tracking-tight text-foreground">{cameras.length}</div><div className="text-xs font-medium text-muted-foreground">Total Kontrol Kamera</div></div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="grid size-11 place-items-center rounded-2xl bg-accent/20 text-accent-foreground"><Settings className="size-5" /></div>
          <div><div className="text-2xl font-semibold tracking-tight text-foreground">{grouped.length}</div><div className="text-xs font-medium text-muted-foreground">Kelompok departemen</div></div>
        </div>
      </div>

      {listError && <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{listError}</p>}

      {addingOpen && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tambah kontrol kamera baru</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Contoh: TRN-CAM-01" autoFocus className={inputClass} />
            <select value={newDeptId} onChange={(e) => setNewDeptId(e.target.value)} className={inputClass}>
              <option value="">{ALL_DEPARTMENTS_GROUP}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <button onClick={submitAdd} disabled={adding || !newCode.trim()} className={`${iconButtonClass} text-primary disabled:opacity-50`} aria-label="Simpan"><Check className="size-4" /></button>
              <button onClick={() => setAddingOpen(false)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button>
            </div>
          </div>
          {addError && <p className="mt-2 text-xs text-destructive">{addError}</p>}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center text-sm text-muted-foreground shadow-sm">Memuat daftar kontrol kamera...</div>
      ) : cameras.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-secondary/40 p-12 text-center text-sm text-muted-foreground">Belum ada kontrol kamera.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([deptName, groupCameras]) => (
            <div key={deptName} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-secondary/30 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {deptName} <span className="ml-1 font-normal normal-case text-muted-foreground/70">({groupCameras.length})</span>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {groupCameras.map((cam) => (
                  <div key={cam.id} className="group/row flex items-center justify-between gap-3 px-4 py-3">
                    {editingId === cam.id ? (
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input value={editCode} onChange={(e) => setEditCode(e.target.value)} autoFocus className={inputClass} />
                          <select value={editDeptId} onChange={(e) => setEditDeptId(e.target.value)} className={inputClass}>
                            <option value="">{ALL_DEPARTMENTS_GROUP}</option>
                            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => submitEdit(cam.id)} disabled={editSaving || !editCode.trim()} className={`${iconButtonClass} text-primary disabled:opacity-50`} aria-label="Simpan"><Check className="size-4" /></button>
                            <button onClick={() => setEditingId(null)} className={iconButtonClass} aria-label="Batal"><X className="size-4" /></button>
                          </div>
                        </div>
                        {editError && <p className="text-xs text-destructive">{editError}</p>}
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-foreground/85">{cam.code}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100">
                          <button onClick={() => startEdit(cam)} className={`${iconButtonClass} size-8`} aria-label={`Edit ${cam.code}`}><Pencil className="size-3.5" /></button>
                          <button onClick={() => setPendingDelete(cam)} className={`${iconButtonClass} size-8 hover:bg-destructive/10 hover:text-destructive`} aria-label={`Hapus ${cam.code}`} title="Hapus kontrol kamera"><Trash2 className="size-3.5" /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Hapus kontrol kamera?"
        message={`Kode "${pendingDelete?.code}" akan dihapus dari daftar. Pengajuan yang sudah mencatat kode ini tetap tersimpan (riwayatnya tidak berubah).`}
        pending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
