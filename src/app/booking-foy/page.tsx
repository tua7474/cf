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
  show_in_booking: boolean
}

interface ModelGroup {
  name: string
  items: StockItem[]
}

// ── Layout constants (A4 portrait) ────────────────────────────────────────────
//
// A4 portrait content width = (210 − 2×8)mm × (96/25.4) ≈ 733 px
// 3 columns with 4px gap each → COL_W = (733 − 8) / 3 ≈ 241px
//
const NUM_COLS   = 3
const MCOL_COLOR = 90          // ชื่อสี
const MCOL_PRICE = 54          // ราคา
const MCOL_QTY   = 42          // จำนวน
const MCOL_TOTAL = 55          // รวม
const COL_W      = MCOL_COLOR + MCOL_PRICE + MCOL_QTY + MCOL_TOTAL  // 241
const COL_GAP    = 4
const TOTAL_W    = NUM_COLS * COL_W + (NUM_COLS - 1) * COL_GAP      // 731

// A4 portrait px dimensions
const A4_W_PX    = 210 * (96 / 25.4)   // ≈ 793.7
const A4_PAD_PX  = 8   * (96 / 25.4)   // ≈ 30.2
const CONTENT_SCALE = Math.min(1, (A4_W_PX - A4_PAD_PX * 2) / TOTAL_W)  // ≈ 1.0

// Print: (210−6)mm available, 3mm padding each side
const PRINT_ZOOM = Math.min(1, Math.round(((204 * 96) / 25.4) / TOTAL_W * 1000) / 1000)  // ≈ 1.0

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt2(n: number) {
  if (!n) return ''
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingFoyPage() {
  const [items, setItems]         = useState<StockItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState<string | null>(null)
  const [pending, setPending]     = useState<Record<number, number>>({})
  const [zoom, setZoom]           = useState(1)
  const [sourceType, setSourceType]   = useState<'โกดัง' | 'หน้าร้าน' | ''>('')
  const [vehicleType, setVehicleType] = useState<'จองรถ60000' | 'รอพ่วง' | ''>('')
  const [manualTotal, setManualTotal] = useState('')
  const [branchInfo, setBranchInfo]   = useState<{ name: string; phone: string } | null>(null)

  // Scale A4 portrait frame to fit narrow screens
  useEffect(() => {
    const calc = () => setZoom(Math.min(1, window.innerWidth / (A4_W_PX + 32)))
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    try {
      const bs = localStorage.getItem('branch_session')
      if (bs) {
        const s = JSON.parse(bs)
        if (s?.branch_name) setBranchInfo({ name: s.branch_name, phone: s.phone ?? '' })
      }
    } catch { /* ignore */ }
  }, [])

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

  // ── จอง: call stock API action='book' for each pending item ───────────────

  const handleBook = async () => {
    const entries = Object.entries(pending).filter(([, q]) => q > 0)
    if (!entries.length) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await Promise.all(
        entries.map(([idStr, qty]) =>
          fetch('/api/stock', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: Number(idStr), action: 'book', qty }),
          })
        )
      )
      setSaveMsg(`จองสำเร็จ ${entries.length} รายการ`)
      setPending({})
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  // Group items by model_name, only items with show_in_booking = true
  const modelGroups: ModelGroup[] = []
  const seen = new Map<string, ModelGroup>()
  for (const item of items.filter(it => it.show_in_booking)) {
    if (!seen.has(item.model_name)) {
      const g: ModelGroup = { name: item.model_name, items: [] }
      seen.set(item.model_name, g)
      modelGroups.push(g)
    }
    seen.get(item.model_name)!.items.push(item)
  }

  // Distribute models into NUM_COLS columns, top-down
  const perCol = Math.ceil(modelGroups.length / NUM_COLS)
  const columns: ModelGroup[][] = Array.from({ length: NUM_COLS }, (_, ci) =>
    modelGroups.slice(ci * perCol, (ci + 1) * perCol)
  )

  // Grand total (auto-calc from pending)
  let grandTotal = 0
  for (const [idStr, qty] of Object.entries(pending)) {
    const item = items.find(it => it.id === Number(idStr))
    if (item) grandTotal += (parseFloat(item.warehouse_price) || 0) * qty
  }
  const displayTotal = manualTotal !== '' ? manualTotal : grandTotal.toFixed(2)
  const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const pendingCount = Object.values(pending).filter(q => q > 0).length

  // ── Model section renderer ─────────────────────────────────────────────────

  const renderModelSection = (g: ModelGroup, ci: number, mi: number) => (
    <div key={`c${ci}m${mi}`} className="mb-1.5">
      <table className="border-collapse" style={{ tableLayout: 'fixed', width: COL_W }}>
        <colgroup>
          <col style={{ width: MCOL_COLOR }} />
          <col style={{ width: MCOL_PRICE }} />
          <col style={{ width: MCOL_QTY }} />
          <col style={{ width: MCOL_TOTAL }} />
        </colgroup>
        <thead>
          {/* รุ่น header */}
          <tr className="bg-green-700 text-white">
            <th colSpan={4} className="border border-gray-500 px-1 py-0.5 text-center font-bold overflow-hidden text-[10px]">
              <div className="truncate">{g.name}</div>
            </th>
          </tr>
          {/* sub-column header */}
          <tr className="bg-green-800 text-white text-[9px]">
            <th className="border border-gray-500 px-1 py-0.5 text-left font-medium">ชื่อสี</th>
            <th className="border border-gray-500 px-1 py-0.5 text-right font-medium">ราคา</th>
            <th className="border border-gray-500 px-1 py-0.5 text-right font-medium">จำนวน</th>
            <th className="border border-gray-500 px-1 py-0.5 text-right font-medium">รวม</th>
          </tr>
        </thead>
        <tbody>
          {g.items.map(item => {
            const price      = parseFloat(item.warehouse_price) || 0
            const qty        = pending[item.id] ?? 0
            const total      = qty * price
            const hasPending = qty > 0
            return (
              <tr key={item.id} className="hover:bg-yellow-50/30 transition-colors">
                {/* ชื่อสี */}
                <td className={`border border-gray-300 px-1 py-px bg-gray-100 overflow-hidden ${hasPending ? 'ring-1 ring-inset ring-yellow-400' : ''}`}>
                  <div className="truncate text-[9px] text-gray-800">{item.color_name || item.color_code || '–'}</div>
                </td>
                {/* ราคา */}
                <td className="border border-gray-300 px-1 py-px text-right bg-gray-100 text-[9px] text-gray-800">
                  {price ? price.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '–'}
                </td>
                {/* จำนวน */}
                <td className={`border border-gray-300 p-0 ${hasPending ? 'bg-yellow-50' : 'bg-white'}`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    defaultValue={qty || ''}
                    key={`qty-${item.id}`}
                    onChange={e => handleQtyChange(item.id, e.target.value)}
                    className={`w-full px-1 py-px text-[9px] text-right bg-transparent focus:outline-none focus:ring-1 focus:ring-inset focus:ring-green-500 ${hasPending ? 'font-semibold' : ''}`}
                  />
                </td>
                {/* รวม */}
                <td className="border border-gray-300 px-1 py-px text-right bg-gray-100 text-[9px] text-gray-800">
                  {total > 0 ? fmt2(total) : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }

          .screen-zoom-wrapper {
            zoom: 1 !important;
            padding: 0 !important;
            display: block !important;
          }

          /* A4 portrait: 210×297mm, 4mm padding */
          .a4-frame {
            width: 210mm !important;
            height: 297mm !important;
            min-height: unset !important;
            padding: 4mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
          }

          .a4-content {
            zoom: ${PRINT_ZOOM} !important;
          }

          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="no-print bg-green-800 text-white px-6 py-3 shadow flex items-center gap-4">
        <Link href="/stock" className="text-green-200 hover:text-white text-sm transition-colors">
          ← สต็อคกระดาษฝอย
        </Link>
        <div>
          <h1 className="text-xl font-bold">ใบจองกระดาษฝอย</h1>
          <p className="text-green-200 text-xs mt-0.5">A4 แนวตั้ง · 3 คอลัมน์ · {modelGroups.length} รุ่น</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm px-3 py-1 rounded-full text-white ${saveMsg.includes('สำเร็จ') ? 'bg-green-500' : 'bg-red-500'}`}>
              {saveMsg}
            </span>
          )}

          {/* ปุ่มจอง (แสดงเมื่อมีรายการ) */}
          <button
            onClick={handleBook}
            disabled={saving || pendingCount === 0}
            className={`px-4 py-1.5 text-sm rounded font-semibold transition-colors disabled:opacity-40 ${
              pendingCount > 0
                ? 'bg-yellow-400 hover:bg-yellow-300 text-green-900'
                : 'bg-white/20 text-white border border-white/30 cursor-not-allowed'
            }`}>
            {saving ? 'กำลังจอง...' : pendingCount > 0 ? `📦 จอง (${pendingCount})` : '📦 จอง'}
          </button>

          {/* ปุ่มพิมพ์ */}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white transition-colors border border-white/30">
            🖨️ พิมพ์
          </button>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main>
        <div
          className="screen-zoom-wrapper p-4 flex justify-center"
          style={{ zoom: zoom < 1 ? zoom : undefined }}
        >
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
          ) : (
            <div
              className="a4-frame bg-white shadow-xl"
              style={{ width: '210mm', minHeight: '297mm', padding: '8mm', boxSizing: 'border-box' }}
            >
              <div
                className="a4-content"
                style={{ zoom: CONTENT_SCALE, transformOrigin: 'top left' }}
              >
                {/* Title */}
                <div className="text-center text-sm font-bold text-gray-800 mb-2 tracking-wide">
                  ใบจองกระดาษฝอย
                </div>

                {/* ── 3-column model grid ── */}
                <div className="flex" style={{ gap: COL_GAP, width: TOTAL_W }}>
                  {columns.map((colGroups, ci) => (
                    <div key={ci} style={{ width: COL_W, flexShrink: 0 }}>
                      {colGroups.map((g, mi) => renderModelSection(g, ci, mi))}
                    </div>
                  ))}
                </div>

                {/* ── Info panel ── */}
                <div className="flex gap-1 mt-2" style={{ width: TOTAL_W }}>

                  {/* ผู้ส่ง / ผู้รับ */}
                  <div className="flex-1 border border-gray-400 rounded overflow-hidden">
                    <div className="flex h-14">
                      <div className="flex-1 border-r border-gray-300 p-1">
                        <div className="text-[8px] font-semibold text-gray-500">ผู้ส่งสินค้า</div>
                      </div>
                      <div className="flex-1 p-1">
                        <div className="text-[8px] font-semibold text-gray-500">ผู้รับสินค้า</div>
                      </div>
                    </div>
                  </div>

                  {/* ยอดรวม */}
                  <div
                    className="border border-gray-400 rounded p-1 bg-green-50 flex flex-col justify-center"
                    style={{ width: 130 }}
                  >
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
                  <div
                    className="border border-gray-400 rounded p-1 bg-gray-50 flex flex-col items-center justify-center"
                    style={{ width: 84 }}
                  >
                    <div className="text-[7px] text-gray-400 leading-none">วันที่</div>
                    <div className="text-[12px] font-extrabold text-gray-800 leading-tight text-center">{today}</div>
                  </div>

                  {/* เบิกของ */}
                  <div
                    className={`border border-gray-400 rounded p-1 flex flex-col justify-center ${sourceType === '' ? 'bg-red-50' : 'bg-white'}`}
                    style={{ width: 80 }}
                  >
                    <div className="text-[7px] font-semibold text-gray-500 leading-none mb-0.5">เบิกของ</div>
                    <select
                      value={sourceType}
                      onChange={e => setSourceType(e.target.value as 'โกดัง' | 'หน้าร้าน')}
                      className={`w-full border-2 rounded font-bold text-[10px] px-0.5 bg-white focus:outline-none ${sourceType === '' ? 'border-red-400 text-red-500' : 'border-gray-400 text-gray-800'}`}
                    >
                      <option value="" disabled>— เลือก —</option>
                      <option value="โกดัง">โกดัง</option>
                      <option value="หน้าร้าน">หน้าร้าน</option>
                    </select>
                    {sourceType === '' && <div className="text-[7px] text-red-500 leading-none mt-0.5">กรุณาเลือก</div>}
                  </div>

                  {/* สาขา */}
                  <div
                    className="border border-gray-400 rounded p-1 bg-gray-50 flex flex-col justify-center overflow-hidden"
                    style={{ width: 100 }}
                  >
                    {branchInfo ? (
                      <>
                        <div className="text-[7px] text-gray-400 leading-none">สาขา/ตัวแทน</div>
                        <div className="text-[13px] font-extrabold text-gray-800 leading-tight truncate">{branchInfo.name}</div>
                        <div className="text-[8px] text-gray-500 truncate">{branchInfo.phone}</div>
                      </>
                    ) : (
                      <div className="text-[8px] text-gray-400 italic">ยังไม่ได้เข้าสู่ระบบ</div>
                    )}
                  </div>

                  {/* รถ */}
                  <div
                    className={`border border-gray-400 rounded p-1 flex flex-col justify-center ${vehicleType === '' ? 'bg-red-50' : 'bg-white'}`}
                    style={{ width: 90 }}
                  >
                    <div className="text-[7px] font-semibold text-gray-500 leading-none mb-0.5">รถ</div>
                    <select
                      value={vehicleType}
                      onChange={e => setVehicleType(e.target.value as 'จองรถ60000' | 'รอพ่วง')}
                      className={`w-full border-2 rounded font-bold text-[10px] px-0.5 bg-white focus:outline-none ${vehicleType === '' ? 'border-red-400 text-red-500' : 'border-gray-400 text-gray-800'}`}
                    >
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
