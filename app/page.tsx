// app/page.tsx

import { HeroCarousel } from '@/components/home/HeroCarousel'
import { ImageShowcase } from '@/components/home/ImageShowcase'
import { ScheduleSection } from '@/components/home/ScheduleSection'

export default function Page() {
  return (
    <div className="flex flex-col">
      <HeroCarousel />
      {/* No gap against the hero above — both share the same dark backdrop
          color so the video blends straight into the image strip below it. */}
      <div className="flex flex-col">
        <ImageShowcase />
        <ScheduleSection />
      </div>
    </div>
  )
}
