'use client'

import { Fragment, useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  stock_qty: string | null
}

type SubgroupColor = 'gray' | 'light' | 'orange' | 'teal' | 'maroon'

type SectionRow =
  | { type: 'subgroup'; name: string; color: SubgroupColor }
  | { type: 'product'; product: Product }

// ── Sub-group colors (ดึงจาก Excel จริง) ─────────────────────────────────────
// key = "section_order-subgroup_order"

const SUBGROUP_COLOR: Record<string, SubgroupColor> = {
  // S2 ซองน้ำตาล
  '2-1': 'gray',   '2-2': 'light',  '2-3': 'gray',  '2-4': 'gray',
  '2-5': 'orange', '2-6': 'gray',   '2-7': 'orange','2-8': 'orange',
  '2-9': 'gray',   '2-10': 'gray',
  // S3 ซอง PP
  '3-1': 'gray',   '3-2': 'gray',   '3-3': 'gray',  '3-4': 'gray',
  '3-5': 'light',  '3-6': 'light',  '3-7': 'teal',  '3-8': 'orange',
  '3-9': 'orange',
  // S4 บับเบิล
  '4-1': 'light',  '4-2': 'light',  '4-3': 'gray',  '4-4': 'light',
  '4-5': 'gray',   '4-6': 'gray',   '4-7': 'orange','4-8': 'orange',
  '4-9': 'orange',
  // S5 กล่อง Thank You
  '5-1': 'light',  '5-2': 'gray',   '5-3': 'gray',  '5-4': 'gray',
  '5-5': 'orange', '5-6': 'maroon',
  // S6 ซองกันกระแทก
  '6-1': 'gray',   '6-2': 'orange', '6-3': 'orange','6-4': 'gray',
  '6-5': 'orange', '6-6': 'orange', '6-7': 'orange','6-8': 'orange',
  '6-9': 'gray',   '6-10': 'gray',
}

const SUBGROUP_BG: Record<SubgroupColor, string> = {
  gray:   'bg-gray-500   text-white  border-gray-600',
  light:  'bg-gray-300   text-gray-800 border-gray-400',
  orange: 'bg-orange-400 text-white  border-orange-500',
  teal:   'bg-teal-500   text-white  border-teal-600',
  maroon: 'bg-red-800    text-white  border-red-900',
}

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
      const prev = [...sec.rows].reverse().find(r => r.type === 'subgroup') as { type: 'subgroup'; name: string; color: SubgroupColor } | undefined
      if (!prev || prev.name !== p.subgroup_name) {
        const colorKey = `${p.section_order}-${p.subgroup_order}`
        const color: SubgroupColor = SUBGROUP_COLOR[colorKey] ?? 'gray'
        sec.rows.push({ type: 'subgroup', name: p.subgroup_name, color })
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

type SearchParams = Promise<{ order?: string }>

export default function BookingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp          = use(searchParams)
  const editOrderNo = sp?.order ?? null
  const router      = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState<string | null>(null)
  const [pending, setPending]   = useState<Record<number, number>>({})

  // ── Edit mode: load order quantities ─────────────────────────────────────────
  const [editQty, setEditQty] = useState<Record<number, number>>({})

  useEffect(() => {
    if (!editOrderNo) return
    fetch(`/api/orders?no=${editOrderNo}`)
      .then(r => r.json())
      .then((order: { quantities?: Record<string, number> } | null) => {
        if (!order?.quantities) return
        const qtyMap: Record<number, number> = {}
        for (const [id, qty] of Object.entries(order.quantities)) {
          qtyMap[Number(id)] = Number(qty)
        }
        setEditQty(qtyMap)
        setPending(qtyMap)  // pre-fill form with order quantities
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderNo])

  // ── Scale-to-fit for mobile (CSS zoom — affects layout correctly) ────────────
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const CONTENT_W = TABLE_W + 32 // table + p-4 padding (16px × 2)
    const calc = () => setZoom(Math.min(1, window.innerWidth / CONTENT_W))
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // ไม่โหลด draft อัตโนมัติ — เปิดหน้าใหม่ทุกครั้งให้เริ่มจาก 0 เสมอ
  useEffect(() => { localStorage.removeItem(DRAFT_KEY) }, [])

  useEffect(() => {
    fetch('/api/booking')
      .then(r => r.json())
      .then((data: Product[]) => { setProducts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleQtyChange = useCallback((id: number, val: string) => {
    const qty = parseInt(val, 10) || 0
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
      // 1. Update booking_products
      const body = Object.entries(pending).map(([id, current_qty]) => ({ id: Number(id), current_qty }))
      const res = await fetch('/api/booking', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()

      // 2. Snapshot all current quantities + compute total
      const productMap = new Map(products.map(p => [p.id, p]))
      const quantities: Record<number, number> = {}
      let orderTotal = 0
      for (const p of products) {
        if (p.is_free) continue
        const baseQty = editOrderNo ? (editQty[p.id] ?? 0) : 0
        const qty = pending[p.id] !== undefined ? pending[p.id] : baseQty
        if (qty > 0) {
          quantities[p.id] = qty
          const prod = productMap.get(p.id)
          if (prod) orderTotal += prod.unit_price * qty
        }
      }

      // 3. Create or update order record
      if (editOrderNo) {
        await fetch('/api/orders', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ order_no: editOrderNo, total_amount: orderTotal, quantities }),
        })
      } else {
        // Read branch session from localStorage (set when branch user logs in)
        let branchId: number | null = null
        try {
          const bs = localStorage.getItem('branch_session')
          if (bs) branchId = JSON.parse(bs)?.branch_id ?? null
        } catch { /* ignore */ }
        await fetch('/api/orders', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ total_amount: orderTotal, quantities, branch_id: branchId }),
        })
      }

      setPending({})
      localStorage.removeItem(DRAFT_KEY)
      setSaveMsg(`บันทึกสำเร็จ ${pendingCount} รายการ`)
      const fresh: Product[] = await fetch('/api/booking').then(r => r.json())
      setProducts(fresh)

      if (editOrderNo) router.push('/orders')
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
      const baseQty = editOrderNo ? (editQty[row.product.id] ?? 0) : 0
      const qty = pending[row.product.id] !== undefined ? pending[row.product.id] : baseQty
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
            <h1 className="text-xl font-bold">
              ใบจอง
              {editOrderNo && (
                <span className="ml-2 text-yellow-300 text-sm font-normal">✎ แก้ไข #{editOrderNo}</span>
              )}
            </h1>
            <p className="text-green-200 text-xs mt-0.5">แก้ไขจำนวนได้ · Auto-save ใน browser</p>
          </div>
        </div>

        <Link
          href="/orders"
          className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white transition-colors border border-white/30"
        >
          📋 ประวัติใบจอง
        </Link>

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
                {saving ? 'กำลังบันทึก...' : editOrderNo ? `💾 อัพเดทใบจอง #${editOrderNo}` : '💾 บันทึกลง DB'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main>
        <div
          className="p-4"
          style={{ zoom: zoom < 1 ? zoom : undefined }}
        >
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
                            className={`border px-2 py-px text-[9px] font-bold ${SUBGROUP_BG[cell.color]}`}
                          >
                            {cell.name}
                          </td>,
                        ]

                        // ── Product row ──
                        const { product: p } = cell
                        const dbQty      = editOrderNo ? (editQty[p.id] ?? 0) : 0
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
                            <div className="truncate">{p.product_name}</div>
                            {p.stock_qty !== null && p.stock_qty !== undefined && (
                              <div className="text-[9px] text-blue-500 leading-none mt-px">
                                คงเหลือ {parseFloat(String(p.stock_qty)).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                              </div>
                            )}
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
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
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
        </div>
      </main>
    </div>
  )
}
