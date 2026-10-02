// app/api/working-standard/route.ts — the Working Standard register.
// Working standards go through the same e-sign approval as procedures, so the
// handlers are shared (lib/controlled-documents-api.ts).

import { documentHandlers } from '@/lib/controlled-documents-api'

export const dynamic = 'force-dynamic'

const handlers = documentHandlers('working_standard')

export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
