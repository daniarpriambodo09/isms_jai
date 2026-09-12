// lib/excel-export.ts

import * as XLSX from 'xlsx'

// Real .xlsx workbook (not comma-separated text renamed to .csv) — proper
// column typing, auto-sized columns, and no delimiter/locale mangling when
// opened in Excel.
export function downloadExcel(
  filename: string,
  headers: string[],
  rows: (string | number | null)[][],
  sheetName = 'Data'
) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])

  worksheet['!cols'] = headers.map((header, columnIndex) => {
    const longestValue = rows.reduce((max, row) => {
      const value = row[columnIndex]
      const length = value === null || value === undefined ? 0 : String(value).length
      return Math.max(max, length)
    }, header.length)
    return { wch: Math.min(Math.max(longestValue + 2, 10), 50) }
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  const cleanName = filename.replace(/\.(csv|xlsx)$/i, '')
  XLSX.writeFile(workbook, `${cleanName}.xlsx`)
}
