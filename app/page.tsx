// app/page.tsx

import { HeroCarousel } from '@/components/home/HeroCarousel'
import { ImageShowcase } from '@/components/home/ImageShowcase'
import { ScheduleRow } from '@/components/home/ScheduleRow'

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <HeroCarousel />
      <ImageShowcase />
      <ScheduleRow title="Upcoming Audit Schedule" endpoint="audit-schedule" />
      <ScheduleRow title="Upcoming Training Schedule" endpoint="training-schedule" />
    </div>
  )
}
