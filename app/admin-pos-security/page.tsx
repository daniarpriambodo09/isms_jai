// app/admin-pos-security/page.tsx

'use client'

import { Suspense, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { KioskLoginForm } from '@/components/kiosk/KioskLoginForm'
import { SecurityView } from '@/components/kiosk/SecurityView'
import { LobbyView } from '@/components/kiosk/LobbyView'
import { StationOff, StationNotice, useKioskStations } from '@/components/kiosk/kiosk-stations-ui'

function AdminPosSecurityContent() {
  const { adminUser, isLoading } = useAuth()
  const [revealView, setRevealView] = useState(false)
  const stations = useKioskStations()
  const sawLoginForm = useRef(false)

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>

  const canAccess = adminUser?.role === 'security' || adminUser?.role === 'ism_admin'

  // Pos Security has its own view: guests are registered and approved here with the
  // Security cards; the Lobby's cards (and its "register + issue a card" buttons) are another set.
  // Already had a valid session (e.g. page reload) — skip straight to the view, no login flash.
  // A fresh login instead keeps rendering the same KioskLoginForm instance so its success
  // celebration finishes playing before this swaps to the real kiosk view.
  if (canAccess && (revealView || !sawLoginForm.current)) {
    if (!stations) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>
    // Switched off in Pengaturan Pos: registration is centralised at the Admin Lobby.
    if (!stations.security) return <StationOff station="security" isIsmAdmin={adminUser?.role === 'ism_admin'} />
    // Admin Lobby off: registration is centralised here — this post gets the
    // whole flow (register, issue and swap every card), as the Lobby has it.
    if (!stations.lobby) return <><StationNotice text="Admin Lobby sedang dinonaktifkan — semua pendaftaran tamu, vendor dan supplier dipusatkan di Pos Security." /><LobbyView station="security" /></>
    return <SecurityView />
  }

  sawLoginForm.current = true
  return <KioskLoginForm title="Pos Security" subtitle="Login khusus admin Pos Security" onCelebrationDone={() => setRevealView(true)} />
}

export default function AdminPosSecurityPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>}>
      <AdminPosSecurityContent />
    </Suspense>
  )
}
