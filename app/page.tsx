// app/page.tsx

import { HeroCarousel } from '@/components/home/HeroCarousel'
import { ImageShowcase } from '@/components/home/ImageShowcase'
import { ScheduleRow } from '@/components/home/ScheduleRow'

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <HeroCarousel />
      <ImageShowcase />
      <ScheduleRow kind="audit" />
      <ScheduleRow kind="training" />
    </div>
  )
}
