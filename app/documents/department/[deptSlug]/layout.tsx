import type { Metadata } from 'next'
import { titleFor } from '@/lib/portal-data'

export async function generateMetadata({ params }: { params: Promise<{ deptSlug: string }> }): Promise<Metadata> {
  const { deptSlug } = await params
  return {
    title: `${titleFor(deptSlug)} — ISMS Portal`,
    description: `Dokumen departemen ${titleFor(deptSlug)} PT. Jatim Autocomp Indonesia`,
  }
}

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  return children
}
