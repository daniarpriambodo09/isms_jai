// lib/slug.ts
//
// Shared slugify helper for departments, sections, and categories.

export function slugify(value: string): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

