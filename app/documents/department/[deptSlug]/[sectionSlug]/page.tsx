// app/documents/department/[deptSlug]/[sectionSlug]/page.tsx
'use client'

import { notFound } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentRegisterPage } from '@/components/documents/DocumentRegisterPage'

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

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { departments: Department[] }) => {
        const department = data.departments.find((item) => item.slug === deptSlug)
        const section = department?.sections.find((item) => item.slug === sectionSlug)
        setState(department && section ? { department, section } : null)
      })
      .catch(() => setState(null))
  }, [deptSlug, sectionSlug])

  if (state === undefined) {
    return <p className="p-6 text-center text-[13px] text-[#8599a8]">Memuat section...</p>
  }

  if (state === null) notFound()

  return <DocumentRegisterPage department={state.department} section={state.section} />
}