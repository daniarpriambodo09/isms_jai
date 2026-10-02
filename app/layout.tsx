// app/layout.tsx

// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { PortalFrame } from '@/components/portal-frame'
import { AuthProvider } from '@/context/AuthContext'
import { ButtonPressEffects } from '@/components/button-press-effects'
import { ThemeApplier } from '@/components/theme-applier'
import { Toaster } from '@/components/toast'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import { API_BASE_PATH } from '@/lib/config'

// Metadata URLs don't get the basePath automatically.
export const metadata: Metadata = {
  title: 'ISMS Portal | Information Security Management System',
  description: 'Internal information security policies, documents, and audit schedules.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: `${API_BASE_PATH}/icon-light-32x32.png`,
        media: '(prefers-color-scheme: light)',
      },
      {
        url: `${API_BASE_PATH}/icon-dark-32x32.png`,
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: `${API_BASE_PATH}/icon.svg`,
        type: 'image/svg+xml',
      },
    ],
    apple: `${API_BASE_PATH}/apple-icon.png`,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef3f5' },
    { media: '(prefers-color-scheme: dark)', color: '#182832' },
  ],
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="bg-background" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <PortalFrame>{children}</PortalFrame>
          <ButtonPressEffects />
          <ThemeApplier />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
