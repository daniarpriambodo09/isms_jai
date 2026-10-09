// lib/review-form.ts
//
// "Form Review & Revisi Dokumen ISMS" (ISMS-F-001-001): what the form holds,
// and its validation — shared by the fill-in dialog and the API. The filled
// form becomes a PDF (lib/review-form-pdf.ts) that goes through the same
// e-sign approval as the other registers (kind 'review_form'). Client-safe.

export const REVIEW_LEVELS = [1, 2, 3, 4] as const
export const REVIEW_DOC_TYPES = [
  ['flow', 'Flow Process'],
  ['form', 'Form Record'],
  ['checksheet', 'Checksheet'],
  ['lain', 'Lain-lain'],
] as const
export const REVIEW_RESULTS = [
  ['relevan', 'Relevan'],
  ['revisi', 'Tidak relevan dan perlu revisi'],
  ['ditarik', 'Ditarik'],
] as const
// Longest "Detail revisi". The form itself holds two written lines; the PDF
// continues a longer text in the blank space beside the signature boxes and,
// past that, on an attached page (lib/review-form-pdf.ts).
export const DETAIL_REVISI_MAX = 3000
export const REVIEW_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export type ReviewDocType = (typeof REVIEW_DOC_TYPES)[number][0]
export type ReviewResult = (typeof REVIEW_RESULTS)[number][0]

export type ReviewFormData = {
  /** Kontrol No. Form — also the form's number in the register. */
  formNo: string
  reviewRequestedAt: string // YYYY-MM-DD
  revisionDoneAt: string | null
  approvalDoneAt: string | null
  effectiveAt: string | null
  level: 1 | 2 | 3 | 4 | null
  docType: ReviewDocType | null
  /** The document under review. */
  docControlNo: string
  docTitle: string
  oldRevision: string
  // Detail review dokumen — why
  reasonNew: boolean
  reasonPeriodic: boolean
  periodMonth: number | null // 1–12
  periodYear: number | null
  standardsChange: string
  regulationChange: string
  requestFrom: string
  // …and the outcome
  result: ReviewResult | null
  withdrawnFrom: string | null
  detailRevisi: string
}

export const EMPTY_REVIEW_FORM: ReviewFormData = {
  formNo: '', reviewRequestedAt: '', revisionDoneAt: null, approvalDoneAt: null, effectiveAt: null,
  level: null, docType: null, docControlNo: '', docTitle: '', oldRevision: '',
  reasonNew: false, reasonPeriodic: false, periodMonth: null, periodYear: null,
  standardsChange: '', regulationChange: '', requestFrom: '',
  result: null, withdrawnFrom: null, detailRevisi: '',
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const optionalDate = (v: unknown) => (isDate(v) ? v : null)

/** A clean ReviewFormData, or the message telling what is wrong with the input. */
export function parseReviewForm(raw: unknown): ReviewFormData | string {
  const r = (raw ?? {}) as Record<string, unknown>
  const formNo = text(r.formNo, 50).toUpperCase()
  const docTitle = text(r.docTitle, 200)
  if (!formNo) return 'Kontrol No. Form wajib diisi.'
  if (!isDate(r.reviewRequestedAt)) return 'Tanggal pengajuan review wajib diisi.'
  if (!docTitle) return 'Title dokumen / judul wajib diisi.'

  const level = REVIEW_LEVELS.find((n) => n === Number(r.level)) ?? null
  const docType = REVIEW_DOC_TYPES.find(([key]) => key === r.docType)?.[0] ?? null
  const result = REVIEW_RESULTS.find(([key]) => key === r.result)?.[0] ?? null
  const reasonPeriodic = r.reasonPeriodic === true
  const month = Number(r.periodMonth)
  const year = Number(r.periodYear)
  const data: ReviewFormData = {
    formNo,
    reviewRequestedAt: r.reviewRequestedAt,
    revisionDoneAt: optionalDate(r.revisionDoneAt),
    approvalDoneAt: optionalDate(r.approvalDoneAt),
    effectiveAt: optionalDate(r.effectiveAt),
    level,
    docType,
    docControlNo: text(r.docControlNo, 60),
    docTitle,
    oldRevision: text(r.oldRevision, 20),
    reasonNew: r.reasonNew === true,
    reasonPeriodic,
    periodMonth: reasonPeriodic && Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    periodYear: reasonPeriodic && Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
    standardsChange: text(r.standardsChange, 120),
    regulationChange: text(r.regulationChange, 120),
    requestFrom: text(r.requestFrom, 120),
    result,
    withdrawnFrom: result === 'ditarik' ? optionalDate(r.withdrawnFrom) : null,
    detailRevisi: text(r.detailRevisi, DETAIL_REVISI_MAX),
  }
  if (!data.reasonNew && !data.reasonPeriodic && !data.standardsChange && !data.regulationChange && !data.requestFrom) {
    return 'Pilih minimal satu alasan review (pembuatan baru, review berkala, perubahan standar/regulasi, atau permintaan).'
  }
  if (data.reasonPeriodic && (!data.periodMonth || !data.periodYear)) return 'Isi bulan dan tahun review berkala.'
  if (!data.result) return 'Pilih hasil review: relevan, perlu revisi, atau ditarik.'
  if (data.result === 'ditarik' && !data.withdrawnFrom) return 'Isi tanggal mulai ditarik.'
  return data
}

/** How the form is listed in the register. */
export function reviewFormTitle(data: Pick<ReviewFormData, 'docTitle' | 'docControlNo'>) {
  return `Form Review — ${data.docControlNo ? `${data.docControlNo} ` : ''}${data.docTitle}`.slice(0, 250)
}

// Which signature box a position signs in, by its name; the first three
// positions fill Prepared → Checked → Approval when the names don't say.
export type ReviewBox = 'prepared' | 'checked' | 'approval'
export function reviewBoxes(roleTitles: string[]): (ReviewBox | null)[] {
  const byName = (title: string): ReviewBox | null =>
    /prepar|dibuat|pembuat/i.test(title) ? 'prepared' : /check|periksa/i.test(title) ? 'checked' : /approv|setuj|sah/i.test(title) ? 'approval' : null
  const taken = new Set<ReviewBox>()
  const boxes = roleTitles.map((title) => { const box = byName(title); if (!box || taken.has(box)) return null; taken.add(box); return box })
  const order: ReviewBox[] = ['prepared', 'checked', 'approval']
  return boxes.map((box) => { if (box) return box; const free = order.find((b) => !taken.has(b)); if (free) taken.add(free); return free ?? null })
}

/**
 * The box of the Form Review a position signs in, when the form travels with
 * a Prosedur ISMS / TMMIN document: by the position's name (Prepared /
 * Checked / Approval), else by its code as the form prints it (SSA under
 * Checked, IAA under Approval), else in order Prepared → Checked → Approval.
 */
export function reviewBoxesForRoles(roles: { code: string; title: string }[]): (ReviewBox | null)[] {
  const byName = reviewBoxes(roles.map((role) => role.title))
  const named = roles.map((role, i) => {
    if (/prepar|dibuat|pembuat|check|periksa|approv|setuj/i.test(role.title)) return byName[i]
    if (/^SSA$|security administrator/i.test(`${role.code} ${role.title}`.trim()) || role.code === 'SSA') return 'checked' as const
    if (role.code === 'IAA' || /assets administrator/i.test(role.title)) return 'approval' as const
    return null
  })
  const taken = new Set(named.filter(Boolean))
  const order: ReviewBox[] = ['prepared', 'checked', 'approval']
  return named.map((box) => { if (box) return box; const free = order.find((b) => !taken.has(b)); if (free) taken.add(free); return free ?? null })
}

/** The filled-in form in words, for the approval e-mail's "Ringkasan form". */
export function reviewFormSummary(data: ReviewFormData) {
  const reasons: string[] = []
  if (data.reasonNew) reasons.push('Pembuatan baru')
  if (data.reasonPeriodic) reasons.push(`Review berkala${data.periodMonth && data.periodYear ? ` ${REVIEW_MONTHS[data.periodMonth - 1]} ${data.periodYear}` : ''}`)
  if (data.standardsChange) reasons.push(`Perubahan standards: ${data.standardsChange}`)
  if (data.regulationChange) reasons.push(`Perubahan regulasi: ${data.regulationChange}`)
  if (data.requestFrom) reasons.push(`Permintaan dari: ${data.requestFrom}`)
  const result = REVIEW_RESULTS.find(([key]) => key === data.result)?.[1] ?? '-'
  return {
    formNo: data.formNo,
    docControlNo: data.docControlNo,
    docTitle: data.docTitle,
    oldRevision: data.oldRevision,
    reasons,
    result: data.result === 'ditarik' && data.withdrawnFrom ? `${result} mulai ${data.withdrawnFrom.split('-').reverse().join('-')}` : result,
    // The e-mail only summarises: a long text is on the attached form.
    detailRevisi: data.detailRevisi.length > 320 ? `${data.detailRevisi.slice(0, 300).replace(/\s+\S*$/, '')}… (selengkapnya di formulir terlampir)` : data.detailRevisi,
  }
}
