// app/news/page.tsx
import { Bell, ChevronRight } from 'lucide-react'
import { news } from '@/lib/portal-data'

const numberTone = [
  'bg-[#eaf3f7] text-[#347c91]',
  'bg-[#e7f4f1] text-[#287e7a]',
  'bg-[#fbf2e2] text-[#a37638]',
  'bg-[#edf0f5] text-[#63798e]',
]

export default function NewsPage() {
  return (
    <section className="rounded-[9px] border border-[#e4edf2] bg-white p-[27px] shadow-[0_2px_8px_rgba(34,58,79,0.025)] max-[680px]:p-[18px_15px]">
      <div className="flex items-start justify-between gap-5 mb-6 max-[680px]:flex-col">
        <div>
          <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
            NEWSROOM
          </div>
          <h2 className="text-[20px] text-[#20354a] tracking-[-0.025em]">Informasi Baru</h2>
          <p className="mt-[7px] text-[13px] leading-[1.5] text-[#75889c]">
            News, notices, and updates from the Information Security team.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[7px] bg-[#20354a] px-4 py-[10px] text-[13px] font-medium text-white hover:bg-[#284360] [&>svg]:w-4"
        >
          <Bell /> Mark all read
        </button>
      </div>

      <div className="flex flex-col gap-[9px]">
        {news.map((item, index) => (
          <article
            className="grid grid-cols-[44px_1fr_15px] items-center gap-[15px] rounded-[7px] border border-[#e5edf1] p-[19px] hover:border-[#afd9d5] hover:bg-[#fbfefe] max-[680px]:grid-cols-[36px_1fr_12px] max-[680px]:gap-[10px] max-[680px]:p-[14px]"
            key={item[0]}
          >
            <div
              className={`grid h-[38px] w-[38px] place-items-center rounded-[7px] text-[12px] font-bold ${numberTone[index]} max-[680px]:h-8 max-[680px]:w-8 max-[680px]:text-[10px]`}
            >
              0{index + 1}
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#328b87]">
                {item[3]}
              </span>
              <h3 className="my-[6px] text-[14px] text-[#334c61]">{item[0]}</h3>
              <p className="text-[12px] leading-[1.5] text-[#7a8e9e]">{item[1]}</p>
              <time className="mt-[10px] block text-[10px] text-[#91a0ab]">{item[2]}</time>
            </div>
            <ChevronRight className="w-[15px] text-[#9babb7]" />
          </article>
        ))}
      </div>
    </section>
  )
}