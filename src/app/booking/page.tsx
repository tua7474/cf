'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: number
  section_order: number
  section_name: string
  is_vat_included: boolean
  subgroup_order: number
  subgroup_name: string
  product_name: string
  unit_price: number
  is_free: boolean
  sort_order: number
  current_qty: number
}

type SectionRow =
  | { type: 'subgroup'; name: string }
  | { type: 'product'; product: Product }

interface Section {
  order: number
  name: string
  is_vat_included: boolean
  rows: SectionRow[]
}

// ── Column widths (px) ───────────────────────────────────────────────────────

const COL_NAME  = 82   // ชื่อสินค้า
const COL_PRICE = 54   // ราคา/หน่วย
const COL_QTY   = 44   // จำนวน
const COL_TOTAL = 62   // รวม
const ROW_NUM_W = 24
// Total: 24 + 6 × (82+54+44+62) = 24 + 6 × 242 = 24 + 1452 = 1476
const TABLE_W = ROW_NUM_W + 6 * (COL_NAME + COL_PRICE + COL_QTY + COL_TOTAL)

// ── Draft helpers ─────────────────────────────────────────────────────────────

const DRAFT_KEY = 'cf_draft_booking'

function loadDraft(): Record<number, number> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveDraft(edits: Record<number, number>) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(edits))
}

// ── Build section rows (insert sub-group headers) ─────────────────────────────

function buildSections(products: Product[]): Section[] {
  const map = new Map<number, Section>()
  for (const p of products) {
    if (!map.has(p.section_order)) {
      map.set(p.section_order, {
        order: p.section_order,
        name: p.section_name,
        is_vat_included: p.is_vat_included,
        rows: [],
      })
    }
    const sec = map.get(p.section_order)!
    // Insert sub-group header when the subgroup name changes (skip sections without sub-groups)
    if (p.subgroup_order > 0) {
      const prev = [...sec.rows].reverse().find(r => r.type === 'subgroup') as { type: 'subgroup'; name: string } | undefined
      if (!prev || prev.name !== p.subgroup_name) {
        sec.rows.push({ type: 'subgroup', name: p.subgroup_name })
      }
    }
    sec.rows.push({ type: 'product', product: p })
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order)
}

// ── Number formatting ─────────────────────────────────────────────────────────

function fmt2(n: number): string {
  if (!n) return ''
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BookingPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState<string | null>(null)
  const [pending, setPending]   = useState<Record<number, number>>({})

  useEffect(() => { setPending(loadDraft()) }, [])

  useEffect(() => {
    fetch('/api/booking')
      .then(r => r.json())
      .then((data: Product[]) => { setProducts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleQtyChange = useCallback((id: number, val: string) => {
    const qty = parseFloat(val) || 0
    setPending(prev => {
      const next = { ...prev, [id]: qty }
      saveDraft(next)
      return next
    })
  }, [])

  const pendingCount = Object.keys(pending).length

  const handleSave = async () => {
    if (!pendingCount) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const body = Object.entries(pending).map(([id, current_qty]) => ({ id: Number(id), current_qty }))
      const res = await fetch('/api/booking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setPending({})
      localStorage.removeItem(DRAFT_KEY)
      setSaveMsg(`บันทึกสำเร็จ ${pendingCount} รายการ`)
      const fresh: Product[] = await fetch('/api/booking').then(r => r.json())
      setProducts(fresh)
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const sections = buildSections(products)
  const maxRows  = sections.length ? Math.max(...sections.map(s => s.rows.length)) : 0

  // Summary totals
  let grayTotal = 0, orangeTotal = 0
  for (const sec of sections) {
    for (const row of sec.rows) {
      if (row.type !== 'product' || row.product.is_free) continue
      const qty = pending[row.product.id] !== undefined ? pending[row.product.id] : (row.product.current_qty ?? 0)
      const val = row.product.unit_price * qty
      if (sec.is_vat_included) grayTotal += val
      else orangeTotal += val
    }
  }
  const noVatTotal   = grayTotal + orangeTotal
  const withVatTotal = grayTotal + orangeTotal * 1.07

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-green-200 hover:text-white text-sm transition-colors">
            ← กลับหน้าหลัก
          </Link>
          <div>
            <h1 className="text-xl font-bold">ใบจอง</h1>
            <p className="text-green-200 text-xs mt-0.5">แก้ไขจำนวนได้ · Auto-save ใน browser</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm px-3 py-1 rounded-full text-white ${saveMsg.includes('สำเร็จ') ? 'bg-green-500' : 'bg-red-500'}`}>
              {saveMsg}
            </span>
          )}
          {pendingCount > 0 && (
            <>
              <span className="text-yellow-300 text-sm">
                ✎ แก้ไขค้างอยู่ {pendingCount} รายการ (auto-saved)
              </span>
              <button
                onClick={() => { setPending({}); localStorage.removeItem(DRAFT_KEY) }}
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

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="p-4 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <>
            {/* ── Table ───────────────────────────────────────────────────── */}
            <div className="inline-block rounded shadow overflow-hidden border border-gray-400">
              <table
                className="text-xs border-collapse"
                style={{ tableLayout: 'fixed', width: TABLE_W }}
              >
                {/* colgroup — locks all column widths */}
                <colgroup>
                  <col style={{ width: ROW_NUM_W }} />
                  {sections.flatMap(sec => [
                    <col key={`${sec.order}-cn`} style={{ width: COL_NAME }} />,
                    <col key={`${sec.order}-cp`} style={{ width: COL_PRICE }} />,
                    <col key={`${sec.order}-cq`} style={{ width: COL_QTY }} />,
                    <col key={`${sec.order}-ct`} style={{ width: COL_TOTAL }} />,
                  ])}
                </colgroup>

                {/* ── thead ── */}
                <thead>
                  {/* Sub-column header row */}
                  <tr className="bg-green-800 text-white text-[9px]">
                    <th className="border border-gray-500 py-0.5 text-center">#</th>
                    {sections.flatMap(sec => [
                      <th key={`${sec.order}-hn`} className="border border-gray-500 px-1 py-0.5 text-left font-medium">ชื่อสินค้า</th>,
                      <th key={`${sec.order}-hp`} className="border border-gray-500 px-1 py-0.5 text-right font-medium">ราคา/หน่วย</th>,
                      <th key={`${sec.order}-hq`} className="border border-gray-500 px-1 py-0.5 text-right font-medium">จำนวน</th>,
                      <th key={`${sec.order}-ht`} className="border border-gray-500 px-1 py-0.5 text-right font-medium">รวม</th>,
                    ])}
                  </tr>
                </thead>

                {/* ── tbody ── */}
                <tbody>
                  {Array.from({ length: maxRows }, (_, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-yellow-50/30 transition-colors">
                      {/* Row number */}
                      <td className="border border-gray-300 text-center text-[9px] text-gray-400 py-0.5 select-none">
                        {rowIdx + 1}
                      </td>

                      {/* Section cells — flatMap returns array of tds */}
                      {sections.flatMap((sec, si) => {
                        const cell = sec.rows[rowIdx] ?? null

                        // ── Empty (this section has fewer rows) ──
                        if (!cell) return [
                          <td key={`${si}-en`} className="border border-gray-200 bg-gray-50" />,
                          <td key={`${si}-ep`} className="border border-gray-200 bg-gray-50" />,
                          <td key={`${si}-eq`} className="border border-gray-200 bg-gray-50" />,
                          <td key={`${si}-et`} className="border border-gray-200 bg-gray-50" />,
                        ]

                        // ── Sub-group header ──
                        if (cell.type === 'subgroup') return [
                          <td
                            key={`${si}-sg`}
                            colSpan={4}
                            className="border border-orange-300 bg-orange-200 px-2 py-px text-[9px] font-bold text-orange-900"
                          >
                            {cell.name}
                          </td>,
                        ]

                        // ── Product row ──
                        const { product: p } = cell
                        const dbQty      = p.current_qty ?? 0
                        const qty        = pending[p.id] !== undefined ? pending[p.id] : dbQty
                        const total      = qty * p.unit_price
                        const hasPending = pending[p.id] !== undefined

                        // Background colors per VAT type / free status
                        // Gray = VAT included (Section 1), Orange = non-VAT (Sections 2-6)
                        let nameBg: string
                        if (p.is_free)                nameBg = 'bg-red-900 text-white'
                        else if (sec.is_vat_included)  nameBg = 'bg-gray-200 text-gray-800'
                        else                           nameBg = 'bg-orange-50 text-gray-800'

                        const pendingRing = hasPending && !p.is_free ? 'ring-1 ring-inset ring-yellow-400' : ''

                        // Qty td background
                        let qtyBg: string
                        if (p.is_free)                qtyBg = 'bg-red-900'
                        else if (hasPending)           qtyBg = 'bg-yellow-50'
                        else if (sec.is_vat_included)  qtyBg = 'bg-gray-200'
                        else                          qtyBg = 'bg-orange-50'

                        return [
                          // ชื่อสินค้า
                          <td
                            key={`${si}-pn`}
                            className={`border border-gray-300 px-1 py-px ${nameBg} ${pendingRing}`}
                            style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                            title={p.product_name}
                          >
                            {p.product_name}
                          </td>,

                          // ราคา/หน่วย
                          <td
                            key={`${si}-pp`}
                            className={`border border-gray-300 px-1 py-px text-right ${nameBg}`}
                          >
                            {p.is_free
                              ? <span className="italic opacity-70">ฟรี</span>
                              : p.unit_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })
                            }
                          </td>,

                          // จำนวน (editable)
                          <td
                            key={`${si}-pq`}
                            className={`border border-gray-300 p-0 ${qtyBg}`}
                          >
                            {!p.is_free && (
                              <input
                                type="number"
                                min="0"
                                step="1"
                                defaultValue={dbQty || ''}
                                key={`qty-${p.id}-${dbQty}`}
                                onChange={e => handleQtyChange(p.id, e.target.value)}
                                className={`w-full px-1 py-px text-[10px] text-right bg-transparent focus:outline-none focus:ring-1 focus:ring-inset focus:ring-green-500 ${hasPending ? 'font-semibold' : ''}`}
                              />
                            )}
                          </td>,

                          // รวม (calculated, read-only)
                          <td
                            key={`${si}-pt`}
                            className={`border border-gray-300 px-1 py-px text-right ${nameBg}`}
                          >
                            {!p.is_free && total > 0 ? fmt2(total) : ''}
                          </td>,
                        ]
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Summary boxes ─────────────────────────────────────────────── */}
            <div className="mt-4 flex gap-4" style={{ maxWidth: TABLE_W }}>
              {/* Orange — No VAT */}
              <div className="flex-1 rounded-lg border-2 border-orange-400 bg-orange-50 p-4">
                <div className="text-sm font-bold text-orange-700 mb-1">🟠 ไม่มีใบกำกับภาษี</div>
                <div className="text-2xl font-bold text-orange-900">
                  {noVatTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                </div>
                <div className="text-[11px] text-orange-600 mt-1">
                  ราคาสินค้าทุกรายการรวมกัน — ไม่บวก VAT เพิ่ม
                </div>
              </div>

              {/* Gray — With VAT */}
              <div className="flex-1 rounded-lg border-2 border-gray-400 bg-gray-100 p-4">
                <div className="text-sm font-bold text-gray-700 mb-1">🔘 มีใบกำกับภาษี</div>
                <div className="text-2xl font-bold text-gray-900">
                  {withVatTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                </div>
                <div className="text-[11px] text-gray-600 mt-1">
                  กล่อง = ราคาเดิม (VAT รวมแล้ว) · สินค้าอื่น × 1.07
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
