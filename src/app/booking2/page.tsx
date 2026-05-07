'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CatalogProduct {
  id: number
  group_name: string
  product_name: string
  price: string | null
  stock_qty: string | null
  section_order: number
  section_name: string
  is_vat_included: boolean
  subgroup_order: number
  subgroup_name: string
}

type SubgroupColor = 'gray' | 'light' | 'orange' | 'teal' | 'maroon'

type SectionRow =
  | { type: 'subgroup'; name: string; color: SubgroupColor }
  | { type: 'product'; product: CatalogProduct }

interface Section {
  order: number
  name: string
  is_vat_included: boolean
  rows: SectionRow[]
}

// ── Sub-group colors ──────────────────────────────────────────────────────────
// key = "section_order-subgroup_order"

const SUBGROUP_COLOR: Record<string, SubgroupColor> = {
  // S2 ซองน้ำตาล
  '2-1': 'gray',   '2-2': 'light',  '2-3': 'gray',   '2-4': 'gray',
  '2-5': 'orange', '2-6': 'gray',   '2-7': 'orange', '2-8': 'orange',
  '2-9': 'gray',   '2-10': 'gray',
  // S3 ซอง PP
  '3-1': 'gray',   '3-2': 'gray',   '3-3': 'gray',   '3-4': 'gray',
  '3-5': 'light',  '3-6': 'light',  '3-7': 'teal',   '3-8': 'orange',
  // S4 บับเบิล
  '4-1': 'light',  '4-2': 'light',  '4-3': 'gray',   '4-4': 'light',
  '4-5': 'gray',   '4-6': 'gray',   '4-7': 'orange', '4-8': 'orange',
  '4-9': 'orange', '4-10': 'orange','4-11': 'orange', '4-12': 'orange',
  '4-13': 'light', '4-14': 'light', '4-15': 'gray',  '4-16': 'gray',
  '4-17': 'light',
  // S5 กล่อง Thank You
  '5-1': 'light',  '5-2': 'gray',   '5-3': 'gray',   '5-4': 'gray',
  '5-5': 'orange',
  // S6 ซองกันกระแทก
  '6-1': 'gray',   '6-2': 'orange', '6-3': 'orange', '6-4': 'gray',
  '6-5': 'orange', '6-6': 'orange',
}

const SUBGROUP_BG: Record<SubgroupColor, string> = {
  gray:   'bg-gray-500   text-white    border-gray-600',
  light:  'bg-gray-300   text-gray-800 border-gray-400',
  orange: 'bg-orange-400 text-white    border-orange-500',
  teal:   'bg-teal-500   text-white    border-teal-600',
  maroon: 'bg-red-800    text-white    border-red-900',
}

// ── Column widths ─────────────────────────────────────────────────────────────

const COL_NAME  = 82
const COL_PRICE = 54
const COL_QTY   = 44
const COL_TOTAL = 62
const ROW_NUM_W = 24
const TABLE_W = ROW_NUM_W + 6 * (COL_NAME + COL_PRICE + COL_QTY + COL_TOTAL)

// ── A4 landscape dimensions ───────────────────────────────────────────────────
// 1 CSS mm = 96/25.4 px (CSS reference pixel)
const A4_W_PX       = 297 * (96 / 25.4)          // ≈ 1122.5 CSS px
const A4_PAD_PX     = 8   * (96 / 25.4)          // 8 mm padding each side ≈ 30.2 px
const CONTENT_SCALE = (A4_W_PX - A4_PAD_PX * 2) / TABLE_W  // ≈ 0.72

// ── Draft helpers ─────────────────────────────────────────────────────────────

const DRAFT_KEY = 'cf_draft_booking2'

function loadDraft(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') } catch { return {} }
}
function saveDraft(e: Record<number, number>) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(e))
}

// ── Build sections (insert subgroup headers) ──────────────────────────────────

function buildSections(products: CatalogProduct[]): Section[] {
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
    if (p.subgroup_order > 0) {
      const prev = [...sec.rows].reverse().find(r => r.type === 'subgroup') as { type: 'subgroup'; name: string; color: SubgroupColor } | undefined
      if (!prev || prev.name !== p.subgroup_name) {
        const key = `${p.section_order}-${p.subgroup_order}`
        sec.rows.push({ type: 'subgroup', name: p.subgroup_name, color: SUBGROUP_COLOR[key] ?? 'gray' })
      }
    }
    sec.rows.push({ type: 'product', product: p })
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order)
}

function fmt2(n: number) {
  if (!n) return ''
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Booking2Page() {
  const [products, setProducts]     = useState<CatalogProduct[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState<string | null>(null)
  const [pending, setPending]       = useState<Record<number, number>>({})
  const [zoom, setZoom]             = useState(1)
  const [sourceType, setSourceType] = useState<'โกดัง' | 'หน้าร้าน'>('โกดัง')
  const [branchInfo, setBranchInfo] = useState<{ name: string; phone: string } | null>(null)

  // Scale A4 frame to fit small screens
  useEffect(() => {
    const calc = () => setZoom(Math.min(1, window.innerWidth / (A4_W_PX + 32)))
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Load draft on mount + branch session
  useEffect(() => {
    setPending(loadDraft())
    try {
      const bs = localStorage.getItem('branch_session')
      if (bs) {
        const s = JSON.parse(bs)
        if (s?.branch_name) setBranchInfo({ name: s.branch_name, phone: s.phone ?? '' })
      }
    } catch { /* ignore */ }
  }, [])

  // Fetch products
  useEffect(() => {
    fetch('/api/booking2')
      .then(r => r.json())
      .then((data: CatalogProduct[]) => { setProducts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleQtyChange = useCallback((id: number, val: string) => {
    const qty = parseInt(val, 10) || 0
    setPending(prev => {
      const next = qty > 0 ? { ...prev, [id]: qty } : (() => { const n = { ...prev }; delete n[id]; return n })()
      saveDraft(next)
      return next
    })
  }, [])

  const pendingCount = Object.values(pending).filter(q => q > 0).length

  const handleSave = async () => {
    if (!pendingCount) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const productMap = new Map(products.map(p => [p.id, p]))
      const quantities: Record<number, number> = {}
      let orderTotal = 0
      for (const [idStr, qty] of Object.entries(pending)) {
        const id = Number(idStr)
        const p = productMap.get(id)
        if (!p || qty <= 0) continue
        quantities[id] = qty
        const price = parseFloat(p.price ?? '0') || 0
        orderTotal += price * qty
      }
      let branchId: number | null = null
      try {
        const bs = localStorage.getItem('branch_session')
        if (bs) branchId = JSON.parse(bs)?.branch_id ?? null
      } catch { /* ignore */ }
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_amount: orderTotal, quantities, branch_id: branchId, source: 'catalog' }),
      })
      if (!res.ok) throw new Error()
      setPending({})
      localStorage.removeItem(DRAFT_KEY)
      setSaveMsg(`บันทึกสำเร็จ ${pendingCount} รายการ`)
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const sections = buildSections(products)
  const maxRows  = sections.length ? Math.max(...sections.map(s => s.rows.length)) : 0

  let grayTotal = 0, orangeTotal = 0
  for (const sec of sections) {
    for (const row of sec.rows) {
      if (row.type !== 'product') continue
      const qty = pending[row.product.id] ?? 0
      const price = parseFloat(row.product.price ?? '0') || 0
      const val = price * qty
      if (sec.is_vat_included) grayTotal += val
      else orangeTotal += val
    }
  }
  const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          .no-print { display: none !important; }
          .a4-frame { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      {/* Header */}
      <header className="no-print bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-green-200 hover:text-white text-sm transition-colors">
            ← กลับหน้าหลัก
          </Link>
          <div>
            <h1 className="text-xl font-bold">ใบจองสินค้า</h1>
            <p className="text-green-200 text-xs mt-0.5">ข้อมูลจากสต็อคสินค้า · Auto-save ใน browser</p>
          </div>
        </div>

        <Link href="/orders"
          className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white transition-colors border border-white/30">
          📋 ประวัติใบจอง
        </Link>

        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white transition-colors border border-white/30">
          🖨️ พิมพ์
        </button>

        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm px-3 py-1 rounded-full text-white ${saveMsg.includes('สำเร็จ') ? 'bg-green-500' : 'bg-red-500'}`}>
              {saveMsg}
            </span>
          )}
          {pendingCount > 0 && (
            <>
              <span className="text-yellow-300 text-sm">✎ แก้ไขค้างอยู่ {pendingCount} รายการ</span>
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

      {/* Main */}
      <main>
        <div className="p-4 flex justify-center" style={{ zoom: zoom < 1 ? zoom : undefined }}>
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
          ) : (
            <div className="a4-frame bg-white shadow-xl"
              style={{ width: '297mm', minHeight: '210mm', padding: '8mm', boxSizing: 'border-box' }}>
              <div style={{ zoom: CONTENT_SCALE, transformOrigin: 'top left' }}>

              {/* Table */}
              <div className="inline-block rounded shadow overflow-hidden border border-gray-400">
                <table
                  className="text-xs border-collapse"
                  style={{ tableLayout: 'fixed', width: TABLE_W }}
                >
                  <colgroup>
                    <col style={{ width: ROW_NUM_W }} />
                    {sections.flatMap(sec => [
                      <col key={`${sec.order}-cn`} style={{ width: COL_NAME }} />,
                      <col key={`${sec.order}-cp`} style={{ width: COL_PRICE }} />,
                      <col key={`${sec.order}-cq`} style={{ width: COL_QTY }} />,
                      <col key={`${sec.order}-ct`} style={{ width: COL_TOTAL }} />,
                    ])}
                  </colgroup>

                  {/* Section name header row */}
                  <thead>
                    <tr className="bg-green-700 text-white text-[10px]">
                      <th className="border border-gray-500 py-1 text-center">#</th>
                      {sections.map(sec => (
                        <th key={sec.order} colSpan={4}
                          className="border border-gray-500 px-1 py-1 text-center font-bold">
                          {sec.name}
                          {sec.is_vat_included && <span className="ml-1 text-yellow-300 text-[9px]">(มีVAT)</span>}
                        </th>
                      ))}
                    </tr>
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

                  {/* Body */}
                  <tbody>
                    {Array.from({ length: maxRows }, (_, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-yellow-50/30 transition-colors">
                        <td className="border border-gray-300 text-center text-[9px] text-gray-400 py-0.5 select-none">
                          {rowIdx + 1}
                        </td>

                        {sections.flatMap((sec, si) => {
                          const cell = sec.rows[rowIdx] ?? null

                          if (!cell) return [
                            <td key={`${si}-en`} className="border border-gray-200 bg-gray-50" />,
                            <td key={`${si}-ep`} className="border border-gray-200 bg-gray-50" />,
                            <td key={`${si}-eq`} className="border border-gray-200 bg-gray-50" />,
                            <td key={`${si}-et`} className="border border-gray-200 bg-gray-50" />,
                          ]

                          if (cell.type === 'subgroup') return [
                            <td key={`${si}-sg`} colSpan={4}
                              className={`border px-2 py-px text-[9px] font-bold ${SUBGROUP_BG[cell.color]}`}>
                              {cell.name}
                            </td>,
                          ]

                          const { product: p } = cell
                          const price      = parseFloat(p.price ?? '0') || 0
                          const qty        = pending[p.id] ?? 0
                          const total      = qty * price
                          const hasPending = (pending[p.id] ?? 0) > 0

                          const nameBg = sec.is_vat_included ? 'bg-gray-200 text-gray-800' : 'bg-orange-50 text-gray-800'
                          const pendingRing = hasPending ? 'ring-1 ring-inset ring-yellow-400' : ''
                          const qtyBg = hasPending ? 'bg-yellow-50' : (sec.is_vat_included ? 'bg-gray-200' : 'bg-orange-50')

                          return [
                            // ชื่อสินค้า
                            <td key={`${si}-pn`}
                              className={`border border-gray-300 px-1 py-px ${nameBg} ${pendingRing} relative overflow-hidden`}
                              title={p.product_name}>
                              {p.stock_qty !== null && p.stock_qty !== undefined && (
                                <span className="absolute top-0 right-0 text-[7px] text-blue-500 leading-none px-0.5 py-px">
                                  {parseFloat(String(p.stock_qty)).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                                </span>
                              )}
                              <div className="truncate pr-4">{p.product_name}</div>
                            </td>,

                            // ราคา/หน่วย
                            <td key={`${si}-pp`} className={`border border-gray-300 px-1 py-px text-right ${nameBg}`}>
                              {p.price ? price.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '–'}
                            </td>,

                            // จำนวน
                            <td key={`${si}-pq`} className={`border border-gray-300 p-0 ${qtyBg}`}>
                              {p.price && (
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  defaultValue={qty || ''}
                                  key={`qty-${p.id}`}
                                  onChange={e => handleQtyChange(p.id, e.target.value)}
                                  className={`w-full px-1 py-px text-[10px] text-right bg-transparent focus:outline-none focus:ring-1 focus:ring-inset focus:ring-green-500 ${hasPending ? 'font-semibold' : ''}`}
                                />
                              )}
                            </td>,

                            // รวม
                            <td key={`${si}-pt`} className={`border border-gray-300 px-1 py-px text-right ${nameBg}`}>
                              {total > 0 ? fmt2(total) : ''}
                            </td>,
                          ]
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom info panel — right-aligned */}
              <div className="mt-4 flex justify-end" style={{ maxWidth: TABLE_W }}>
                <div className="border-2 border-gray-400 rounded-lg bg-white text-xs" style={{ width: 400 }}>

                  {/* Row 1: Signatures */}
                  <div className="flex border-b border-gray-300">
                    <div className="flex-1 p-2 border-r border-gray-300">
                      <div className="text-[10px] text-gray-500 font-semibold mb-1">ผู้ส่งสินค้า</div>
                      <div className="h-12" />
                    </div>
                    <div className="flex-1 p-2">
                      <div className="text-[10px] text-gray-500 font-semibold mb-1">ผู้รับสินค้า</div>
                      <div className="h-12" />
                    </div>
                  </div>

                  {/* Row 2: Source type */}
                  <div className="flex items-center gap-4 px-3 py-2 border-b border-gray-300">
                    <span className="text-gray-600 font-semibold whitespace-nowrap">เบิกของ:</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="sourceType"
                        value="โกดัง"
                        checked={sourceType === 'โกดัง'}
                        onChange={() => setSourceType('โกดัง')}
                        className="accent-green-600"
                      />
                      <span>โกดัง</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="sourceType"
                        value="หน้าร้าน"
                        checked={sourceType === 'หน้าร้าน'}
                        onChange={() => setSourceType('หน้าร้าน')}
                        className="accent-green-600"
                      />
                      <span>หน้าร้าน</span>
                    </label>
                  </div>

                  {/* Row 3: Date (read-only, auto today) */}
                  <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-300">
                    <span className="text-gray-600 font-semibold whitespace-nowrap">วันที่อัพเดท:</span>
                    <span className="text-gray-800 font-medium">{today}</span>
                  </div>

                  {/* Row 4: Total */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-300 bg-gray-50">
                    <span className="text-gray-700 font-bold">ยอดเงินรวม</span>
                    <span className="text-lg font-bold text-green-800">
                      {(grayTotal + orangeTotal).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                    </span>
                  </div>

                  {/* Row 5: Branch info */}
                  <div className="px-3 py-2 min-h-[3rem]">
                    {branchInfo ? (
                      <>
                        <div className="font-semibold text-gray-800">{branchInfo.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{branchInfo.phone}</div>
                      </>
                    ) : (
                      <div className="text-gray-400 italic">ยังไม่ได้เข้าสู่ระบบ</div>
                    )}
                  </div>

                </div>
              </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
