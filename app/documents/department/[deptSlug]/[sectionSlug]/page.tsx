// app/documents/department/[deptSlug]/[sectionSlug]/page.tsx
'use client'

import { notFound } from 'next/navigation'
import { use, useCallback, useEffect, useState } from 'react'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentRegisterPage } from '@/components/documents/DocumentRegisterPage'
import { slugify } from '@/lib/slug'
import { DEPARTMENTS_CHANGED } from '@/lib/department-events'

type Section = { id: number; name: string; slug: string }
type Department = { id: number; name: string; slug: string; sections: Section[] }

export default function SectionDocumentsPage({
  params,
}: {
  params: Promise<{ deptSlug: string; sectionSlug: string }>
}) {
  const { deptSlug, sectionSlug } = use(params)
  const [state, setState] = useState<
    { department: Department; section: Section } | null | undefined
  >(undefined)

  const load = useCallback(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { departments: Department[] }) => {
        const department = data.departments.find(
          (item) => item.slug === deptSlug || slugify(item.name) === deptSlug || String(item.id) === deptSlug
        )
        const section = department?.sections.find(
          (item) => item.slug === sectionSlug || slugify(item.name) === sectionSlug || String(item.id) === sectionSlug
        )
        setState(department && section ? { department, section } : null)
      })
      .catch(() => setState(null))
  }, [deptSlug, sectionSlug])

  useEffect(() => {
    load()
    window.addEventListener(DEPARTMENTS_CHANGED, load)
    return () => window.removeEventListener(DEPARTMENTS_CHANGED, load)
  }, [load])

  if (state === undefined) {
    return <p className="p-6 text-center text-[13px] text-[color:var(--p-muted)]">Memuat section...</p>
  }

  if (state === null) notFound()

  return <DocumentRegisterPage department={state.department} section={state.section} />
}