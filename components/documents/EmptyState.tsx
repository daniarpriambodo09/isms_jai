// components/documents/EmptyState.tsx
//
// What a register shows when it has nothing to list — said plainly, with the
// one useful next step: clear the search, or (for an admin on an empty
// register) add the first document.

import { FileSearch, FolderOpen, Plus, X } from 'lucide-react'

export function EmptyState({
  filtered,
  onClear,
  onAdd,
  noun = 'dokumen',
}: {
  /** A search / filter is active, so "nothing" may just mean "nothing matches". */
  filtered: boolean
  onClear?: () => void
  /** Admin only: opens the "add" form. */
  onAdd?: () => void
  noun?: string
}) {
  const Icon = filtered ? FileSearch : FolderOpen
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-4 text-center">
      <span className="relative grid size-16 place-items-center rounded-2xl bg-secondary text-[color:var(--p-600)]">
        <Icon className="size-7" />
        <span aria-hidden className="absolute -right-1.5 -top-1.5 size-4 rounded-full border-2 border-card bg-accent" />
      </span>
      <p className="mt-4 font-display text-lg font-semibold text-foreground">
        {filtered ? `Tidak ada ${noun} yang cocok` : `Belum ada ${noun}`}
      </p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {filtered
          ? 'Coba kata kunci lain, atau periksa lagi nomor kontrolnya.'
          : onAdd
            ? `Daftar ini masih kosong. Tambahkan ${noun} pertama untuk memulai.`
            : `Daftar ini masih kosong — ${noun} akan tampil di sini setelah diunggah admin.`}
      </p>
      {filtered && onClear && (
        <button type="button" onClick={onClear} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary">
          <X className="size-3.5" /> Hapus pencarian
        </button>
      )}
      {!filtered && onAdd && (
        <button type="button" onClick={onAdd} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5">
          <Plus className="size-4" /> Tambah {noun} pertama
        </button>
      )}
    </div>
  )
}
