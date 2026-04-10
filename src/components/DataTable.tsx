'use client'

interface Column {
  key: string
  label: string
  type?: 'number' | 'currency' | 'percent' | 'date' | 'text'
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps {
  columns: Column[]
  rows: Record<string, unknown>[]
  summary?: Record<string, number>
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

export default function DataTable({ columns, rows, summary }: DataTableProps) {
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
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-gray-400">ไม่มีข้อมูล</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-1.5 border-r border-gray-100 last:border-r-0 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.type === 'currency' && parseFloat(String(row[col.key])) < 0 ? 'text-red-600' : ''}`}
                  >
                    {fmt(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))
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
