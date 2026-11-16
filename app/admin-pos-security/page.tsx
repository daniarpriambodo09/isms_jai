// app/admin-pos-security/page.tsx

'use client'

import { Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import { KioskLoginForm } from '@/components/kiosk/KioskLoginForm'
import { KioskTheme } from '@/components/kiosk/KioskTheme'
import { SecurityView } from '@/components/kiosk/SecurityView'
import { LobbyView } from '@/components/kiosk/LobbyView'
import { StationOff, StationNotice, useKioskStations } from '@/components/kiosk/kiosk-stations-ui'

function AdminPosSecurityContent() {
  const { adminUser, isLoading } = useAuth()
  const stations = useKioskStations()

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>

  const canAccess = adminUser?.role === 'security' || adminUser?.role === 'ism_admin'

  if (canAccess) {
    if (!stations) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>
    // Switched off in Pengaturan Pos: registration is centralised at the Admin Lobby.
    if (!stations.security) return <StationOff station="security" isIsmAdmin={adminUser?.role === 'ism_admin'} />
    // Admin Lobby off: registration is centralised here — this post gets the
    // whole flow (register, issue and swap every card), as the Lobby has it.
    if (!stations.lobby) {
      return (
        <>
          <StationNotice text="Admin Lobby sedang dinonaktifkan — semua pendaftaran tamu, vendor dan supplier dipusatkan di Pos Security." />
          <LobbyView station="security" />
        </>
      )
    }
    return <SecurityView />
  }

  return <KioskLoginForm title="Pos Security" subtitle="Login khusus admin Pos Security" />
}

export default function AdminPosSecurityPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>}>
      <KioskTheme station="security" />
      <AdminPosSecurityContent />
    </Suspense>
  )
}
