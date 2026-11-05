// app/documents/department/[deptSlug]/page.tsx
'use client'

import { notFound } from 'next/navigation'
import { use, useCallback, useEffect, useState } from 'react'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentRegisterPage } from '@/components/documents/DocumentRegisterPage'
import { slugify } from '@/lib/slug'
import { DEPARTMENTS_CHANGED } from '@/lib/department-events'

type Department = { id: number; name: string; slug: string; sections: { id: number; name: string; slug: string }[] }

export default function DepartmentDocumentsPage({
  params,
}: {
  params: Promise<{ deptSlug: string }>
}) {
  const { deptSlug } = use(params)
  const [department, setDepartment] = useState<Department | null | undefined>(undefined)

  const load = useCallback(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { departments: Department[] }) => {
        const found = data.departments.find(
          (item) => item.slug === deptSlug || slugify(item.name) === deptSlug || String(item.id) === deptSlug
        )
        setDepartment(found ?? null)
      })
      .catch(() => setDepartment(null))
  }, [deptSlug])

  useEffect(() => {
    load()
    window.addEventListener(DEPARTMENTS_CHANGED, load)
    return () => window.removeEventListener(DEPARTMENTS_CHANGED, load)
  }, [load])

  if (department === undefined) {
    return <p className="p-6 text-center text-[13px] text-[color:var(--p-muted)]">Memuat departemen...</p>
  }

  if (department === null) notFound()

  return <DocumentRegisterPage department={department} section={null} />
}