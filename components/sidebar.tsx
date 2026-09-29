// // components/sidebar.tsx
// 'use client'

// import Link from 'next/link'
// import { usePathname } from 'next/navigation'
// import { useState } from 'react'
// import {
//   BookOpen,
//   CalendarDays,
//   ChevronDown,
//   ChevronRight,
//   ClipboardCheck,
//   FileText,
//   FolderOpen,
//   Home,
//   Megaphone,
//   ShieldCheck,
//   X,
// } from 'lucide-react'
// import { departments, navGroups, routeFor } from '@/lib/portal-data'
// import { cn } from '@/lib/utils'

// const linkBase =
//   'flex w-full min-h-[39px] items-center gap-[11px] rounded-[7px] px-3 py-[9px] mb-[2px] text-left text-[13px] text-[color:var(--p-muted2)] transition-colors duration-[180ms] ease-out hover:bg-white/[0.07] hover:text-white [&>svg]:h-4 [&>svg]:w-4 [&>svg]:flex-none cursor-pointer'
// const linkActive = 'bg-[color:var(--p-850)] text-white shadow-[inset_3px_0_0_var(--p-400)]'

// export function Sidebar({
//   open,
//   setOpen,
// }: {
//   open: boolean
//   setOpen: (value: boolean) => void
// }) {
//   const pathname = usePathname()
//   const [expanded, setExpanded] = useState(Object.keys(navGroups))

//   const toggle = (item: string) =>
//     setExpanded((items) =>
//       items.includes(item) ? items.filter((value) => value !== item) : [...items, item]
//     )

//   const item = (label: string, icon: React.ReactNode) => (
//     <Link
//       href={routeFor(label)}
//       onClick={() => setOpen(false)}
//       className={cn(linkBase, pathname === routeFor(label) && linkActive)}
//     >
//       {icon}
//       <span>{label}</span>
//     </Link>
//   )

//   return (
//     <>
//       <div
//         className={cn(
//           'fixed inset-0 z-10 hidden bg-[color-mix(in_oklch,_var(--p-950)_38%,_transparent)]',
//           open && 'max-[680px]:block'
//         )}
//         onClick={() => setOpen(false)}
//       />

//       <aside
//         className={cn(
//           'flex w-[270px] flex-none flex-col sticky top-0 z-20 h-screen min-h-screen bg-[color:var(--p-950)] text-[color:var(--p-border)]',
//           'max-[900px]:w-[250px]',
//           'max-[680px]:fixed max-[680px]:left-0 max-[680px]:top-0 max-[680px]:-translate-x-full max-[680px]:shadow-[8px_0_30px_color-mix(in_oklch,_var(--p-950)_15%,_transparent)] max-[680px]:transition-transform max-[680px]:duration-200 max-[680px]:ease-in-out',
//           open && 'max-[680px]:translate-x-0'
//         )}
//       >
//         <div className="flex min-h-[86px] items-center gap-3 border-b border-white/[0.09] px-[23px] py-[22px]">
//           <div className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[10px] bg-[color:var(--p-700)] text-[color:var(--p-tint)]">
//             <ShieldCheck className="h-[22px] w-[22px]" />
//           </div>
//           <div>
//             <div className="text-[16px] font-bold tracking-[-0.02em] text-white">ISMS Portal</div>
//             <div className="mt-[2px] text-[10px] uppercase tracking-[0.07em] text-[color:var(--p-muted2)]">
//               Information Security
//             </div>
//           </div>
//           <button
//             className="ml-auto hidden cursor-pointer border-0 bg-transparent text-[color:var(--p-muted2)] max-[680px]:grid max-[680px]:place-items-center [&>svg]:w-5"
//             onClick={() => setOpen(false)}
//             aria-label="Close navigation"
//           >
//             <X />
//           </button>
//         </div>

//         <div className="overflow-y-auto px-3 pt-[22px] pb-[14px] [scrollbar-width:thin]">
//           <div className="px-3 pb-[9px] text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--p-muted)]">
//             Workspace
//           </div>
//           {item('Home', <Home />)}
//           {item('Informasi Baru', <Megaphone />)}
//           {item('Basic Policy', <BookOpen />)}

//           <div className="mt-6 px-3 pb-[9px] text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--p-muted)]">
//             Document library
//           </div>
//           {Object.entries(navGroups).map(([group, children]) => (
//             <div key={group}>
//               <button className={cn(linkBase, 'cursor-pointer')} onClick={() => toggle(group)}>
//                 {group === 'ISMS Standard' ? (
//                   <ClipboardCheck />
//                 ) : group === 'ISMS Form & CS' ? (
//                   <FileText />
//                 ) : (
//                   <FolderOpen />
//                 )}
//                 <span>{group}</span>
//                 {expanded.includes(group) ? (
//                   <ChevronDown className="ml-auto h-[14px] w-[14px] text-[color:var(--p-muted)]" />
//                 ) : (
//                   <ChevronRight className="ml-auto h-[14px] w-[14px] text-[color:var(--p-muted)]" />
//                 )}
//               </button>

//               {expanded.includes(group) && (
//                 <div className="ml-5 mt-[1px] mb-[5px] flex flex-col gap-[1px] border-l border-[color:var(--p-750)] py-[2px] pl-3">
//                   {children.map((child) => (
//                     <Link
//                       key={child}
//                       href={routeFor(child)}
//                       onClick={() => setOpen(false)}
//                       className={cn(
//                         'w-full rounded-[5px] px-2 py-[7px] text-left text-[12px] text-[color:var(--p-muted2)] hover:bg-[color:var(--p-400)]/[0.13] hover:text-[color:var(--p-tint)]',
//                         pathname === routeFor(child) && 'bg-[color:var(--p-400)]/[0.13] text-[color:var(--p-tint)]'
//                       )}
//                     >
//                       {child}
//                     </Link>
//                   ))}
//                 </div>
//               )}
//             </div>
//           ))}

//           <div className="mt-6 px-3 pb-[9px] text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--p-muted)]">
//             Monitoring
//           </div>
//           {item('Jadwal Audit', <CalendarDays />)}
//         </div>
//       </aside>
//     </>
//   )
// }