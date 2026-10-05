// app/page.tsx

import { HeroCarousel } from '@/components/home/HeroCarousel'
import { ImageShowcase } from '@/components/home/ImageShowcase'
import { IsmsPulse } from '@/components/home/IsmsPulse'
import { SecurityPillars } from '@/components/home/SecurityPillars'
import { ScheduleSection } from '@/components/home/ScheduleSection'
import { AdminTodo } from '@/components/home/AdminTodo'

export default function Page() {
  return (
    <div className="flex flex-col">
      {/* ISM Admin only: what needs attention, before the visitors' Home. */}
      <AdminTodo />
      <HeroCarousel />
      {/* Each section below opens with a numbered chapter band
          (components/home/ChapterHeader.tsx); .home-chapters resets the counter. */}
      <div className="home-chapters flex flex-col">
        <IsmsPulse />
        <SecurityPillars />
        <ImageShowcase />
        <ScheduleSection />
      </div>
    </div>
  )
}
