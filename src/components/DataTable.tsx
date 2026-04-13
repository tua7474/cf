'use client'

interface Column {
  key: string
  label: string
  type?: 'number' | 'currency' | 'percent' | 'date' | 'text'
  align?: 'left' | 'right' | 'center'
  editable?: boolean
}

interface DataTableProps {
  columns: Column[]
  rows: Record<string, unknown>[]
  summary?: Record<string, number>
  pendingEdits?: Record<string, Record<string, number>>
  onCellEdit?: (rowKey: string, colKey: string, value: number) => void
  rowKeyField?: string
  groupByField?: string
}

function fmt(value: unknown, type?: string): string {
  if (value === null || value === undefined || value === '') return '-'
  if (type === 'currency') {
    const n = parseFloat(String(value))
    return isNaN(n) ? '-' : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (type === 'number') {
    const n = parseFloat(String(value))
    return isNaN(n) ? '-' : n.toLocaleString('th-TH', { maximumFractionDigits: 3 })
  }
  if (type === 'percent') {
    const n = parseFloat(String(value))
    return isNaN(n) ? '-' : n.toFixed(2) + '%'
  }
  if (type === 'date') {
    const d = new Date(String(value))
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  return String(value)
}

export default function DataTable({ columns, rows, summary, pendingEdits = {}, onCellEdit, rowKeyField = 'id', groupByField }: DataTableProps) {
  // Build flattened list with optional group header entries
  type Entry = { type: 'group'; label: string } | { type: 'row'; row: Record<string, unknown>; idx: number }
  const entries: Entry[] = []
  if (groupByField) {
    let lastGroup = ''
    let dataIdx = 0
    for (const row of rows) {
      const g = String(row[groupByField] ?? '')
      if (g !== lastGroup) {
        entries.push({ type: 'group', label: g })
        lastGroup = g
      }
      entries.push({ type: 'row', row, idx: dataIdx++ })
    }
  } else {
    rows.forEach((row, idx) => entries.push({ type: 'row', row, idx }))
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-green-700 text-white">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-semibold whitespace-nowrap border-r border-green-600 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
              >
                {col.label}{col.editable && <span className="ml-1 text-green-200 text-xs">✎</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-gray-400">ไม่มีข้อมูล</td>
            </tr>
          ) : (
            entries.map((entry, ei) => {
              if (entry.type === 'group') {
                return (
                  <tr key={`g-${ei}`} className="bg-gray-600 text-white">
                    <td colSpan={columns.length} className="px-3 py-1.5 font-bold text-sm tracking-wide">
                      {entry.label}
                    </td>
                  </tr>
                )
              }
              const { row, idx: i } = entry
              const rowKey = String(row[rowKeyField])
              const rowEdits = pendingEdits[rowKey] ?? {}
              return (
                <tr key={`r-${rowKey}`} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${Object.keys(rowEdits).length > 0 ? 'ring-1 ring-inset ring-yellow-400' : ''}`}>
                  {columns.map((col) => {
                    const hasPending = col.key in rowEdits
                    const displayValue = hasPending ? rowEdits[col.key] : row[col.key]

                    if (col.editable && onCellEdit) {
                      return (
                        <td key={col.key} className="px-1 py-0.5 border-r border-gray-100 last:border-r-0">
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={parseFloat(String(displayValue)) || 0}
                            key={`${rowKey}-${col.key}-${hasPending ? rowEdits[col.key] : row[col.key]}`}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value)
                              if (!isNaN(v)) onCellEdit(rowKey, col.key, v)
                            }}
                            className={`w-full text-right px-2 py-1 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${hasPending ? 'border-yellow-400 bg-yellow-50 font-medium' : 'border-gray-200 bg-white'}`}
                          />
                        </td>
                      )
                    }

                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-1.5 border-r border-gray-100 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.type === 'currency' && parseFloat(String(displayValue)) < 0 ? 'text-red-600' : ''}`}
                      >
                        {fmt(displayValue, col.type)}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          )}
        </tbody>
        {summary && (
          <tfoot>
            <tr className="bg-green-50 font-semibold border-t-2 border-green-300">
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2 border-r border-gray-200 last:border-r-0 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.key in summary ? fmt(summary[col.key], col.type) : col.key === columns[0].key ? 'รวม' : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
