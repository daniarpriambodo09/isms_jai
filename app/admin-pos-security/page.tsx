// app/admin-pos-security/page.tsx

'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { KioskLoginForm } from '@/components/kiosk/KioskLoginForm'
import { SecurityView } from '@/components/kiosk/SecurityView'

export default function AdminPosSecurityPage() {
  const { adminUser, isLoading } = useAuth()
  const [revealView, setRevealView] = useState(false)
  const sawLoginForm = useRef(false)

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Memuat...</div>

  const canAccess = adminUser?.role === 'security' || adminUser?.role === 'ism_admin'

  // Already had a valid session (e.g. page reload) — skip straight to the view, no login flash.
  // A fresh login instead keeps rendering the same KioskLoginForm instance so its success
  // celebration finishes playing before this swaps to the real kiosk view.
  if (canAccess && (revealView || !sawLoginForm.current)) return <SecurityView />

  sawLoginForm.current = true
  return <KioskLoginForm title="Pos Security" subtitle="Login khusus admin Pos Security" onCelebrationDone={() => setRevealView(true)} />
}
