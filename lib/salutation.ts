// lib/salutation.ts
//
// How an approver is addressed in e-mails: "Dear Bapak Teguh Sunjoyo," /
// "Dear Ibu …," — set per approver where the approver is set (Kelola
// Pengesahan, a document's own approver, Setting Approver Visitor, approver
// Izin Area Special). Without one the e-mail says "Dear <name>,".
// Only the greeting uses it: the name printed on forms and PDFs stays as is.

export const SALUTATIONS = ['Bapak', 'Ibu'] as const
export type Salutation = (typeof SALUTATIONS)[number]

/** A stored / submitted value → 'Bapak' | 'Ibu' | null. */
export function parseSalutation(value: unknown): Salutation | null {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase().replace(/\.$/, '')
  if (text === 'bapak' || text === 'bpk' || text === 'pak') return 'Bapak'
  if (text === 'ibu' || text === 'bu') return 'Ibu'
  return null
}

/** "Bapak " / "Ibu " / "" — what goes between "Dear" and the name. */
export function salutationPrefix(value: unknown): string {
  const salutation = parseSalutation(value)
  return salutation ? `${salutation} ` : ''
}
