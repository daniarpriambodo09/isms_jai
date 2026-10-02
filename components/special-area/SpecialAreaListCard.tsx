'use client'

// ISM Admin card: the Special Security areas offered in the request form
// (Lobby kiosk and this page). Add, rename, remove or reorder them — the form
// picks the list up the next time it is opened. Requests already submitted
// keep the area name they were made with.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, MapPin, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { toast } from '@/components/toast'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { AREA_LIST_MAX, AREA_NAME_MAX, parseAreaList } from '@/lib/special-area-shared'

type Data = { areas: string[]; isDefault: boolean; updatedAt: string | null; updatedBy: string | null }
type Row = { key: number; name: string }

const input = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'
const iconButton = 'grid size-9 flex-none place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent'

export function SpecialAreaListCard() {
  const [data, setData] = useState<Data | null>(null)
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const nextKey = useRef(1)
  const lastInput = useRef<HTMLInputElement>(null)
  const focusLast = useRef(false)

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/areas`, { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setData(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  // After "Tambah area": put the cursor in the new row.
  useEffect(() => {
    if (focusLast.current) { focusLast.current = false; lastInput.current?.focus() }
  }, [rows.length])

  const startEdit = () => {
    if (!data) return
    setRows(data.areas.map((name) => ({ key: nextKey.current++, name })))
    setError(null)
    setEditing(true)
  }

  const rename = (key: number, name: string) => setRows((current) => current.map((row) => row.key === key ? { ...row, name } : row))
  const remove = (key: number) => setRows((current) => current.filter((row) => row.key !== key))
  const move = (index: number, direction: 1 | -1) => setRows((current) => {
    const target = index + direction
    if (target < 0 || target >= current.length) return current
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const add = () => {
    focusLast.current = true
    setRows((current) => [...current, { key: nextKey.current++, name: '' }])
  }

  const save = async () => {
    const parsed = parseAreaList(rows.map((row) => row.name))
    if ('error' in parsed) { setError(parsed.error); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/areas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areas: parsed.areas }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.message ?? 'Gagal menyimpan.')
      setData(body)
      setEditing(false)
      toast(body.message ?? 'Daftar area disimpan.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/areas`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.message ?? 'Gagal mengembalikan daftar.')
      setData(body)
      setEditing(false)
      toast(body.message ?? 'Daftar area dikembalikan.', 'info')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Gagal mengembalikan daftar.', 'error')
    } finally {
      setSaving(false)
      setConfirmReset(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        <span className="grid size-10 flex-none place-items-center rounded-xl bg-red-600/10 text-red-700"><MapPin className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-mono-label text-[10px] text-muted-foreground">Daftar Area Special</p>
          {data ? (
            <>
              <p className="mt-0.5 text-base font-semibold text-foreground">{data.areas.length} area <span className="font-normal text-muted-foreground">tampil di form pengajuan</span></p>
              <p className="text-xs text-muted-foreground">
                {data.isDefault
                  ? 'Daftar bawaan dari Diagram Security Area (ISMS-B-003).'
                  : `Diubah ${data.updatedAt ? new Date(data.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : ''}${data.updatedBy ? ` oleh ${data.updatedBy}` : ''}.`}
              </p>
              {!editing && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {data.areas.map((area) => (
                    <li key={area} className="rounded-full bg-red-600/10 px-2.5 py-1 text-xs font-semibold text-red-700">{area}</li>
                  ))}
                  <li className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground" title="Pilihan terakhir di form: pemohon mengetik nama areanya sendiri">Lainnya…</li>
                </ul>
              )}
            </>
          ) : <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" />}
        </div>
        {!editing && <button type="button" onClick={startEdit} disabled={!data} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"><Pencil className="size-3.5" /> Ubah daftar</button>}
      </div>

      {editing && (
        <div className="flex flex-col gap-4 border-t border-border bg-secondary/20 px-5 py-5">
          <ol className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <li key={row.key} className="flex items-center gap-1.5">
                <span className="w-6 flex-none text-right font-mono text-[11px] text-muted-foreground">{index + 1}</span>
                <input
                  ref={index === rows.length - 1 ? lastInput : undefined}
                  value={row.name}
                  onChange={(event) => rename(row.key, event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }}
                  maxLength={AREA_NAME_MAX}
                  placeholder="Nama area, mis. Server Room"
                  aria-label={`Nama area ${index + 1}`}
                  className={input}
                />
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Naikkan ${row.name || 'area'}`} title="Naikkan" className={iconButton}><ArrowUp className="size-4" /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label={`Turunkan ${row.name || 'area'}`} title="Turunkan" className={iconButton}><ArrowDown className="size-4" /></button>
                <button type="button" onClick={() => remove(row.key)} aria-label={`Hapus ${row.name || 'area'}`} title="Hapus dari daftar" className={`${iconButton} hover:bg-destructive/10 hover:text-destructive`}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ol>

          <button type="button" onClick={add} disabled={rows.length >= AREA_LIST_MAX} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-card disabled:opacity-50">
            <Plus className="size-4" /> Tambah area
          </button>

          <p className="text-xs leading-5 text-muted-foreground">
            Urutan di sini adalah urutan di form. Pilihan <strong className="text-foreground">Lainnya…</strong> selalu ada di paling bawah.
            Pengajuan yang sudah masuk tetap memakai nama area saat diajukan — mengubah atau menghapus area tidak mengubah data lama.
          </p>
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setConfirmReset(true)} disabled={saving || data?.isDefault} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40">
              <RotateCcw className="size-3.5" /> Kembalikan daftar bawaan
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"><X className="size-3.5" /> Batal</button>
              <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {saving && <Loader2 className="size-4 animate-spin" />} Simpan daftar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Kembalikan daftar bawaan?"
        message="Daftar area akan kembali ke 11 area bawaan dari Diagram Security Area. Perubahan yang Anda buat pada daftar ini akan hilang."
        confirmLabel="Kembalikan"
        pending={saving}
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  )
}
