// lib/portal-data.ts

// Top-level navbar items (excludes "Departemen / Section", which is
// rendered separately in Navbar since its content comes from the
// /api/departments endpoint, and "Kelola Departemen", which is only
// shown to logged-in admins).
export const mainNav = [
  { label: 'Home', href: '/' },
  { label: 'ISMS Basic Policy', href: '/kebijakan-dasar-ISMS' },
  { label: 'Education & Training', href: '/education' },
] as const

export const titleFor = (segment: string) =>
  decodeURIComponent(segment)
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

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