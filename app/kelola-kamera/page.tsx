// app/kelola-kamera/page.tsx

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { EquipmentRosterCard } from '@/components/admin/EquipmentRosterCard'

type Section = { id: number; department_id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }

export default function KelolaKameraPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      const data = await res.json()
      setDepartments(data.departments ?? [])
    } catch {
      setDepartments([])
    }
  }, [])

  useEffect(() => { loadDepartments() }, [loadDepartments])

  if (!isLoading && !isLoggedIn) return <AdminGate />

  return (
    <div className="flex flex-col gap-7">
      <header className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8">
        <div className="absolute right-8 top-0 hidden h-full w-1/3 border-l border-primary-foreground/10 bg-[linear-gradient(135deg,transparent_25%,rgba(255,255,255,0.08)_25%,transparent_60%)] sm:block" />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground"><Settings className="size-3.5" /> Admin workspace</div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola Kontrol Kamera &amp; ID Photography</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">
            Daftar kode Kontrol No. Kamera dan No. ID Photography yang muncul di dropdown pada form Ijin Foto/Video (Internal), dikelompokkan per departemen dan bisa dipersempit lagi per section. Kode tanpa departemen/section muncul untuk semua pilihan.
          </p>
        </div>
      </header>

      <EquipmentRosterCard
        title="Kontrol No. Kamera"
        addLabel="Tambah Kontrol Kamera"
        codeLabel="Kontrol Kamera"
        placeholder="Contoh: TRN-CAM-01"
        apiPath="/api/camera-equipment"
        listKey="cameras"
        departments={departments}
      />

      <div className="h-px bg-border" />

      <EquipmentRosterCard
        title="No. ID Photography"
        addLabel="Tambah ID Photography"
        codeLabel="ID Photography"
        placeholder="Contoh: PHOTO-ID-001"
        apiPath="/api/photo-id-equipment"
        listKey="photoIds"
        departments={departments}
      />
    </div>
  )
}
