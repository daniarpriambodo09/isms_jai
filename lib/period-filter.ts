// lib/period-filter.ts

export const MONTH_LABELS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// Distinct years present in a list, newest first — drives the "Tahun" filter options.
export function availableYears<T>(items: T[], getDate: (item: T) => string): number[] {
  const years = new Set<number>()
  for (const item of items) years.add(new Date(getDate(item)).getFullYear())
  return Array.from(years).sort((a, b) => b - a)
}

export function matchesPeriod(dateValue: string, month: string, year: string): boolean {
  const date = new Date(dateValue)
  if (year && date.getFullYear() !== Number(year)) return false
  if (month && date.getMonth() !== Number(month)) return false
  return true
}
