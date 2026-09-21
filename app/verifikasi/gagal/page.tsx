// app/verifikasi/gagal/page.tsx

'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { XCircle } from 'lucide-react'

function VerifikasiGagalContent() {
  const searchParams = useSearchParams()
  const message = searchParams.get('message') ?? 'Link tidak valid.'

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <XCircle className="mx-auto size-12 text-destructive" />
      <p className="mt-4 text-sm font-semibold text-foreground">{message}</p>
    </div>
  )
}

export default function VerifikasiGagalPage() {
  return (
    <Suspense fallback={null}>
      <VerifikasiGagalContent />
    </Suspense>
  )
}
