// app/kelola-kamera/page.tsx

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Settings, Camera, CreditCard, HardDrive, Smartphone, Layers } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { API_BASE_PATH } from '@/lib/config'
import { AdminGate } from '@/components/admin-gate'
import { EquipmentRosterCard } from '@/components/admin/EquipmentRosterCard'

type Section = { id: number; department_id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }
type EquipmentTabKey = 'camera' | 'photoId' | 'usb' | 'smartDevice' | 'all'

const CATEGORY_TABS = [
  { key: 'camera' as const, label: 'Kontrol No. Kamera', shortLabel: 'Kamera', icon: Camera, desc: 'Master kamera digital' },
  { key: 'photoId' as const, label: 'No. ID Photography', shortLabel: 'ID Photography', icon: CreditCard, desc: 'Kartu ID photographer' },
  { key: 'usb' as const, label: 'Kontrol No. USB', shortLabel: 'USB Flashdisk', icon: HardDrive, desc: 'Flashdisk dokumentasi' },
  { key: 'smartDevice' as const, label: 'Kontrol Smart Device', shortLabel: 'Smart Device', icon: Smartphone, desc: 'Tablet / HP inspeksi' },
  { key: 'all' as const, label: 'Tampilkan Semua', shortLabel: 'Semua Kategori', icon: Layers, desc: 'Lihat 4 perangkat sekaligus' },
]

export default function KelolaKameraPage() {
  const { isLoggedIn, isLoading } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [activeTab, setActiveTab] = useState<EquipmentTabKey>('camera')

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
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Kelola Kontrol Kamera, ID Photography, USB &amp; Smart Device</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/75">
            Daftar kode Kontrol No. Kamera, No. ID Photography, Kontrol No. USB, dan Kontrol No. Smart Device yang muncul di dropdown pada form Ijin Foto/Video (Internal), dikelompokkan per departemen dan bisa dipersempit lagi per section. Kode tanpa departemen/section muncul untuk semua pilihan.
          </p>
        </div>
      </header>

      {/* Horizontal Category Switcher Tabs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORY_TABS.map((t) => {
          const Icon = t.icon
          const isSelected = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition cursor-pointer ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/20'
                  : 'border-border bg-card hover:bg-secondary/40'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className={`grid size-7 place-items-center rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  <Icon className="size-3.5" />
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {t.shortLabel}
                </span>
              </div>
              <div className="line-clamp-1 text-xs font-bold text-foreground mt-1">{t.label}</div>
              <div className="line-clamp-1 text-[11px] text-muted-foreground">{t.desc}</div>
            </button>
          )
        })}
      </div>

      {(activeTab === 'camera' || activeTab === 'all') && (
        <EquipmentRosterCard
          title="Kontrol No. Kamera"
          addLabel="Tambah Kontrol Kamera"
          codeLabel="Kontrol Kamera"
          placeholder="Contoh: TRN-CAM-01"
          apiPath="/api/camera-equipment"
          listKey="cameras"
          departments={departments}
        />
      )}

      {activeTab === 'all' && <div className="h-px bg-border" />}

      {(activeTab === 'photoId' || activeTab === 'all') && (
        <EquipmentRosterCard
          title="No. ID Photography"
          addLabel="Tambah ID Photography"
          codeLabel="ID Photography"
          placeholder="Contoh: PHOTO-ID-001"
          apiPath="/api/photo-id-equipment"
          listKey="photoIds"
          departments={departments}
        />
      )}

      {activeTab === 'all' && <div className="h-px bg-border" />}

      {(activeTab === 'usb' || activeTab === 'all') && (
        <EquipmentRosterCard
          title="Kontrol No. USB"
          addLabel="Tambah Kontrol USB"
          codeLabel="Kontrol USB"
          placeholder="Contoh: USB-IT-01"
          apiPath="/api/usb-equipment"
          listKey="usbList"
          departments={departments}
        />
      )}

      {activeTab === 'all' && <div className="h-px bg-border" />}

      {(activeTab === 'smartDevice' || activeTab === 'all') && (
        <EquipmentRosterCard
          title="Kontrol No. Smart Device"
          addLabel="Tambah Smart Device"
          codeLabel="Smart Device"
          placeholder="Contoh: SMT-QA-01 atau TAB-IT-01"
          apiPath="/api/smart-device-equipment"
          listKey="smartDeviceList"
          departments={departments}
        />
      )}
    </div>
  )
}
