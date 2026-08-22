// app/page.tsx
'use client'

import Link from 'next/link'
import { CalendarDays, ChevronRight, FileText, Megaphone, ShieldCheck } from 'lucide-react'
import { announcements } from '@/lib/portal-data'
import { useAuth } from '@/context/AuthContext'

const stats = [
  ['Total documents', '248', '+12 this quarter', <FileText />, 'text-[#3178a4] bg-[#e6f1f8]'],
  ['Active policies', '96', '92% of document library', <ShieldCheck />, 'text-[#228b83] bg-[#e1f3f0]'],
  ['Upcoming audits', '03', 'Next audit in 8 days', <CalendarDays />, 'text-[#b17625] bg-[#fbf0dc]'],
  ['New announcements', '07', '2 unread updates', <Megaphone />, 'text-[#596f89] bg-[#ebeff4]'],
] as const

const iconTone = ['bg-[#e6f2f8] text-[#347ca5]', 'bg-[#e1f4f0] text-[#278e84]', 'bg-[#fbf1de] text-[#a6752f]']

export default function Page() {
  const { isLoggedIn } = useAuth()

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5 mb-7 max-[680px]:flex-col max-[680px]:items-start">
        <div>
          <div className="mb-[9px] flex flex-wrap items-center gap-[10px]">
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
              MONDAY, 24 FEBRUARY 2025
            </span>
            {isLoggedIn && (
              <span className="inline-flex items-center gap-[6px] rounded-full bg-[#e1f4f0] px-[10px] py-[4px] text-[10px] font-bold uppercase tracking-[0.08em] text-[#278e84]">
                <ShieldCheck className="w-[12px]" /> Admin Mode
              </span>
            )}
          </div>
          <p className="mt-[7px] text-[13px] leading-[1.5] text-[#75889c]">
            Here is the latest overview of your information security workspace.
          </p>
        </div>
        <Link
          href="/audits"
          className="inline-flex items-center gap-2 rounded-[8px] bg-[#1c2e46] px-4 py-[10px] text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(28,46,70,0.25)] hover:bg-[#26395a] max-[680px]:w-full max-[680px]:justify-center [&>svg]:w-4"
        >
          <CalendarDays /> View audit schedule
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-[26px] max-[900px]:grid-cols-2">
        {stats.map(([label, value, detail, icon, tone]) => (
          <article
            key={label}
            className="flex items-start gap-[15px] rounded-2xl border border-[#e6ecf3] bg-white p-[19px] shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] max-[680px]:gap-[10px] max-[680px]:p-[14px]"
          >
            <div className={`grid h-[35px] w-[35px] flex-none place-items-center rounded-[8px] ${tone} [&>svg]:w-[18px]`}>
              {icon}
            </div>
            <div>
              <div className="mb-[5px] text-[11px] text-[#71859a] max-[680px]:text-[10px]">{label}</div>
              <div className="text-[25px] font-bold leading-none text-[#243c53] max-[680px]:text-[21px]">
                {value}
              </div>
              <div className="mt-[7px] text-[10px] text-[#7a95a6] max-[680px]:text-[9px]">{detail}</div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-5 max-[900px]:grid-cols-1 max-[680px]:gap-[13px]">
        <section className="rounded-[12px] border border-[#e6ecf3] bg-white p-[23px_24px] shadow-[0_4px_14px_rgba(30,49,71,0.05)] max-[680px]:p-[18px_15px]">
          <div className="flex items-center justify-between gap-5 mb-[15px]">
            <div>
              <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
                KEEP INFORMED
              </div>
              <h2 className="text-[17px] text-[#20354a] tracking-[-0.025em]">Latest announcements</h2>
            </div>
            <Link
              className="flex items-center gap-1 text-[12px] text-[#2c858b] [&>svg]:w-[14px]"
              href="/news"
            >
              View all <ChevronRight />
            </Link>
          </div>

          {announcements.map((item, index) => (
            <Link
              className="grid w-full grid-cols-[32px_1fr_auto_15px] items-center gap-3 border-t border-[#edf1f4] py-[14px] text-left hover:[&_strong]:text-[#197a83] max-[680px]:grid-cols-[30px_1fr_14px] max-[680px]:gap-[9px]"
              href="/news"
              key={item[0]}
            >
              <div className={`grid h-8 w-8 place-items-center rounded-[7px] ${iconTone[index]} [&>svg]:w-[15px]`}>
                <Megaphone />
              </div>
              <div>
                <strong className="block text-[12px] font-semibold text-[#31485e]">{item[0]}</strong>
                <span className="mt-1 block text-[11px] text-[#8798a8]">{item[1]}</span>
              </div>
              <time className="whitespace-nowrap text-[10px] text-[#92a1ae] max-[680px]:hidden">{item[2]}</time>
              <ChevronRight className="w-[14px] text-[#a4b3c0]" />
            </Link>
          ))}
        </section>

        <section className="rounded-[12px] border border-[#e6ecf3] bg-white p-[23px_24px] shadow-[0_4px_14px_rgba(30,49,71,0.05)] max-[680px]:p-[18px_15px]">
          <div className="flex items-center justify-between gap-5 mb-[15px]">
            <div>
              <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
                PLANNING
              </div>
              <h2 className="text-[17px] text-[#20354a] tracking-[-0.025em]">Next audit</h2>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-[13px] rounded-[10px] border border-[#dcf0ec] bg-[#f2faf8] p-[15px]">
            <div className="flex h-[50px] w-12 flex-col items-center justify-center rounded-[6px] bg-[#dff1ef] text-[#23847d]">
              <span className="text-[9px] font-bold">MAR</span>
              <strong className="text-[23px] leading-none">03</strong>
            </div>
            <div>
              <strong className="block text-[13px] text-[#30465b]">Internal ISMS Audit</strong>
              <span className="mt-[5px] block text-[11px] text-[#7c91a1]">Production &amp; QA</span>
            </div>
          </div>

          <Link className="flex items-center gap-1 text-[12px] text-[#2c858b] [&>svg]:w-[14px]" href="/audits">
            View full schedule <ChevronRight />
          </Link>
        </section>
      </div>
    </>
  )
}