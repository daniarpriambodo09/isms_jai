// lib/activity-log.ts
//
// Audit trail for admin account changes and deletions across the app.
// Logging failures are swallowed (never block the actual operation) since
// the log is a compliance nicety, not a correctness requirement.

import { query } from '@/lib/db'
import type { SessionPayload } from '@/lib/auth'

export type ActivityAction = 'create' | 'update' | 'delete'

export async function logActivity(
  actor: SessionPayload,
  action: ActivityAction,
  entityType: string,
  entityId: string | number | null,
  description: string
) {
  try {
    await query(
      `INSERT INTO activity_log (actor_username, actor_role, action, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actor.username, actor.role, action, entityType, entityId === null ? null : String(entityId), description]
    )
  } catch (error) {
    console.error('[activity-log]', error)
  }
}
