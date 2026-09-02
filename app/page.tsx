// app/page.tsx

import { HeroCarousel } from '@/components/home/HeroCarousel'
import { QuickAccessGrid } from '@/components/home/QuickAccessGrid'
import { ScheduleRow } from '@/components/home/ScheduleRow'

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <HeroCarousel />
      <QuickAccessGrid />
      <ScheduleRow title="Upcoming Audit Schedule" endpoint="audit-schedule" />
      <ScheduleRow title="Upcoming Training Schedule" endpoint="training-schedule" />
    </div>
  )
}
