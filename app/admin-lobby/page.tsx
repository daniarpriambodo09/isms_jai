// app/admin-lobby/page.tsx

'use client'

import { Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import { KioskLoginForm } from '@/components/kiosk/KioskLoginForm'
import { KioskTheme } from '@/components/kiosk/KioskTheme'
import { LobbyView } from '@/components/kiosk/LobbyView'
import { StationOff, StationNotice, useKioskStations } from '@/components/kiosk/kiosk-stations-ui'

function AdminLobbyContent() {
  const { adminUser, isLoading } = useAuth()
  const stations = useKioskStations()

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>

  const canAccess = adminUser?.role === 'lobby' || adminUser?.role === 'ism_admin'

  if (canAccess) {
    if (!stations) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>
    // Switched off in Pengaturan Pos: registration is centralised at Pos Security.
    if (!stations.lobby) return <StationOff station="lobby" isIsmAdmin={adminUser?.role === 'ism_admin'} />
    // Pos Security off: this post handles every guest on its own (it already has every button).
    return (
      <>
        {!stations.security && (
          <StationNotice text="Pos Security sedang dinonaktifkan — semua pendaftaran tamu, vendor dan supplier dilakukan di Admin Lobby." />
        )}
        <LobbyView />
      </>
    )
  }

  return <KioskLoginForm title="Admin Lobby" subtitle="Login khusus admin Lobby" />
}

export default function AdminLobbyPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>}>
      <KioskTheme station="lobby" />
      <AdminLobbyContent />
    </Suspense>
  )
}
