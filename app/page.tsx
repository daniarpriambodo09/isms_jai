// app/page.tsx

import { HeroCarousel } from '@/components/home/HeroCarousel'
import { ImageShowcase } from '@/components/home/ImageShowcase'
import { IsmsPulse } from '@/components/home/IsmsPulse'
import { SecurityPillars } from '@/components/home/SecurityPillars'
import { ScheduleSection } from '@/components/home/ScheduleSection'

export default function Page() {
  return (
    <div className="flex flex-col">
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
