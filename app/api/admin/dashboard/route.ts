// app/api/admin/dashboard/route.ts
//
// ISM Admin dashboard: everything that needs attention, in one response —
// procedure approvals in progress / sent back, photo & special-area requests
// waiting, today's visitors, documents due for review and
// policy-acknowledgement coverage.

import { NextRequest, NextResponse } from 'next/server'
import { getIsmsAdminFromRequest } from '@/lib/auth'
import { query } from '@/lib/db'
import { listPendingSteps } from '@/lib/procedure-approval'
import { listReviewItems, REVIEW_MONTHS } from '@/lib/document-review'
import { currentPolicyVersion } from '@/lib/policy-ack'

export const dynamic = 'force-dynamic'

async function count(sql: string, params: unknown[] = []) {
  try {
    return Number((await query<{ n: number }>(sql, params)).rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}

const TODAY_WIB = "(now() AT TIME ZONE 'Asia/Jakarta')::date"

export async function GET(request: NextRequest) {
  if (!getIsmsAdminFromRequest(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  try {
    const [pendingSteps, review, policy] = await Promise.all([
      listPendingSteps(),
      listReviewItems(),
      currentPolicyVersion(),
    ])
    const [
      proceduresRevision, proceduresApprovedMonth, photoPending, specialPending,
      visitsToday, visitorsInside, acknowledged, employeesDepartments, revisionDocs,
    ] = await Promise.all([
      count("SELECT count(*)::int AS n FROM procedure_documents WHERE approval_status = 'rejected'"),
      count(`SELECT count(DISTINCT a.document_id)::int AS n FROM procedure_approvals a JOIN procedure_documents d ON d.id = a.document_id
             WHERE d.approval_status = 'approved' AND a.decided_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Jakarta') AT TIME ZONE 'Asia/Jakarta'`),
      count("SELECT count(*)::int AS n FROM photo_video_requests WHERE status = 'pending'"),
      count("SELECT count(*)::int AS n FROM special_area_requests WHERE status = 'pending'"),
      count(`SELECT count(*)::int AS n FROM vendor_registrations WHERE (registered_at AT TIME ZONE 'Asia/Jakarta')::date = ${TODAY_WIB}`),
      count("SELECT count(*)::int AS n FROM vendor_registrations WHERE stage = 'active'"),
      count('SELECT count(*)::int AS n FROM policy_acknowledgements WHERE policy_version = $1', [policy.version]),
      count('SELECT count(DISTINCT department)::int AS n FROM policy_acknowledgements WHERE policy_version = $1', [policy.version]),
      query<{ id: number; control_no: string; title: string; revision: number }>(
        "SELECT id, control_no, title, revision FROM procedure_documents WHERE approval_status = 'rejected' ORDER BY id DESC LIMIT 6"
      ).then((r) => r.rows).catch(() => []),
    ])

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      procedures: {
        pending: pendingSteps.map((s) => ({
          documentId: s.document_id, controlNo: s.control_no, title: s.title, approver: s.approver_name, role: s.role_code,
          since: s.token_issued_at ?? s.notified_at, emailError: s.email_error,
        })),
        revision: proceduresRevision,
        revisionDocs,
        approvedThisMonth: proceduresApprovedMonth,
      },
      requests: { photoPending, specialPending },
      visits: { today: visitsToday, inside: visitorsInside },
      review: { months: REVIEW_MONTHS, overdue: review.overdue, soon: review.soon },
      policy: { version: policy.version, label: policy.label, acknowledged, departments: employeesDepartments },
    })
  } catch (error) {
    console.error('[admin/dashboard/GET]', error)
    return NextResponse.json({ message: 'Gagal memuat dashboard.' }, { status: 500 })
  }
}
