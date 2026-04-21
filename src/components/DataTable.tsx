'use client'

import { useState } from 'react'

interface Column {
  key: string
  label: string
  type?: 'number' | 'currency' | 'percent' | 'date' | 'text'
  align?: 'left' | 'right' | 'center'
  editable?: boolean
  confirmOnEdit?: boolean   // show confirm dialog on blur before calling onCellEdit
  confirmMsg?: (oldVal: string, newVal: string) => string
}

interface DataTableProps {
  columns: Column[]
  rows: Record<string, unknown>[]
  summary?: Record<string, number>
  pendingEdits?: Record<string, Record<string, string | number>>
  onCellEdit?: (rowKey: string, colKey: string, value: string | number) => void
  rowKeyField?: string
  groupByField?: string
  onAddRow?: (data: Record<string, string | number>) => void
  existingGroups?: string[]   // for confirmOnEdit group columns
  onDeleteRow?: (rowKey: string) => void
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

// CSS classes for hiding number input spinners
const NO_SPIN = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

export default function DataTable({
  columns, rows, summary,
  pendingEdits = {}, onCellEdit,
  rowKeyField = 'id', groupByField,
  onAddRow, existingGroups = [],
  onDeleteRow,
}: DataTableProps) {
  const [newRow, setNewRow] = useState<Record<string, string>>({})

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

  function handleAdd() {
    if (!onAddRow) return
    const data: Record<string, string | number> = {}
    for (const col of columns) {
      const showInput = col.editable || col.key === groupByField
      if (!showInput) continue
      const raw = newRow[col.key] ?? ''
      const isNumeric = col.type === 'currency' || col.type === 'number'
      data[col.key] = isNumeric ? (parseFloat(raw) || 0) : raw
    }
    onAddRow(data)
    setNewRow({})
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
          {/* ── Add new row ──────────────────────────────────────────────── */}
          {onAddRow && (
            <tr className="bg-blue-50 border-b-2 border-blue-300">
              {columns.map((col, ci) => {
                const showInput = col.editable || col.key === groupByField
                const isNumeric = col.type === 'currency' || col.type === 'number'
                const isLast = ci === columns.length - 1

                return (
                  <td key={col.key} className="px-1 py-1 border-r border-gray-200 last:border-r-0">
                    <div className="flex items-center gap-1">
                      {showInput && (
                        <input
                          type="text"
                          inputMode={isNumeric ? 'numeric' : undefined}
                          placeholder={col.label}
                          value={newRow[col.key] ?? ''}
                          onChange={e => setNewRow(prev => ({ ...prev, [col.key]: e.target.value }))}
                          className={`w-full px-2 py-1 text-sm rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 ${isNumeric ? 'text-right' : ''}`}
                        />
                      )}
                      {isLast && (
                        <button
                          onClick={handleAdd}
                          className="shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded whitespace-nowrap transition-colors"
                        >
                          + เพิ่ม
                        </button>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          )}

          {/* ── Data rows ────────────────────────────────────────────────── */}
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
              const hasPendingRow = Object.keys(rowEdits).length > 0

              return (
                <tr key={`r-${rowKey}`} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${hasPendingRow ? 'ring-1 ring-inset ring-yellow-400' : ''}`}>
                  {columns.map((col) => {
                    const hasPending = col.key in rowEdits
                    const displayValue = hasPending ? rowEdits[col.key] : row[col.key]
                    const isNumeric = col.type === 'currency' || col.type === 'number'

                    if (col.editable && onCellEdit) {
                      if (isNumeric) {
                        return (
                          <td key={col.key} className="px-1 py-0.5 border-r border-gray-100 last:border-r-0">
                            <input
                              type="text"
                              inputMode="numeric"
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
                      // Text editable — with optional confirm-on-blur
                      if (col.confirmOnEdit) {
                        return (
                          <td key={col.key} className="px-1 py-0.5 border-r border-gray-100 last:border-r-0">
                            <input
                              type="text"
                              defaultValue={String(displayValue ?? '')}
                              key={`${rowKey}-${col.key}-${hasPending ? rowEdits[col.key] : row[col.key]}`}
                              onBlur={(e) => {
                                const newVal = e.target.value.trim()
                                const oldVal = String(displayValue ?? '').trim()
                                if (newVal === oldVal) return
                                const groupExists = existingGroups.includes(newVal)
                                const msg = col.confirmMsg
                                  ? col.confirmMsg(oldVal, newVal)
                                  : groupByField && col.key === groupByField
                                    ? `ย้ายสินค้าจากกลุ่ม "${oldVal}" ไปยังกลุ่ม "${newVal}" ใช่หรือไม่?\n\n` +
                                      (groupExists
                                        ? `✅ กลุ่ม "${newVal}" มีอยู่แล้ว — จะย้ายไปต่อท้ายกลุ่มนั้น`
                                        : `🆕 กลุ่ม "${newVal}" ยังไม่มี — จะสร้างกลุ่มใหม่ที่ด้านล่าง`)
                                    : `เปลี่ยนจาก "${oldVal}" เป็น "${newVal}" ใช่หรือไม่?`
                                if (!window.confirm(msg)) {
                                  e.target.value = oldVal   // revert
                                  return
                                }
                                onCellEdit(rowKey, col.key, newVal)
                              }}
                              className={`w-full px-2 py-1 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${hasPending ? 'border-yellow-400 bg-yellow-50 font-medium' : 'border-gray-200 bg-white'}`}
                            />
                          </td>
                        )
                      }
                      return (
                        <td key={col.key} className="px-1 py-0.5 border-r border-gray-100 last:border-r-0">
                          <input
                            type="text"
                            defaultValue={String(displayValue ?? '')}
                            key={`${rowKey}-${col.key}-${hasPending ? rowEdits[col.key] : row[col.key]}`}
                            onChange={(e) => onCellEdit(rowKey, col.key, e.target.value)}
                            className={`w-full px-2 py-1 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${hasPending ? 'border-yellow-400 bg-yellow-50 font-medium' : 'border-gray-200 bg-white'}`}
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
                  {onDeleteRow && (
                    <td className="px-2 py-0.5 border-l border-gray-100 w-10 text-center">
                      <button
                        onClick={() => {
                          if (window.confirm('ลบรายการนี้ใช่หรือไม่?')) onDeleteRow(rowKey)
                        }}
                        className="px-2 py-0.5 text-xs rounded bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
                      >
                        ลบ
                      </button>
                    </td>
                  )}
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
