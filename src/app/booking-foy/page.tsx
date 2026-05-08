'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockItem {
  id: number
  model_name: string
  color_code: string
  color_name: string
  stock_qty: string
  warehouse_price: string
  retail_price: string
}

interface ModelGroup {
  name: string
  items: StockItem[]
}

// ── Layout constants ───────────────────────────────────────────────────────────

const ROW_NUM_W      = 20
const COL_COLOR      = 65
const COL_PRICE      = 42
const COL_QTY        = 36
const COL_TOTAL      = 46
const SEC_W          = COL_COLOR + COL_PRICE + COL_QTY + COL_TOTAL  // 189
const MODELS_PER_ROW = 7
const TABLE_W        = ROW_NUM_W + MODELS_PER_ROW * SEC_W           // 20 + 7×189 = 1343

// ── A4 landscape scaling ───────────────────────────────────────────────────────
// Screen: A4 = 297mm, padding 8mm each side → content = (297−16)mm = 281mm
const A4_W_PX       = 297 * (96 / 25.4)          // ≈ 1122.5 CSS px
const A4_PAD_PX     = 8   * (96 / 25.4)          // ≈ 30.2 px
const CONTENT_SCALE = (A4_W_PX - A4_PAD_PX * 2) / TABLE_W  // ≈ 0.791

// Print: 3mm padding each side → 291mm × (96/25.4) / TABLE_W
const PRINT_ZOOM    = Math.round(((291 * 96) / 25.4) / TABLE_W * 1000) / 1000  // ≈ 0.819
// Unscaled height available inside A4 at print zoom: (210−6)mm × (96/25.4) / PRINT_ZOOM
const PRINT_H_PX    = Math.round(((204 * 96) / 25.4) / PRINT_ZOOM)              // ≈ 941

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt2(n: number) {
  if (!n) return ''
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingFoyPage() {
  const [items, setItems]         = useState<StockItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [pending, setPending]     = useState<Record<number, number>>({})
  const [zoom, setZoom]           = useState(1)
  const [sourceType, setSourceType]   = useState<'โกดัง' | 'หน้าร้าน' | ''>('')
  const [vehicleType, setVehicleType] = useState<'จองรถ60000' | 'รอพ่วง' | ''>('')
  const [manualTotal, setManualTotal] = useState('')
  const [branchInfo, setBranchInfo]   = useState<{ name: string; phone: string } | null>(null)

  // Scale A4 frame to fit small screens
  useEffect(() => {
    const calc = () => setZoom(Math.min(1, window.innerWidth / (A4_W_PX + 32)))
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Load branch session
  useEffect(() => {
    try {
      const bs = localStorage.getItem('branch_session')
      if (bs) {
        const s = JSON.parse(bs)
        if (s?.branch_name) setBranchInfo({ name: s.branch_name, phone: s.phone ?? '' })
      }
    } catch { /* ignore */ }
  }, [])

  // Fetch stock
  useEffect(() => {
    fetch('/api/stock')
      .then(r => r.json())
      .then((data: StockItem[]) => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleQtyChange = useCallback((id: number, val: string) => {
    const qty = parseInt(val, 10) || 0
    setPending(prev =>
      qty > 0
        ? { ...prev, [id]: qty }
        : (() => { const n = { ...prev }; delete n[id]; return n })()
    )
  }, [])

  // ── Derived ────────────────────────────────────────────────────────────────

  // Group items by model_name, preserving insertion order
  const modelGroups: ModelGroup[] = []
  const seen = new Map<string, ModelGroup>()
  for (const item of items) {
    if (!seen.has(item.model_name)) {
      const g: ModelGroup = { name: item.model_name, items: [] }
      seen.set(item.model_name, g)
      modelGroups.push(g)
    }
    seen.get(item.model_name)!.items.push(item)
  }

  // Split model groups into rows of MODELS_PER_ROW
  const tableRows: ModelGroup[][] = []
  for (let i = 0; i < modelGroups.length; i += MODELS_PER_ROW) {
    tableRows.push(modelGroups.slice(i, i + MODELS_PER_ROW))
  }

  // Grand total
  let grandTotal = 0
  for (const [idStr, qty] of Object.entries(pending)) {
    const item = items.find(it => it.id === Number(idStr))
    if (item) grandTotal += (parseFloat(item.retail_price) || 0) * qty
  }
  const displayTotal = manualTotal !== '' ? manualTotal : grandTotal.toFixed(2)
  const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })

  // ── Table renderer ─────────────────────────────────────────────────────────

  const renderTable = (modelRow: ModelGroup[], ti: number) => {
    // Pad to full MODELS_PER_ROW width with empty groups
    const padded: ModelGroup[] = [...modelRow]
    while (padded.length < MODELS_PER_ROW) padded.push({ name: '', items: [] })

    const maxDataRows = Math.max(...modelRow.map(g => g.items.length), 1)

    return (
      <div key={ti} className="inline-block rounded shadow overflow-hidden border border-gray-400 mb-1">
        <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', width: TABLE_W }}>
          <colgroup>
            <col style={{ width: ROW_NUM_W }} />
            {padded.flatMap((_, mi) => [
              <col key={`t${ti}m${mi}cn`} style={{ width: COL_COLOR }} />,
              <col key={`t${ti}m${mi}cp`} style={{ width: COL_PRICE }} />,
              <col key={`t${ti}m${mi}cq`} style={{ width: COL_QTY }} />,
              <col key={`t${ti}m${mi}ct`} style={{ width: COL_TOTAL }} />,
            ])}
          </colgroup>

          {/* Model name headers */}
          <thead>
            <tr className="bg-green-700 text-white text-[10px]">
              <th className="border border-gray-500 py-1 text-center">#</th>
              {padded.map((g, mi) => (
                <th key={`t${ti}m${mi}mh`} colSpan={4}
                  className="border border-gray-500 px-1 py-1 text-center font-bold overflow-hidden">
                  <div className="truncate">{g.name}</div>
                </th>
              ))}
            </tr>
            <tr className="bg-green-800 text-white text-[9px]">
              <th className="border border-gray-500 py-0.5 text-center">#</th>
              {padded.flatMap((_, mi) => [
                <th key={`t${ti}m${mi}hn`} className="border border-gray-500 px-1 py-0.5 text-left font-medium">ชื่อสี</th>,
                <th key={`t${ti}m${mi}hp`} className="border border-gray-500 px-1 py-0.5 text-right font-medium">ราคา</th>,
                <th key={`t${ti}m${mi}hq`} className="border border-gray-500 px-1 py-0.5 text-right font-medium">จำนวน</th>,
                <th key={`t${ti}m${mi}ht`} className="border border-gray-500 px-1 py-0.5 text-right font-medium">รวม</th>,
              ])}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: maxDataRows }, (_, ri) => (
              <tr key={ri} className="hover:bg-yellow-50/30 transition-colors">
                <td className="border border-gray-300 text-center text-[9px] text-gray-400 py-0.5 select-none">
                  {ri + 1}
                </td>
                {padded.flatMap((g, mi) => {
                  const item = g.items[ri] ?? null
                  if (!item) return [
                    <td key={`t${ti}m${mi}en`} className="border border-gray-200 bg-gray-50" />,
                    <td key={`t${ti}m${mi}ep`} className="border border-gray-200 bg-gray-50" />,
                    <td key={`t${ti}m${mi}eq`} className="border border-gray-200 bg-gray-50" />,
                    <td key={`t${ti}m${mi}et`} className="border border-gray-200 bg-gray-50" />,
                  ]

                  const price      = parseFloat(item.retail_price) || 0
                  const qty        = pending[item.id] ?? 0
                  const total      = qty * price
                  const hasPending = qty > 0

                  return [
                    // ชื่อสี
                    <td key={`t${ti}m${mi}pn`}
                      className={`border border-gray-300 px-1 py-px bg-gray-100 text-gray-800 overflow-hidden ${hasPending ? 'ring-1 ring-inset ring-yellow-400' : ''}`}>
                      <div className="truncate text-[9px]">{item.color_name || item.color_code || '–'}</div>
                    </td>,
                    // ราคา
                    <td key={`t${ti}m${mi}pp`} className="border border-gray-300 px-1 py-px text-right bg-gray-100 text-[9px]">
                      {price ? price.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '–'}
                    </td>,
                    // จำนวน (input)
                    <td key={`t${ti}m${mi}pq`} className={`border border-gray-300 p-0 ${hasPending ? 'bg-yellow-50' : 'bg-white'}`}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        defaultValue={qty || ''}
                        key={`qty-${item.id}`}
                        onChange={e => handleQtyChange(item.id, e.target.value)}
                        className={`w-full px-1 py-px text-[9px] text-right bg-transparent focus:outline-none focus:ring-1 focus:ring-inset focus:ring-green-500 ${hasPending ? 'font-semibold' : ''}`}
                      />
                    </td>,
                    // รวม
                    <td key={`t${ti}m${mi}pt`} className="border border-gray-300 px-1 py-px text-right bg-gray-100 text-[9px]">
                      {total > 0 ? fmt2(total) : ''}
                    </td>,
                  ]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }

          .screen-zoom-wrapper {
            zoom: 1 !important;
            padding: 0 !important;
            display: block !important;
          }

          /* A4 landscape: 297×210mm, 3mm padding each side */
          .a4-frame {
            width: 297mm !important;
            height: 210mm !important;
            min-height: unset !important;
            padding: 3mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
          }

          /* Zoom content to fill A4 width; height fills remainder */
          .a4-content {
            zoom: ${PRINT_ZOOM} !important;
            height: ${PRINT_H_PX}px !important;
          }

          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* ── Header (no-print) ─────────────────────────────────────────────── */}
      <header className="no-print bg-green-800 text-white px-6 py-3 shadow flex items-center gap-4">
        <Link href="/stock" className="text-green-200 hover:text-white text-sm transition-colors">
          ← สต็อคกระดาษฝอย
        </Link>
        <div>
          <h1 className="text-xl font-bold">ใบจองกระดาษฝอย</h1>
          <p className="text-green-200 text-xs mt-0.5">พร้อมพิมพ์ A4 แนวนอน · {modelGroups.length} รุ่น</p>
        </div>
        <button
          onClick={() => window.print()}
          className="ml-auto px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white transition-colors border border-white/30">
          🖨️ พิมพ์
        </button>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main>
        <div className="screen-zoom-wrapper p-4 flex justify-center"
          style={{ zoom: zoom < 1 ? zoom : undefined }}>

          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
          ) : (
            <div className="a4-frame bg-white shadow-xl"
              style={{ width: '297mm', minHeight: '210mm', padding: '8mm', boxSizing: 'border-box' }}>
              <div className="a4-content" style={{ zoom: CONTENT_SCALE, transformOrigin: 'top left' }}>

                {/* Title */}
                <div className="text-center text-sm font-bold text-gray-800 mb-1 tracking-wide">
                  ใบจองกระดาษฝอย
                </div>

                {/* ── Model tables (one per row of MODELS_PER_ROW) ── */}
                {tableRows.map((modelRow, ti) => renderTable(modelRow, ti))}

                {/* ── Info panel ─────────────────────────────────────────── */}
                <div className="flex gap-1 mt-1.5" style={{ width: TABLE_W }}>

                  {/* ผู้ส่ง / ผู้รับ */}
                  <div className="flex-1 border border-gray-400 rounded overflow-hidden">
                    <div className="flex h-16">
                      <div className="flex-1 border-r border-gray-300 p-1">
                        <div className="text-[8px] font-semibold text-gray-500 mb-1">ผู้ส่งสินค้า</div>
                      </div>
                      <div className="flex-1 p-1">
                        <div className="text-[8px] font-semibold text-gray-500 mb-1">ผู้รับสินค้า</div>
                      </div>
                    </div>
                  </div>

                  {/* ยอดรวม */}
                  <div className="border border-gray-400 rounded p-1 bg-green-50 flex flex-col justify-center"
                    style={{ width: 140 }}>
                    <div className="text-[8px] font-semibold text-gray-500">ยอดเงินรวม (฿)</div>
                    <input
                      type="number"
                      step="0.01"
                      max="999999.99"
                      value={displayTotal}
                      onChange={e => setManualTotal(e.target.value)}
                      className="w-full text-xl font-bold text-green-800 text-right bg-transparent focus:outline-none focus:ring-1 focus:ring-green-400 rounded"
                    />
                  </div>

                  {/* วันที่ */}
                  <div className="border border-gray-400 rounded p-1 bg-gray-50 flex flex-col items-center justify-center"
                    style={{ width: 88 }}>
                    <div className="text-[7px] text-gray-400 leading-none">วันที่</div>
                    <div className="text-[13px] font-extrabold text-gray-800 leading-tight text-center">{today}</div>
                  </div>

                  {/* เบิกของ */}
                  <div className={`border border-gray-400 rounded p-1 flex flex-col justify-center ${sourceType === '' ? 'bg-red-50' : 'bg-white'}`}
                    style={{ width: 88 }}>
                    <div className="text-[7px] font-semibold text-gray-500 leading-none mb-0.5">เบิกของ</div>
                    <select value={sourceType}
                      onChange={e => setSourceType(e.target.value as 'โกดัง' | 'หน้าร้าน')}
                      className={`w-full border-2 rounded font-bold text-[11px] px-0.5 bg-white focus:outline-none ${sourceType === '' ? 'border-red-400 text-red-500' : 'border-gray-400 text-gray-800'}`}>
                      <option value="" disabled>— เลือก —</option>
                      <option value="โกดัง">โกดัง</option>
                      <option value="หน้าร้าน">หน้าร้าน</option>
                    </select>
                    {sourceType === '' && <div className="text-[7px] text-red-500 leading-none mt-0.5">กรุณาเลือก</div>}
                  </div>

                  {/* สาขา */}
                  <div className="border border-gray-400 rounded p-1 bg-gray-50 flex flex-col justify-center overflow-hidden"
                    style={{ width: 108 }}>
                    {branchInfo ? (
                      <>
                        <div className="text-[7px] text-gray-400 leading-none">สาขา/ตัวแทน</div>
                        <div className="text-[14px] font-extrabold text-gray-800 leading-tight truncate">{branchInfo.name}</div>
                        <div className="text-[8px] text-gray-500 truncate">{branchInfo.phone}</div>
                      </>
                    ) : (
                      <div className="text-[8px] text-gray-400 italic">ยังไม่ได้เข้าสู่ระบบ</div>
                    )}
                  </div>

                  {/* รถ */}
                  <div className={`border border-gray-400 rounded p-1 flex flex-col justify-center ${vehicleType === '' ? 'bg-red-50' : 'bg-white'}`}
                    style={{ width: 100 }}>
                    <div className="text-[7px] font-semibold text-gray-500 leading-none mb-0.5">รถ</div>
                    <select value={vehicleType}
                      onChange={e => setVehicleType(e.target.value as 'จองรถ60000' | 'รอพ่วง')}
                      className={`w-full border-2 rounded font-bold text-[11px] px-0.5 bg-white focus:outline-none ${vehicleType === '' ? 'border-red-400 text-red-500' : 'border-gray-400 text-gray-800'}`}>
                      <option value="" disabled>— เลือก —</option>
                      <option value="จองรถ60000">จองรถ 60,000</option>
                      <option value="รอพ่วง">รอพ่วง</option>
                    </select>
                    {vehicleType === '' && <div className="text-[7px] text-red-500 leading-none mt-0.5">กรุณาเลือก</div>}
                  </div>

                </div>
                {/* ── end info panel ── */}

              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
