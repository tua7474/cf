'use client'

import { useState, useEffect, useCallback } from 'react'
import DataTable from '@/components/DataTable'

type Tab = 'sell' | 'buy' | 'products' | 'inventory' | 'targets'
// pendingEdits: { [rowKey]: { [colKey]: newValue } }
type PendingEdits = Record<string, Record<string, number>>

const TABS: { key: Tab; label: string }[] = [
  { key: 'sell',      label: '💰 Transaction ขาย' },
  { key: 'buy',       label: '💸 Transaction ซื้อ' },
  { key: 'products',  label: '📦 สินค้า' },
  { key: 'inventory', label: '📊 คงเหลือ' },
  { key: 'targets',   label: '🎯 เป้าหมาย' },
]

const COLUMNS = {
  sell: [
    { key: 'date',             label: 'วันที่',             type: 'date' as const },
    { key: 'product_name',     label: 'ชื่อสินค้า' },
    { key: 'price',            label: 'ราคา',              type: 'currency' as const, align: 'right' as const, editable: true },
    { key: 'unit',             label: 'หน่วย',             align: 'center' as const },
    { key: 'quantity_sold',    label: 'จำนวนที่ขาย',      type: 'number' as const,   align: 'right' as const },
    { key: 'total_value',      label: 'มูลค่ารวม',        type: 'currency' as const, align: 'right' as const },
    { key: 'avg_cost_total',   label: 'ต้นทุนเฉลี่ยรวม', type: 'currency' as const, align: 'right' as const },
    { key: 'gross_profit',     label: 'กำไรขั้นต้น',     type: 'currency' as const, align: 'right' as const },
    { key: 'gross_profit_pct', label: '%กำไร',            type: 'percent' as const,  align: 'right' as const },
    { key: 'year_month',       label: 'ปี-เดือน',         align: 'center' as const },
    { key: 'product_group',    label: 'กลุ่มสินค้า' },
    { key: 'note',             label: 'หมายเหตุ' },
  ],
  buy: [
    { key: 'date',             label: 'วันที่',            type: 'date' as const },
    { key: 'product_name',     label: 'ชื่อสินค้า' },
    { key: 'price',            label: 'ราคา',             type: 'currency' as const, align: 'right' as const, editable: true },
    { key: 'unit',             label: 'หน่วย',            align: 'center' as const },
    { key: 'actual_quantity',  label: 'ตัดได้จริง',      type: 'number' as const,   align: 'right' as const },
    { key: 'other_costs',      label: 'ต้นทุนอื่นๆ',     type: 'currency' as const, align: 'right' as const },
    { key: 'total_value',      label: 'มูลค่ารวม',       type: 'currency' as const, align: 'right' as const },
    { key: 'year_month',       label: 'ปี-เดือน',        align: 'center' as const },
    { key: 'ordered_qty',      label: 'สั่งมา',          type: 'number' as const,   align: 'right' as const },
  ],
  products: [
    { key: 'product_name',  label: 'ชื่อสินค้า' },
    { key: 'buy_price',     label: 'ราคาซื้อ',  type: 'currency' as const, align: 'right' as const, editable: true },
    { key: 'sell_price',    label: 'ราคาขาย',  type: 'currency' as const, align: 'right' as const, editable: true },
    { key: 'unit',          label: 'หน่วยนับ', align: 'center' as const },
    { key: 'min_quantity',  label: 'ขั้นต่ำ',  type: 'number' as const,   align: 'right' as const },
    { key: 'product_group', label: 'กลุ่มสินค้า' },
    { key: 'status',        label: 'Status',   align: 'center' as const },
  ],
  inventory: [
    { key: 'product_name',   label: 'ชื่อสินค้า' },
    { key: 'product_group',  label: 'กลุ่มสินค้า' },
    { key: 'unit',           label: 'หน่วย',          align: 'center' as const },
    { key: 'total_bought',   label: 'ซื้อทั้งหมด',   type: 'number' as const,   align: 'right' as const },
    { key: 'total_sold',     label: 'ขายทั้งหมด',   type: 'number' as const,   align: 'right' as const },
    { key: 'stock_qty',      label: 'คงเหลือ',       type: 'number' as const,   align: 'right' as const },
    { key: 'avg_cost',       label: 'ต้นทุนเฉลี่ย', type: 'currency' as const, align: 'right' as const },
    { key: 'stock_value',    label: 'มูลค่าคงเหลือ', type: 'currency' as const, align: 'right' as const },
    { key: 'sell_price',     label: 'ราคาขาย',      type: 'currency' as const, align: 'right' as const },
    { key: 'min_quantity',   label: 'ขั้นต่ำ',       type: 'number' as const,   align: 'right' as const },
    { key: 'status',         label: 'Status',        align: 'center' as const },
  ],
  targets: [
    { key: 'year_month',      label: 'ปี-เดือน',   align: 'center' as const },
    { key: 'target',          label: 'เป้าหมาย',   type: 'currency' as const, align: 'right' as const, editable: true },
    { key: 'actual',          label: 'ยอดขายจริง', type: 'currency' as const, align: 'right' as const },
    { key: 'achievement_pct', label: '% บรรลุเป้า', type: 'percent' as const,  align: 'right' as const },
  ],
}

const ROW_KEY: Record<Tab, string> = {
  sell: 'id', buy: 'id', products: 'product_name', inventory: 'product_name', targets: 'year_month',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowData = Record<string, any>

function loadDraft(tab: Tab): PendingEdits {
  try {
    const raw = localStorage.getItem(`cf_draft_${tab}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveDraft(tab: Tab, edits: PendingEdits) {
  localStorage.setItem(`cf_draft_${tab}`, JSON.stringify(edits))
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('sell')
  const [data, setData] = useState<Record<Tab, RowData[]>>({ sell: [], buy: [], products: [], inventory: [], targets: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [allPending, setAllPending] = useState<Record<Tab, PendingEdits>>({
    sell: {}, buy: {}, products: {}, inventory: {}, targets: {},
  })

  // โหลด draft จาก localStorage เมื่อเปิดหน้า
  useEffect(() => {
    const tabs: Tab[] = ['sell', 'buy', 'products', 'inventory', 'targets']
    const drafts = Object.fromEntries(tabs.map((t) => [t, loadDraft(t)])) as Record<Tab, PendingEdits>
    setAllPending(drafts)
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/${tab}`)
      .then((r) => r.json())
      .then((rows) => {
        setData((prev) => ({ ...prev, [tab]: rows }))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tab])

  const handleCellEdit = useCallback((rowKey: string, colKey: string, value: number) => {
    setAllPending((prev) => {
      const updated = {
        ...prev,
        [tab]: {
          ...prev[tab],
          [rowKey]: { ...prev[tab][rowKey], [colKey]: value },
        },
      }
      saveDraft(tab, updated[tab]) // auto-save ลง localStorage ทันที
      return updated
    })
  }, [tab])

  const pendingCount = Object.keys(allPending[tab]).length

  const handleSave = async () => {
    if (pendingCount === 0) return
    setSaving(true)
    setSaveMsg(null)

    try {
      const edits = allPending[tab]
      let body: unknown

      if (tab === 'sell' || tab === 'buy') {
        body = Object.entries(edits).map(([id, cols]) => ({ id: Number(id), ...cols }))
      } else if (tab === 'products') {
        body = Object.entries(edits).map(([product_name, cols]) => ({ product_name, ...cols }))
      } else if (tab === 'targets') {
        body = Object.entries(edits).map(([year_month, cols]) => ({ year_month, ...cols }))
      }

      const res = await fetch(`/api/${tab}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error('save failed')

      // ล้าง draft + reload data
      const newPending = { ...allPending, [tab]: {} }
      setAllPending(newPending)
      localStorage.removeItem(`cf_draft_${tab}`)
      setSaveMsg(`บันทึกสำเร็จ ${pendingCount} รายการ`)

      // reload
      const fresh = await fetch(`/api/${tab}`).then((r) => r.json())
      setData((prev) => ({ ...prev, [tab]: fresh }))
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  const handleDiscard = () => {
    setAllPending((prev) => ({ ...prev, [tab]: {} }))
    localStorage.removeItem(`cf_draft_${tab}`)
  }

  const rows = data[tab]
  const cols = COLUMNS[tab]
  const pending = allPending[tab]

  const summary: Record<string, number> = {}
  cols.filter((c) => c.type === 'currency' || c.type === 'number').forEach((col) => {
    summary[col.key] = rows.reduce((sum, row) => sum + (parseFloat(row[col.key]) || 0), 0)
  })

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">กระดาษฝอยไทย — ระบบจัดการข้อมูล</h1>
          <p className="text-green-200 text-xs mt-0.5">ข้อมูลจาก Railway PostgreSQL</p>
        </div>

        {/* ปุ่มบันทึก */}
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm px-3 py-1 rounded-full ${saveMsg.includes('สำเร็จ') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
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
                {saving ? 'กำลังบันทึก...' : `💾 บันทึกลง DB`}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 px-4 flex gap-0 shadow-sm">
        {TABS.map((t) => {
          const draftCount = Object.keys(allPending[t.key]).length
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                tab === t.key
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-600 hover:text-green-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
              {draftCount > 0 && (
                <span className="ml-1.5 bg-yellow-400 text-yellow-900 text-xs rounded-full px-1.5 py-0.5 font-bold">
                  {draftCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <main className="p-4">
        <div className="mb-3 text-sm text-gray-500">
          {loading ? 'กำลังโหลด...' : `${rows.length} รายการ`}
          {pendingCount > 0 && <span className="ml-2 text-yellow-600 font-medium">— มีการแก้ไขที่ยังไม่บันทึกลง DB (auto-saved ใน browser แล้ว)</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <DataTable
            columns={cols}
            rows={rows}
            summary={summary}
            pendingEdits={pending}
            onCellEdit={handleCellEdit}
            rowKeyField={ROW_KEY[tab]}
          />
        )}
      </main>
    </div>
  )
}
