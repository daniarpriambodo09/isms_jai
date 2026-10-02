// components/documents/TableSkeleton.tsx
//
// Placeholder rows shown inside a register table while its documents load —
// grey bars in the shape of the rows to come, instead of a spinner followed by
// the whole table popping in. (.skeleton in globals.css)

const WIDTHS = [72, 54, 86, 40, 63, 48, 78]

export function TableSkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden className="skeleton-row">
          {Array.from({ length: columns }, (_, column) => (
            <td key={column} className="px-5 py-5">
              <span className="skeleton h-4" style={{ width: `${WIDTHS[(row * 2 + column) % WIDTHS.length]}%`, animationDelay: `${row * 90}ms` }} />
            </td>
          ))}
        </tr>
      ))}
      <tr className="sr-only"><td colSpan={columns}>Memuat dokumen…</td></tr>
    </>
  )
}

/** Same bars for lists that aren't tables. */
export function BlockSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div aria-busy="true" aria-label="Memuat…" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      {Array.from({ length: lines }, (_, line) => (
        <span key={line} className="skeleton h-5" style={{ width: `${WIDTHS[line % WIDTHS.length] + 10}%`, animationDelay: `${line * 90}ms` }} />
      ))}
    </div>
  )
}
