// app/basic-policy/page.tsx
import { Download, ShieldCheck } from 'lucide-react'

export default function PolicyPage() {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)_280px] gap-5 max-[900px]:grid-cols-1">
      <article className="max-w-[840px] rounded-[9px] border border-[#e4edf2] bg-white p-[36px_42px] shadow-[0_2px_8px_rgba(34,58,79,0.025)] max-[680px]:p-[25px_20px]">
        <div className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.13em] text-[#7290a5]">
          FOUNDATION
        </div>
        <h2 className="max-w-[570px] text-[28px] text-[#20354a] tracking-[-0.025em] max-[680px]:text-[23px]">
          Basic Policy on Information Security
        </h2>
        <p className="my-5 max-w-[650px] text-[16px] leading-[1.7] text-[#5e7588]">
          We recognize information as one of our most important assets and are committed to
          protecting it through a systematic, risk-based approach.
        </p>

        <div className="my-[29px] h-px bg-[#dfebef]" />

        <h3 className="mt-[25px] mb-2 text-[15px] text-[#2d485e]">Our commitment</h3>
        <p className="text-[13px] leading-[1.75] text-[#697e90]">
          All employees, contractors, and business partners share responsibility for maintaining
          the confidentiality, integrity, and availability of information entrusted to our
          organization.
        </p>
        <p className="text-[13px] leading-[1.75] text-[#697e90]">
          Our Information Security Management System provides a framework for identifying risks,
          applying appropriate controls, and continuously improving how we protect information
          across every department.
        </p>

        <h3 className="mt-[25px] mb-2 text-[15px] text-[#2d485e]">Policy principles</h3>
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-[1.75] text-[#697e90]">
          <li>Comply with applicable laws, regulations, and contractual requirements.</li>
          <li>Manage information security risks proportionately and transparently.</li>
          <li>Promote awareness and accountability at every level.</li>
          <li>Review this policy regularly to ensure it remains fit for purpose.</li>
        </ul>
      </article>

      <aside className="flex h-fit flex-col gap-2 rounded-[9px] border border-[#e4edf2] bg-white p-[23px] shadow-[0_2px_8px_rgba(34,58,79,0.025)] max-[900px]:max-w-none">
        <div className="mb-2 grid h-[39px] w-[39px] place-items-center rounded-[8px] bg-[#e1f4f0] text-[#27847f] [&>svg]:w-5">
          <ShieldCheck />
        </div>
        <strong className="text-[12px] text-[#375268]">Policy owner</strong>
        <span className="text-[11px] text-[#8295a5]">Information Security Committee</span>

        <div className="mt-4 flex flex-col gap-[5px] border-t border-[#e7eef1] pt-[15px]">
          <span className="text-[10px] text-[#8b9da9]">Last reviewed</span>
          <strong className="text-[11px]">12 February 2025</strong>
        </div>

        <button
          type="button"
          className="mt-[10px] inline-flex w-full items-center justify-center gap-2 rounded-[7px] border border-[#dbe6ec] bg-white px-4 py-[10px] text-[13px] font-medium text-[#3c5369] hover:bg-[#f7fafc] [&>svg]:w-4"
        >
          <Download /> Download PDF
        </button>
      </aside>
    </section>
  )
}