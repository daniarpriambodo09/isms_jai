// lib/document-kinds.ts
//
// The kinds of controlled document that go through "Catatan Pengesahan"
// (e-sign approval with QR): they share one table (procedure_documents.kind)
// and one approval engine (lib/procedure-approval.ts), and differ only in
// where they are listed and what they are called. Client-safe.

export const DOC_KINDS = ['procedure', 'working_standard', 'tmmin_standard', 'review_form'] as const
export type DocKind = (typeof DOC_KINDS)[number]

export const DOC_KIND_INFO: Record<DocKind, {
  /** The kind itself (e-mails pick their look by it). */
  key: DocKind
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
  procedure: { key: 'procedure', label: 'Prosedur ISMS', short: 'Prosedur', noun: 'prosedur', path: '/prosedur-isms', api: '/api/prosedur-isms' },
  working_standard: { key: 'working_standard', label: 'Working Standard', short: 'Working Standard', noun: 'working standard', path: '/working-standard', api: '/api/working-standard' },
  // Not uploaded but filled in on the portal (lib/review-form.ts); its PDF is generated.
  review_form: { key: 'review_form', label: 'Form Review Dokumen', short: 'Form Review', noun: 'form review dokumen', path: '/form-review-dokumen', api: '/api/form-review' },
  tmmin_standard: { key: 'tmmin_standard', label: 'Standard Requirement TMMIN', short: 'Standard TMMIN', noun: 'standard requirement TMMIN', path: '/standard-isms-p14', api: '/api/standard-isms-p14' },
}

export function isDocKind(value: unknown): value is DocKind {
  return typeof value === 'string' && (DOC_KINDS as readonly string[]).includes(value)
}

/** Kind info for a value read from the database (unknown → procedure). */
export function docKindInfo(kind: unknown) {
  return DOC_KIND_INFO[isDocKind(kind) ? kind : 'procedure']
}
