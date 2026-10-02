// app/api/prosedur-isms/route.ts — the Prosedur ISMS register.
// The handlers are shared with Working Standard (lib/controlled-documents-api.ts).

import { documentHandlers } from '@/lib/controlled-documents-api'

export const dynamic = 'force-dynamic'

const handlers = documentHandlers('procedure')

export const GET = handlers.GET
export const POST = handlers.POST
export const PUT = handlers.PUT
export const PATCH = handlers.PATCH
export const DELETE = handlers.DELETE
