'use client'

// ISM Admin card: the employees Lobby / Pos Security pick the PIC Pendamping
// from (the person who accompanies a guest inside a special area). The kiosks
// can still type a name that isn't listed; requests keep the name given.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, UserCheck, X } from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { toast } from '@/components/toast'
import { ESCORT_LIST_MAX, ESCORT_NAME_MAX, parseEscortList, type Escort } from '@/lib/special-area-shared'

type Data = { escorts: Escort[]; updatedAt: string | null; updatedBy: string | null }
type Row = { key: number; name: string; dept: string }

const input = 'h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/15'

export function SpecialAreaEscortCard() {
  const [data, setData] = useState<Data | null>(null)
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nextKey = useRef(1)
  const lastInput = useRef<HTMLInputElement>(null)
  const focusLast = useRef(false)

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/escorts`, { cache: 'no-store' }).catch(() => null)
    if (res?.ok) setData(await res.json())
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (focusLast.current) { focusLast.current = false; lastInput.current?.focus() }
  }, [rows.length])

  const startEdit = () => {
    if (!data) return
    const list = data.escorts.map((e) => ({ key: nextKey.current++, name: e.name, dept: e.dept ?? '' }))
    setRows(list.length ? list : [{ key: nextKey.current++, name: '', dept: '' }])
    setError(null)
    setEditing(true)
  }
  const update = (key: number, patch: Partial<Row>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const remove = (key: number) => setRows((current) => current.filter((row) => row.key !== key))
  // A new row keeps the department of the one above — names are usually added per department.
  const add = () => {
    focusLast.current = true
    setRows((current) => [...current, { key: nextKey.current++, name: '', dept: current[current.length - 1]?.dept ?? '' }])
  }

  const save = async () => {
    const parsed = parseEscortList(rows.map((row) => ({ name: row.name, dept: row.dept })))
    if ('error' in parsed) { setError(parsed.error); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_PATH}/api/special-area-requests/escorts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escorts: parsed.escorts }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.message ?? 'Gagal menyimpan.')
      setData(body)
      setEditing(false)
      toast(body.message ?? 'Daftar PIC pendamping disimpan.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  // Shown grouped by department.
  const groups = new Map<string, Escort[]>()
  for (const e of data?.escorts ?? []) groups.set(e.dept ?? 'Tanpa departemen', [...(groups.get(e.dept ?? 'Tanpa departemen') ?? []), e])

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        <span className="grid size-10 flex-none place-items-center rounded-xl bg-emerald-600/10 text-emerald-700"><UserCheck className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-mono-label text-[10px] text-muted-foreground">Daftar PIC Pendamping</p>
          {data ? (
            <>
              <p className="mt-0.5 text-base font-semibold text-foreground">{data.escorts.length} nama <span className="font-normal text-muted-foreground">bisa dipilih Lobby &amp; Pos Security</span></p>
              <p className="text-xs text-muted-foreground">
                PIC pendamping tidak ada di form pengajuan — Lobby/Security memilihnya di daftar pengajuan (kolom PIC Pendamping), atau mengetik nama lain.
                {data.updatedAt && ` Diubah ${new Date(data.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}${data.updatedBy ? ` oleh ${data.updatedBy}` : ''}.`}
              </p>
              {!editing && data.escorts.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {[...groups.entries()].map(([group, list]) => (
                    <div key={group} className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[11px] font-semibold text-muted-foreground">{group}:</span>
                      {list.map((e) => <span key={e.name} className="rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-800">{e.name}</span>)}
                    </div>
                  ))}
                </div>
              )}
              {!editing && data.escorts.length === 0 && <p className="mt-2 text-xs text-amber-700">Belum ada nama — Lobby/Security sementara mengetik nama PIC pendamping sendiri.</p>}
            </>
          ) : <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" />}
        </div>
        {!editing && <button type="button" onClick={startEdit} disabled={!data} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"><Pencil className="size-3.5" /> Ubah daftar</button>}
      </div>

      {editing && (
        <div className="flex flex-col gap-4 border-t border-border bg-secondary/20 px-5 py-5">
          <ol className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <li key={row.key} className="grid grid-cols-[1.5rem_1fr_1fr_2.25rem] items-center gap-1.5 max-[560px]:grid-cols-[1.5rem_1fr_2.25rem]">
                <span className="text-right font-mono text-[11px] text-muted-foreground">{index + 1}</span>
                <input
                  ref={index === rows.length - 1 ? lastInput : undefined}
                  value={row.name}
                  onChange={(event) => update(row.key, { name: event.target.value })}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }}
                  maxLength={ESCORT_NAME_MAX}
                  placeholder="Nama, mis. Teguh Sunjoyo"
                  aria-label={`Nama PIC pendamping ${index + 1}`}
                  className={input}
                />
                <input
                  value={row.dept}
                  onChange={(event) => update(row.key, { dept: event.target.value })}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add() } }}
                  maxLength={ESCORT_NAME_MAX}
                  placeholder="Dept./Seksi, mis. PGA - IT"
                  aria-label={`Departemen PIC pendamping ${index + 1}`}
                  className={`${input} max-[560px]:col-start-2 max-[560px]:row-start-2`}
                />
                <button type="button" onClick={() => remove(row.key)} aria-label={`Hapus ${row.name || 'baris'}`} title="Hapus dari daftar" className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive max-[560px]:col-start-3 max-[560px]:row-start-1"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={add} disabled={rows.length >= ESCORT_LIST_MAX} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-card disabled:opacity-50">
            <Plus className="size-4" /> Tambah nama
          </button>
          <p className="text-xs leading-5 text-muted-foreground">Tekan Enter untuk baris baru (departemennya ikut baris di atas). Baris dengan nama kosong diabaikan. Mengubah daftar tidak mengubah PIC pendamping yang sudah dipilih di pengajuan lama.</p>
          {error && <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"><X className="size-3.5" /> Batal</button>
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {saving && <Loader2 className="size-4 animate-spin" />} Simpan daftar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
