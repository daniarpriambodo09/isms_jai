// lib/portal-data.ts

// Top-level navbar items (excludes "Departemen / Section", which is
// rendered separately in Navbar since its content comes from the
// /api/departments endpoint, and "Kelola Departemen", which is only
// shown to logged-in admins).
export const mainNav = [
  { label: 'Home', href: '/' },
  { label: 'Kebijakan Dasar ISMS', href: '/basic-policy' },
  { label: 'Prosedur ISMS', href: '/documents/standards' },
  { label: 'Working Standard & Standard Requirements TMMIN', href: '/documents/working-standard' },
  { label: 'ISMS Form Aplikasi & Kontrol CS', href: '/documents/forms' },
] as const

export const documents = [
  ['P14-001', 'Prosedur Pengendalian Dokumen', '04', '12 Feb 2025', 'Active', 'pdf'],
  ['P14-002', 'Prosedur Audit Internal ISMS', '03', '08 Jan 2025', 'Active', 'pdf'],
  ['P14-007', 'Standard Pengelolaan Akses Informasi', '02', '19 Nov 2024', 'Active', 'pdf'],
  ['P14-011', 'Working Standard - Incident Response', '01', '03 Oct 2024', 'Active', 'pdf'],
  ['P14-014', 'Form Evaluasi Risiko Keamanan Informasi', '05', '22 Aug 2024', 'Obsolete', 'xls'],
  ['P14-018', 'Checklist Review Kepatuhan Departemen', '02', '14 Jul 2024', 'Active', 'xls'],
] as const

export const audits = [
  ['03 Mar 2025', '07 Mar 2025', 'Q1 / 2025', 'Internal ISMS Audit', 'Production & QA', 'R. Pratama'],
  ['19 May 2025', '23 May 2025', 'Q2 / 2025', 'Information Security Review', 'IT & HR-IR', 'D. Kusuma'],
  ['04 Aug 2025', '08 Aug 2025', 'Q3 / 2025', 'Internal ISMS Audit', 'PPIC-WHS-EXIM', 'R. Pratama'],
] as const

export const titleFor = (segment: string) =>
  decodeURIComponent(segment)
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export type DocumentRow = (typeof documents)[number]

export const announcements = [
  ['ISMS Awareness Training — Q1 2025', 'Mandatory training schedule for all employees', '21 Feb 2025'],
  ['Updated access control procedure', 'Please review the latest revision before 28 Feb', '18 Feb 2025'],
  ['Annual management review completed', 'Summary and action items are now available', '11 Feb 2025'],
] as const

export const news = [
  [
    'ISMS Awareness Training — Q1 2025',
    'Mandatory training schedule for all employees. Please register for one of the available sessions before 28 February.',
    '21 Feb 2025',
    'Training',
  ],
  [
    'Updated access control procedure',
    'Procedure P14-007 has been revised to reflect the latest access review requirements.',
    '18 Feb 2025',
    'Policy update',
  ],
  [
    'Annual management review completed',
    'The annual review of our ISMS has been completed. View the summary and action items below.',
    '11 Feb 2025',
    'Management review',
  ],
  [
    'New document repository structure',
    'A refreshed information architecture is now available to make finding controlled documents easier.',
    '05 Feb 2025',
    'Announcement',
  ],
] as const