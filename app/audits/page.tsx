// app/audits/page.tsx

import { CalendarDays } from 'lucide-react'
import { audits } from '@/lib/portal-data'

const timeline = [
  ['MAR', '03', 'Q1 Audit', 'In 8 days'],
  ['MAY', '19', 'Security review', 'In 75 days'],
  ['AUG', '04', 'Q3 Audit', 'In 152 days'],
] as const

export default function AuditsPage() {
  return (
    <section className="rounded-[9px] border border-[#e4edf2] bg-white p-[27px] shadow-[0_2px_8px_rgba(34,58,79,0.025)] max-[680px]:p-[18px_15px]">
      <div className="flex items-start justify-between gap-5 mb-6 max-[680px]:flex-col">
        <div>
          <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
            MONITORING
          </div>
          <h2 className="text-[20px] text-[#20354a] tracking-[-0.025em]">Internal audit schedule</h2>
          <p className="mt-[7px] text-[13px] leading-[1.5] text-[#75889c]">
            Upcoming audit activities across the ISMS scope.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 self-center rounded-[7px] border border-[#dbe6ec] bg-white px-4 py-[10px] text-[13px] font-medium text-[#3c5369] hover:bg-[#f7fafc] [&>svg]:w-4"
        >
          <CalendarDays /> Add to calendar
        </button>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-[7px] border border-[#deeaef] bg-[#deeaef] max-[680px]:grid-cols-1">
        {timeline.map(([month, day, label, eta], index) => (
          <div
            key={day}
            className={`flex items-center gap-[13px] p-[18px] max-[680px]:p-[13px_15px] ${
              index === 0 ? 'bg-[#edf8f7]' : 'bg-[#f7fafc]'
            }`}
          >
            <div className="flex flex-col items-center border-r border-[#dbe8eb] pr-[15px]">
              <span className="text-[9px] font-bold text-[#7195a1]">{month}</span>
              <strong className="text-[22px] leading-[1.1] text-[#277e83]">{day}</strong>
            </div>
            <div>
              <strong className="block text-[12px] text-[#425c70]">{label}</strong>
              <span className="mt-1 block text-[10px] text-[#8498a7]">{eta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[7px] border border-[#e6edf1]">
        <table className="w-full min-w-[760px] border-collapse text-[12px]">
          <thead>
            <tr>
              {['Start', 'End', 'Period', 'Activities', 'Auditee', 'Auditor'].map((head) => (
                <th
                  key={head}
                  className="whitespace-nowrap bg-[#f7fafc] px-[15px] py-[13px] text-left text-[9px] font-bold uppercase tracking-[0.07em] text-[#72889c]"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audits.map((row) => (
              <tr key={row[0]}>
                {row.map((value) => (
                  <td
                    key={value}
                    className="whitespace-nowrap border-t border-[#edf1f4] px-[15px] py-[14px] text-[#62768a]"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}