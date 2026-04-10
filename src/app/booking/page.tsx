'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface BookingRow {
  id: number
  row_order: number
  row_type: 'data' | 'section' | 'summary'
  section_label: string
  left_code: string
  left_name: string
  left_spec: string
  left_qty: string | null
  left_unit: string
  left_price: string | null
  left_amount: string | null
  right_code: string
  right_name: string
  right_qty: string | null
  right_unit: string
  right_price: string | null
  right_amount: string | null
  note: string
}

type PendingEdits = Record<string, Record<string, string>>

// ---------------------------------------------------------------------------
// Column definitions — widths must match image proportions (px)
// Total ≈ 907 px
// ---------------------------------------------------------------------------
const COLS: Array<{
  key: keyof BookingRow
  label: string
  width: number
  align: 'left' | 'center' | 'right'
  inputType: 'text' | 'number'
  panel: 'left' | 'right'
}> = [
  // Left panel
  { key: 'left_code',   label: 'รหัส',       width: 50,  align: 'left',   inputType: 'text',   panel: 'left'  },
  { key: 'left_name',   label: 'ชื่อรายการ', width: 125, align: 'left',   inputType: 'text',   panel: 'left'  },
  { key: 'left_spec',   label: 'ขนาด',       width: 70,  align: 'left',   inputType: 'text',   panel: 'left'  },
  { key: 'left_qty',    label: 'จำนวนสั่ง',  width: 52,  align: 'right',  inputType: 'number', panel: 'left'  },
  { key: 'left_unit',   label: 'หน่วย',      width: 36,  align: 'center', inputType: 'text',   panel: 'left'  },
  { key: 'left_price',  label: 'ราคา/หน่วย', width: 68,  align: 'right',  inputType: 'number', panel: 'left'  },
  { key: 'left_amount', label: 'จำนวนเงิน',  width: 68,  align: 'right',  inputType: 'number', panel: 'left'  },
  // Right panel
  { key: 'right_code',   label: 'รหัส',      width: 48,  align: 'left',   inputType: 'text',   panel: 'right' },
  { key: 'right_name',   label: 'รายการ',    width: 108, align: 'left',   inputType: 'text',   panel: 'right' },
  { key: 'right_qty',    label: 'จำนวน',     width: 48,  align: 'right',  inputType: 'number', panel: 'right' },
  { key: 'right_unit',   label: 'หน่วย',     width: 32,  align: 'center', inputType: 'text',   panel: 'right' },
  { key: 'right_price',  label: 'ราคา',      width: 62,  align: 'right',  inputType: 'number', panel: 'right' },
  { key: 'right_amount', label: 'จำนวนเงิน', width: 62,  align: 'right',  inputType: 'number', panel: 'right' },
  { key: 'note',         label: 'หมายเหตุ',  width: 52,  align: 'left',   inputType: 'text',   panel: 'right' },
]

// Row number column width
const ROW_NUM_W = 26
const TABLE_WIDTH = ROW_NUM_W + COLS.reduce((s, c) => s + c.width, 0)

// ---------------------------------------------------------------------------
// Draft helpers
// ---------------------------------------------------------------------------
const DRAFT_KEY = 'cf_draft_booking'

function loadDraft(): PendingEdits {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveDraft(edits: PendingEdits) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(edits))
}

// ---------------------------------------------------------------------------
// Overflow detection hook per cell
// ---------------------------------------------------------------------------
function useOverflow() {
  const [overflows, setOverflows] = useState<Set<string>>(new Set())

  const check = useCallback((id: number, field: string, el: HTMLInputElement | null) => {
    if (!el) return
    const key = `${id}-${field}`
    const isOver = el.scrollWidth > el.clientWidth
    setOverflows((prev) => {
      const has = prev.has(key)
      if (isOver === has) return prev
      const next = new Set(prev)
      isOver ? next.add(key) : next.delete(key)
      return next
    })
  }, [])

  return { overflows, check }
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------
function fmtNum(val: string | null): string {
  if (val === null || val === '') return ''
  const n = parseFloat(val)
  return isNaN(n) ? val : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ---------------------------------------------------------------------------
// EditableCell
// ---------------------------------------------------------------------------
function EditableCell({
  rowId,
  field,
  dbValue,
  pendingValue,
  inputType,
  align,
  width,
  hasPending,
  onChange,
  overflows,
  checkOverflow,
  readOnly,
}: {
  rowId: number
  field: string
  dbValue: string | null
  pendingValue: string | undefined
  inputType: 'text' | 'number'
  align: 'left' | 'center' | 'right'
  width: number
  hasPending: boolean
  onChange: (id: number, field: string, value: string) => void
  overflows: Set<string>
  checkOverflow: (id: number, field: string, el: HTMLInputElement | null) => void
  readOnly?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cellKey = `${rowId}-${field}`
  const isOver = overflows.has(cellKey)

  const displayValue = hasPending ? (pendingValue ?? '') : (dbValue ?? '')

  // Re-check overflow whenever displayValue changes
  useEffect(() => {
    checkOverflow(rowId, field, inputRef.current)
  }, [displayValue, rowId, field, checkOverflow])

  return (
    <td
      className="relative border-r border-gray-200 last:border-r-0 p-0"
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <input
        ref={inputRef}
        type={inputType}
        step={inputType === 'number' ? '0.01' : undefined}
        defaultValue={displayValue}
        key={`${cellKey}-${displayValue}`}
        readOnly={readOnly}
        onChange={(e) => {
          onChange(rowId, field, e.target.value)
          checkOverflow(rowId, field, e.currentTarget)
        }}
        className={`
          w-full h-full px-1 py-0.5 text-xs leading-5 bg-transparent
          focus:outline-none focus:ring-1 focus:ring-inset focus:ring-green-400
          ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}
          ${hasPending ? 'bg-yellow-50 font-medium' : ''}
          ${isOver ? 'border border-red-400 bg-red-50' : ''}
          ${readOnly ? 'cursor-default text-gray-500' : ''}
        `}
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={isOver ? `⚠ ข้อความยาวเกินช่อง: "${displayValue}"` : undefined}
      />
      {isOver && (
        <span
          className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold leading-none px-0.5 py-px rounded-bl pointer-events-none"
          title={`ข้อความยาวเกินช่อง`}
        >
          !
        </span>
      )}
    </td>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function BookingPage() {
  const [rows, setRows] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingEdits>({})
  const { overflows, check: checkOverflow } = useOverflow()

  // Load draft from localStorage on mount
  useEffect(() => {
    setPending(loadDraft())
  }, [])

  // Fetch rows from DB
  useEffect(() => {
    setLoading(true)
    fetch('/api/booking')
      .then((r) => r.json())
      .then((data) => { setRows(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleChange = useCallback((id: number, field: string, value: string) => {
    setPending((prev) => {
      const updated: PendingEdits = {
        ...prev,
        [id]: { ...prev[id], [field]: value },
      }
      saveDraft(updated)
      return updated
    })
  }, [])

  const pendingCount = Object.keys(pending).length

  const handleSave = async () => {
    if (pendingCount === 0) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const body = Object.entries(pending).map(([id, fields]) => ({ id: Number(id), ...fields }))
      const res = await fetch('/api/booking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('save failed')

      setPending({})
      localStorage.removeItem(DRAFT_KEY)
      setSaveMsg(`บันทึกสำเร็จ ${pendingCount} แถว`)

      const fresh = await fetch('/api/booking').then((r) => r.json())
      setRows(fresh)
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  const handleDiscard = () => {
    setPending({})
    localStorage.removeItem(DRAFT_KEY)
  }

  // Count data rows (not section/summary)
  let dataRowIdx = 0

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-green-200 hover:text-white text-sm transition-colors"
          >
            ← กลับหน้าหลัก
          </Link>
          <div>
            <h1 className="text-xl font-bold">ใบจอง</h1>
            <p className="text-green-200 text-xs mt-0.5">แก้ไขได้ทุกช่อง · Auto-save ใน browser</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveMsg && (
            <span
              className={`text-sm px-3 py-1 rounded-full ${
                saveMsg.includes('สำเร็จ') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {saveMsg}
            </span>
          )}
          {pendingCount > 0 && (
            <>
              <span className="text-yellow-300 text-sm">
                ✎ แก้ไขค้างอยู่ {pendingCount} แถว (auto-saved)
              </span>
              <button
                onClick={handleDiscard}
                className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 text-sm rounded bg-yellow-400 hover:bg-yellow-300 text-green-900 font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'กำลังบันทึก...' : '💾 บันทึกลง DB'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Status bar ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-1.5 text-xs text-gray-500 flex items-center gap-4">
        {loading ? 'กำลังโหลด...' : `${rows.filter((r) => r.row_type === 'data').length} แถวข้อมูล`}
        {pendingCount > 0 && (
          <span className="text-yellow-600 font-medium">
            — มีการแก้ไขที่ยังไม่บันทึกลง DB (auto-saved ใน browser แล้ว)
          </span>
        )}
        {overflows.size > 0 && (
          <span className="text-red-500 font-medium">
            ⚠ {overflows.size} ช่องมีข้อความยาวเกิน (ตารางไม่ขยาย)
          </span>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <main className="p-4 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <div
            className="inline-block rounded-lg border border-gray-300 shadow-sm overflow-hidden"
            style={{ width: TABLE_WIDTH }}
          >
            <table
              className="text-xs border-collapse"
              style={{ tableLayout: 'fixed', width: TABLE_WIDTH }}
            >
              {/* ── colgroup — locks every column width ── */}
              <colgroup>
                <col style={{ width: ROW_NUM_W }} />
                {COLS.map((c) => (
                  <col key={c.key} style={{ width: c.width }} />
                ))}
              </colgroup>

              {/* ── thead ── */}
              <thead>
                {/* Panel label row */}
                <tr className="bg-green-900 text-white">
                  <th
                    className="border-r border-green-700 text-center text-[10px]"
                    style={{ width: ROW_NUM_W }}
                  />
                  <th
                    colSpan={7}
                    className="px-2 py-1 text-center font-bold tracking-wide border-r border-green-700"
                  >
                    รายการฝั่งซ้าย
                  </th>
                  <th
                    colSpan={7}
                    className="px-2 py-1 text-center font-bold tracking-wide"
                  >
                    รายการฝั่งขวา
                  </th>
                </tr>
                {/* Column header row */}
                <tr className="bg-green-700 text-white">
                  <th
                    className="border-r border-green-600 text-center text-[10px] py-1"
                    style={{ width: ROW_NUM_W }}
                  >
                    ที่
                  </th>
                  {COLS.map((col, i) => (
                    <th
                      key={col.key}
                      className={`
                        px-1 py-1 font-semibold text-[10px] leading-tight whitespace-nowrap
                        border-r border-green-600 last:border-r-0
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                        ${i === 6 ? 'border-r-2 border-green-400' : ''}
                      `}
                      style={{ width: col.width }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ── tbody ── */}
              <tbody>
                {rows.map((row) => {
                  const rowPending = pending[row.id] ?? {}
                  const hasAnyPending = Object.keys(rowPending).length > 0

                  // ── Section header row ──
                  if (row.row_type === 'section') {
                    const label = rowPending['section_label'] ?? row.section_label
                    return (
                      <tr key={row.id} className="bg-amber-400">
                        <td
                          className="text-center text-[10px] text-amber-900 border-r border-amber-500 py-0.5"
                          style={{ width: ROW_NUM_W }}
                        />
                        <td colSpan={COLS.length} className="p-0">
                          <input
                            type="text"
                            defaultValue={label}
                            key={`sec-${row.id}-${label}`}
                            onChange={(e) => handleChange(row.id, 'section_label', e.target.value)}
                            className="w-full bg-transparent px-2 py-0.5 font-bold text-amber-900 text-xs focus:outline-none focus:ring-1 focus:ring-inset focus:ring-amber-600"
                            placeholder="ชื่อหมวด..."
                          />
                        </td>
                      </tr>
                    )
                  }

                  // ── Summary row ──
                  if (row.row_type === 'summary') {
                    const label = rowPending['section_label'] ?? row.section_label
                    return (
                      <tr key={row.id} className="bg-green-100 font-semibold border-t border-green-300">
                        <td
                          className="text-center text-[10px] border-r border-green-300 py-0.5"
                          style={{ width: ROW_NUM_W }}
                        />
                        {/* Label spanning left panel name+spec */}
                        <td colSpan={3} className="px-2 py-0.5 text-xs text-green-900 font-bold">
                          {label}
                        </td>
                        {/* Left qty / unit / price / amount */}
                        {(['left_qty','left_unit','left_price','left_amount'] as const).map((field) => {
                          const col = COLS.find((c) => c.key === field)!
                          return (
                            <EditableCell
                              key={field}
                              rowId={row.id}
                              field={field}
                              dbValue={row[field] as string | null}
                              pendingValue={rowPending[field]}
                              inputType={col.inputType}
                              align={col.align}
                              width={col.width}
                              hasPending={field in rowPending}
                              onChange={handleChange}
                              overflows={overflows}
                              checkOverflow={checkOverflow}
                            />
                          )
                        })}
                        {/* Right panel cells */}
                        {(['right_code','right_name','right_qty','right_unit','right_price','right_amount','note'] as const).map((field) => {
                          const col = COLS.find((c) => c.key === field)!
                          return (
                            <EditableCell
                              key={field}
                              rowId={row.id}
                              field={field}
                              dbValue={row[field] as string | null}
                              pendingValue={rowPending[field]}
                              inputType={col.inputType}
                              align={col.align}
                              width={col.width}
                              hasPending={field in rowPending}
                              onChange={handleChange}
                              overflows={overflows}
                              checkOverflow={checkOverflow}
                            />
                          )
                        })}
                      </tr>
                    )
                  }

                  // ── Data row ──
                  dataRowIdx++
                  const idx = dataRowIdx

                  return (
                    <tr
                      key={row.id}
                      className={`
                        ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        ${hasAnyPending ? 'ring-1 ring-inset ring-yellow-400' : ''}
                        hover:bg-yellow-50 transition-colors
                      `}
                    >
                      {/* Row number */}
                      <td
                        className="text-center text-[10px] text-gray-400 border-r border-gray-200 py-0.5 select-none"
                        style={{ width: ROW_NUM_W }}
                      >
                        {idx}
                      </td>

                      {/* All editable columns */}
                      {COLS.map((col) => (
                        <EditableCell
                          key={col.key}
                          rowId={row.id}
                          field={col.key}
                          dbValue={row[col.key] as string | null}
                          pendingValue={rowPending[col.key]}
                          inputType={col.inputType}
                          align={col.align}
                          width={col.width}
                          hasPending={col.key in rowPending}
                          onChange={handleChange}
                          overflows={overflows}
                          checkOverflow={checkOverflow}
                        />
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
