// app/admin-lobby/page.tsx

'use client'

import { Suspense, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { KioskLoginForm } from '@/components/kiosk/KioskLoginForm'
import { LobbyView } from '@/components/kiosk/LobbyView'
import { StationOff, StationNotice, useKioskStations } from '@/components/kiosk/kiosk-stations-ui'

function AdminLobbyContent() {
  const { adminUser, isLoading } = useAuth()
  const [revealView, setRevealView] = useState(false)
  const stations = useKioskStations()
  const sawLoginForm = useRef(false)

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>

  const canAccess = adminUser?.role === 'lobby' || adminUser?.role === 'ism_admin'

  // Already had a valid session (e.g. page reload) — skip straight to the view, no login flash.
  // A fresh login instead keeps rendering the same KioskLoginForm instance so its success
  // celebration finishes playing before this swaps to the real kiosk view.
  if (canAccess && (revealView || !sawLoginForm.current)) {
    if (!stations) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>
    // Switched off in Pengaturan Pos: registration is centralised at Pos Security.
    if (!stations.lobby) return <StationOff station="lobby" isIsmAdmin={adminUser?.role === 'ism_admin'} />
    // Pos Security off: this post handles every guest on its own (it already has every button).
    return <>{!stations.security && <StationNotice text="Pos Security sedang dinonaktifkan — semua pendaftaran tamu, vendor dan supplier dilakukan di Admin Lobby." />}<LobbyView /></>
  }

  sawLoginForm.current = true
  return <KioskLoginForm title="Admin Lobby" subtitle="Login khusus admin Lobby" onCelebrationDone={() => setRevealView(true)} />
}

export default function AdminLobbyPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>}>
      <AdminLobbyContent />
    </Suspense>
  )
}
