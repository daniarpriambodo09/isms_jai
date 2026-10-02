// lib/document-kinds.ts
//
// The kinds of controlled document that go through "Catatan Pengesahan"
// (e-sign approval with QR): they share one table (procedure_documents.kind)
// and one approval engine (lib/procedure-approval.ts), and differ only in
// where they are listed and what they are called. Client-safe.

export const DOC_KINDS = ['procedure', 'working_standard'] as const
export type DocKind = (typeof DOC_KINDS)[number]

export const DOC_KIND_INFO: Record<DocKind, {
  /** Name of the register / menu. */
  label: string
  /** Short name for headings and e-mail subjects. */
  short: string
  /** How one document of this kind is called in a sentence. */
  noun: string
  /** Portal page listing them. */
  path: string
  /** Its list API (GET/POST/PUT/PATCH/DELETE). */
  api: string
}> = {
  procedure: { label: 'Prosedur ISMS', short: 'Prosedur', noun: 'prosedur', path: '/prosedur-isms', api: '/api/prosedur-isms' },
  working_standard: { label: 'Working Standard', short: 'Working Standard', noun: 'working standard', path: '/working-standard', api: '/api/working-standard' },
}

export function isDocKind(value: unknown): value is DocKind {
  return typeof value === 'string' && (DOC_KINDS as readonly string[]).includes(value)
}

/** Kind info for a value read from the database (unknown → procedure). */
export function docKindInfo(kind: unknown) {
  return DOC_KIND_INFO[isDocKind(kind) ? kind : 'procedure']
}
