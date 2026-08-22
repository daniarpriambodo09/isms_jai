'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Download, ImagePlus, ShieldCheck, Upload, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function PolicyPage() {
  const { isLoggedIn } = useAuth()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [isImageOpen, setIsImageOpen] = useState(false)

  useEffect(() => () => { if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl) }, [imageUrl])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsImageOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  function handleImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl)
    setImageUrl(URL.createObjectURL(file))
    setFileName(file.name)
  }

  function removeImage() {
    if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl)
    setImageUrl(null)
    setFileName('')
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article className="min-w-0 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-9 lg:p-11">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Foundation</div>
        <div className="relative mt-5 aspect-[2.65] min-h-40 w-full overflow-hidden rounded-xl border border-border bg-muted/35 shadow-inner sm:min-h-52">
          {imageUrl ? <>
            <button type="button" onClick={() => setIsImageOpen(true)} className="absolute inset-0 cursor-zoom-in" aria-label="Perbesar gambar policy"><Image src={imageUrl} alt={`Policy visual ${fileName}`} fill unoptimized className="object-contain transition duration-300 hover:scale-[1.02]" /></button>
            {isLoggedIn && <button type="button" onClick={removeImage} aria-label="Hapus gambar policy" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-foreground/85 text-background shadow-sm transition hover:bg-foreground"><X className="size-4" /></button>}
          </> : null}
        </div>
        <div className="my-8 h-px bg-border" />
        <h3 className="mb-2 text-base font-semibold text-foreground">Our commitment</h3>
        <p className="text-sm leading-7 text-muted-foreground">All employees, contractors, and business partners share responsibility for maintaining the confidentiality, integrity, and availability of information entrusted to our organization.</p>
        <p className="mt-1 text-sm leading-7 text-muted-foreground">Our Information Security Management System provides a framework for identifying risks, applying appropriate controls, and continuously improving how we protect information across every department.</p>
        <h3 className="mb-2 mt-7 text-base font-semibold text-foreground">Policy principles</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-muted-foreground"><li>Comply with applicable laws, regulations, and contractual requirements.</li><li>Manage information security risks proportionately and transparently.</li><li>Promote awareness and accountability at every level.</li><li>Review this policy regularly to ensure it remains fit for purpose.</li></ul>
      </article>

      <aside className="flex h-fit flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-lg bg-accent/15 text-accent-foreground"><ShieldCheck className="size-5" /></div><div><strong className="block text-sm text-foreground">Policy owner</strong><span className="text-xs text-muted-foreground">Information Security Committee</span></div></div>
        <div className="flex flex-col gap-1 border-t border-border pt-4"><span className="text-xs text-muted-foreground">Last reviewed</span><strong className="text-sm text-foreground">12 February 2025</strong></div>
        <button type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"><Download className="size-4" /> Download PDF</button>

        <div className="mt-2 border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between"><div><strong className="block text-sm text-foreground">Policy visual</strong><span className="text-xs text-muted-foreground">Upload gambar untuk ditampilkan</span></div><ImagePlus className="size-5 text-muted-foreground" /></div>
          {isLoggedIn && <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><Upload className="size-4" /> {imageUrl ? 'Ganti gambar' : 'Upload gambar'}<input type="file" accept="image/*" onChange={handleImage} className="sr-only" /></label>}
          {!isLoggedIn && <p className="text-center text-xs text-muted-foreground">Login admin untuk mengubah gambar.</p>}
          {fileName && <p className="truncate text-center text-[11px] text-muted-foreground">File aktif: {fileName}</p>}
        </div>
      </aside>

      {isImageOpen && imageUrl && <div role="dialog" aria-modal="true" aria-label="Preview gambar policy" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 p-4 backdrop-blur-sm" onClick={() => setIsImageOpen(false)}>
        <div className="relative max-h-[92vh] w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
          <Image src={imageUrl} alt={`Policy visual ${fileName}`} width={1600} height={1000} unoptimized className="max-h-[88vh] w-full rounded-xl object-contain shadow-2xl" />
          <button type="button" onClick={() => setIsImageOpen(false)} aria-label="Tutup preview gambar" className="absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow-lg transition hover:bg-background"><X className="size-5" /></button>
        </div>
      </div>}
    </section>
  )
}
