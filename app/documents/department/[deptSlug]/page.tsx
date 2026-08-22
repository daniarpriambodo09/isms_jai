// app/documents/department/[deptSlug]/page.tsx
'use client'

import { notFound } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import { API_BASE_PATH } from '@/lib/config'
import { DocumentRegisterPage } from '@/components/documents/DocumentRegisterPage'

type Department = { id: number; name: string; slug: string; sections: { id: number; name: string; slug: string }[] }

export default function DepartmentDocumentsPage({
  params,
}: {
  params: Promise<{ deptSlug: string }>
}) {
  const { deptSlug } = use(params)
  const [department, setDepartment] = useState<Department | null | undefined>(undefined)

  useEffect(() => {
    fetch(`${API_BASE_PATH}/api/departments`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { departments: Department[] }) => {
        const found = data.departments.find((item) => item.slug === deptSlug)
        setDepartment(found ?? null)
      })
      .catch(() => setDepartment(null))
  }, [deptSlug])

  if (department === undefined) {
    return <p className="p-6 text-center text-[13px] text-[#8599a8]">Memuat departemen...</p>
  }

  if (department === null) notFound()

  return <DocumentRegisterPage department={department} section={null} />
}