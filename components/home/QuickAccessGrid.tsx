import Link from 'next/link'
import { BookOpen, CalendarDays, ClipboardList, FileText, GraduationCap, Shield } from 'lucide-react'

const ITEMS = [
  { title: 'Kebijakan Dasar ISMS', description: 'Landasan kebijakan keamanan informasi', href: '/kebijakan-dasar-ISMS', icon: Shield },
  { title: 'Prosedur ISMS', description: 'Panduan proses dan tata kerja ISMS', href: '/prosedur-isms', icon: BookOpen },
  { title: 'Working Standard', description: 'Standar kerja operasional', href: '/working-standard', icon: ClipboardList },
  { title: 'Education & Training', description: 'Materi edukasi dan pelatihan', href: '/education', icon: GraduationCap },
  { title: 'Forms & CS Control', description: 'Formulir dan kontrol dokumen', href: '/form-aplikasi', icon: FileText },
  { title: 'Jadwal Audit', description: 'Jadwal audit internal ISMS', href: '/audits', icon: CalendarDays },
] as const

export function QuickAccessGrid() {
  return (
    <section>
      <div className="mb-4">
        <p className="portal-eyebrow">Quick Access</p>
        <h2 className="mt-1 text-xl font-bold text-foreground">Akses Cepat</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
              <item.icon className="size-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
