import type { Metadata } from 'next'
import { titleFor } from '@/lib/portal-data'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `${titleFor(slug)} — ISMS Portal`,
    description: `Daftar dokumen ${titleFor(slug)} PT. Jatim Autocomp Indonesia`,
  }
}

export default function DocumentsSlugLayout({ children }: { children: React.ReactNode }) {
  return children
}
