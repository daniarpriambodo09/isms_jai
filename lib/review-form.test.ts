import { describe, it, expect } from 'vitest'
import { parseReviewForm, reviewBoxes, reviewFormTitle } from './review-form'

const base = { formNo: ' 002/isms/10/2026 ', reviewRequestedAt: '2026-10-05', docTitle: '  ISMS   Division Profile ', reasonNew: true, result: 'relevan' }

describe('Form Review & Revisi Dokumen', () => {
  it('cleans a valid form', () => {
    const form = parseReviewForm({ ...base, level: '3', docType: 'form', docControlNo: 'ISMS-B-005' })
    expect(form).toMatchObject({ formNo: '002/ISMS/10/2026', docTitle: 'ISMS Division Profile', level: 3, docType: 'form', result: 'relevan', withdrawnFrom: null })
    expect(reviewFormTitle(form as never)).toBe('Form Review — ISMS-B-005 ISMS Division Profile')
  })

  it('says what is missing', () => {
    expect(parseReviewForm({ ...base, formNo: '' })).toMatch(/Kontrol No\. Form/)
    expect(parseReviewForm({ ...base, reviewRequestedAt: '05/10/2026' })).toMatch(/Tanggal pengajuan/)
    expect(parseReviewForm({ ...base, reasonNew: false })).toMatch(/alasan review/)
    expect(parseReviewForm({ ...base, reasonNew: false, reasonPeriodic: true })).toMatch(/bulan dan tahun/)
    expect(parseReviewForm({ ...base, result: 'lainnya' })).toMatch(/hasil review/)
    expect(parseReviewForm({ ...base, result: 'ditarik' })).toMatch(/mulai ditarik/)
  })

  it('keeps month / year and the withdrawal date only where they apply', () => {
    expect(parseReviewForm({ ...base, periodMonth: 5, periodYear: 2026, withdrawnFrom: '2026-11-01' })).toMatchObject({ periodMonth: null, periodYear: null, withdrawnFrom: null })
    expect(parseReviewForm({ ...base, reasonPeriodic: true, periodMonth: 5, periodYear: 2026, result: 'ditarik', withdrawnFrom: '2026-11-01' })).toMatchObject({ periodMonth: 5, periodYear: 2026, withdrawnFrom: '2026-11-01' })
  })

  it('puts each position in its box by name, the rest in the boxes still free', () => {
    expect(reviewBoxes(['Prepared', 'Checked (SSA)', 'Approval (IAA)'])).toEqual(['prepared', 'checked', 'approval'])
    expect(reviewBoxes(['Approval (IAA)', 'Dibuat oleh', 'Diperiksa'])).toEqual(['approval', 'prepared', 'checked'])
    expect(reviewBoxes(['Staff', 'Manager'])).toEqual(['prepared', 'checked'])
    expect(reviewBoxes(['Prepared', 'Prepared 2', 'Checked', 'Approval', 'Direktur'])).toEqual(['prepared', null, 'checked', 'approval', null])
  })
})
