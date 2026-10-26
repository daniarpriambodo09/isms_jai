// Planned visit date ("YYYY-MM-DD") from a request body. Empty -> null (walk-in);
// anything that is not a real calendar date -> undefined (reject with 400).
export function parseVisitDate(value: unknown): string | null | undefined {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : undefined
}
