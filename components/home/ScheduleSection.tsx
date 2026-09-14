'use client'

// Fetches the admin-managed schedule categories once and renders one
// ScheduleRow per category that actually has files — Home no longer
// hardcodes "audit" and "training" as the only two kinds.

import { useEffect, useState } from 'react'
import { API_BASE_PATH } from '@/lib/config'
import { ScheduleRow } from '@/components/home/ScheduleRow'

type Category = { id: number; slug: string; label: string; sort_order: number }
type ScheduleDocument = {
  id: number
  kind: string
  file_path: string
  mime_type: string
  title: string | null
  description: string | null
  uploaded_at: string
  uploaded_by: string | null
}

export function ScheduleSection() {
  const [categories, setCategories] = useState<Category[]>([])
  const [documents, setDocuments] = useState<ScheduleDocument[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_PATH}/api/schedule-categories`, { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { categories: [] })),
      fetch(`${API_BASE_PATH}/api/schedule-documents`, { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { documents: [] })),
    ])
      .then(([catData, docData]) => {
        setCategories(catData.categories ?? [])
        setDocuments(docData.documents ?? [])
      })
      .catch(() => {
        setCategories([])
        setDocuments([])
      })
  }, [])

  return (
    <>
      {categories.map((category) => (
        <ScheduleRow key={category.id} label={category.label} docs={documents.filter((doc) => doc.kind === category.slug)} />
      ))}
    </>
  )
}
