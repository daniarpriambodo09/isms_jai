import { describe, it, expect } from 'vitest'
import { DOC_KINDS, DOC_KIND_INFO, docKindInfo, isDocKind } from './document-kinds'

describe('document kinds', () => {
  it('every kind has its own page and list API', () => {
    const paths = DOC_KINDS.map((kind) => DOC_KIND_INFO[kind].path)
    const apis = DOC_KINDS.map((kind) => DOC_KIND_INFO[kind].api)
    expect(new Set(paths).size).toBe(DOC_KINDS.length)
    expect(new Set(apis).size).toBe(DOC_KINDS.length)
    for (const kind of DOC_KINDS) {
      expect(DOC_KIND_INFO[kind].path).toMatch(/^\/[a-z0-9-]+$/)
      expect(DOC_KIND_INFO[kind].api).toMatch(/^\/api\/[a-z0-9-]+$/)
    }
  })

  it('recognises valid kinds only', () => {
    expect(isDocKind('procedure')).toBe(true)
    expect(isDocKind('working_standard')).toBe(true)
    expect(isDocKind('tmmin_standard')).toBe(true)
    expect(isDocKind('working-standard')).toBe(false)
    expect(isDocKind(null)).toBe(false)
  })

  it('falls back to procedure for anything unknown', () => {
    expect(docKindInfo('working_standard').label).toBe('Working Standard')
    expect(docKindInfo(undefined).label).toBe('Prosedur ISMS')
    expect(docKindInfo('something else').path).toBe('/prosedur-isms')
  })
})
