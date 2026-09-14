// app/page.tsx

import { HeroCarousel } from '@/components/home/HeroCarousel'
import { ImageShowcase } from '@/components/home/ImageShowcase'
import { ScheduleSection } from '@/components/home/ScheduleSection'

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <HeroCarousel />
      {/* No gaps or headers between these — one continuous strip of images. */}
      <div className="flex flex-col">
        <ImageShowcase />
        <ScheduleSection />
      </div>
    </div>
  )
}
