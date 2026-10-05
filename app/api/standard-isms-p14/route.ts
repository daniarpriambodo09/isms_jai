// app/api/standard-isms-p14/route.ts — the Standard Requirement TMMIN register.
// TMMIN standards go through the same e-sign approval as procedures and
// working standards, so the handlers are shared (lib/controlled-documents-api.ts).

import { documentHandlers } from '@/lib/controlled-documents-api'

export const dynamic = 'force-dynamic'

const handlers = documentHandlers('tmmin_standard')

export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
