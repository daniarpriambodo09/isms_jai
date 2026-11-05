import type { Metadata } from 'next'
import { titleFor } from '@/lib/portal-data'
import { query } from '@/lib/db'

export async function generateMetadata({ params }: { params: Promise<{ deptSlug: string }> }): Promise<Metadata> {
  const { deptSlug } = await params
  let deptName = titleFor(deptSlug)
  try {
    const res = await query<{ name: string }>('SELECT name FROM departments WHERE slug = $1 LIMIT 1', [deptSlug])
    if (res.rows[0]?.name) {
      deptName = res.rows[0].name
    }
  } catch {
    // fallback to titleFor
  }

  return {
    title: `${deptName} — ISMS Portal`,
    description: `Dokumen departemen ${deptName} PT. Jatim Autocomp Indonesia`,
  }
}

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  return children
}
