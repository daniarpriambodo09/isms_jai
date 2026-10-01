'use client'

// Full-page login for the Lobby / Pos Security kiosks — the same split
// sign-in as the admin login (components/auth-shell.tsx).

import { AuthSplitLogin } from '@/components/auth-shell'

export function KioskLoginForm({
  title,
  subtitle,
  onCelebrationDone,
}: {
  title: string
  subtitle: string
  onCelebrationDone?: () => void
}) {
  return (
    <div className="min-h-screen lg:h-screen">
      <AuthSplitLogin
        kiosk
        eyebrow={`Kiosk · ${title}`}
        title={title}
        subtitle={subtitle}
        successSubtitle={`Membuka ${title}…`}
        onSuccess={() => onCelebrationDone?.()}
      />
    </div>
  )
}
