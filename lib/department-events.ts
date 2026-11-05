// lib/department-events.ts
//
// Client event fired whenever a department or section is added, renamed,
// or deleted in Manage Departments (/kelola-departemen), keeping the
// navbar dropdown, page heroes, and route curtains instantly in sync.

export const DEPARTMENTS_CHANGED = 'isms:departments-changed'

export function departmentsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEPARTMENTS_CHANGED))
  }
}

