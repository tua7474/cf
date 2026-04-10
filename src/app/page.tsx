'use client'

import { useState, useEffect } from 'react'
import DataTable from '@/components/DataTable'

type Tab = 'sell' | 'buy' | 'products' | 'inventory' | 'targets'

const TABS: { key: Tab; label: string }[] = [
  { key: 'sell',      label: '💰 Transaction ขาย' },
  { key: 'buy',       label: '💸 Transaction ซื้อ' },
  { key: 'products',  label: '📦 สินค้า' },
  { key: 'inventory', label: '📊 คงเหลือ' },
  { key: 'targets',   label: '🎯 เป้าหมาย' },
]

const COLUMNS = {
  sell: [
    { key: 'date',             label: 'วันที่',           type: 'date' as const },
    { key: 'product_name',     label: 'ชื่อสินค้า' },
    { key: 'price',            label: 'ราคา',            type: 'currency' as const, align: 'right' as const },
    { key: 'unit',             label: 'หน่วย',           align: 'center' as const },
    { key: 'quantity_sold',    label: 'จำนวนที่ขาย',    type: 'number' as const,   align: 'right' as const },
    { key: 'total_value',      label: 'มูลค่ารวม',      type: 'currency' as const, align: 'right' as const },
    { key: 'avg_cost_total',   label: 'ต้นทุนเฉลี่ยรวม', type: 'currency' as const, align: 'right' as const },
    { key: 'gross_profit',     label: 'กำไรขั้นต้น',   type: 'currency' as const, align: 'right' as const },
    { key: 'gross_profit_pct', label: '%กำไร',          type: 'percent' as const,  align: 'right' as const },
    { key: 'year_month',       label: 'ปี-เดือน',       align: 'center' as const },
    { key: 'product_group',    label: 'กลุ่มสินค้า' },
    { key: 'note',             label: 'หมายเหตุ' },
  ],
  buy: [
    { key: 'date',             label: 'วันที่',          type: 'date' as const },
    { key: 'product_name',     label: 'ชื่อสินค้า' },
    { key: 'price',            label: 'ราคา',           type: 'currency' as const, align: 'right' as const },
    { key: 'unit',             label: 'หน่วย',          align: 'center' as const },
    { key: 'actual_quantity',  label: 'ตัดได้จริง',    type: 'number' as const,   align: 'right' as const },
    { key: 'other_costs',      label: 'ต้นทุนอื่นๆ',   type: 'currency' as const, align: 'right' as const },
    { key: 'total_value',      label: 'มูลค่ารวม',     type: 'currency' as const, align: 'right' as const },
    { key: 'year_month',       label: 'ปี-เดือน',      align: 'center' as const },
    { key: 'ordered_qty',      label: 'สั่งมา',        type: 'number' as const,   align: 'right' as const },
  ],
  products: [
    { key: 'product_name',  label: 'ชื่อสินค้า' },
    { key: 'buy_price',     label: 'ราคาซื้อ',      type: 'currency' as const, align: 'right' as const },
    { key: 'sell_price',    label: 'ราคาขาย',      type: 'currency' as const, align: 'right' as const },
    { key: 'unit',          label: 'หน่วยนับ',     align: 'center' as const },
    { key: 'min_quantity',  label: 'ขั้นต่ำ',      type: 'number' as const,   align: 'right' as const },
    { key: 'product_group', label: 'กลุ่มสินค้า' },
    { key: 'status',        label: 'Status',       align: 'center' as const },
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
    { key: 'year_month',      label: 'ปี-เดือน',         align: 'center' as const },
    { key: 'target',          label: 'เป้าหมาย',         type: 'currency' as const, align: 'right' as const },
    { key: 'actual',          label: 'ยอดขายจริง',       type: 'currency' as const, align: 'right' as const },
    { key: 'achievement_pct', label: '% บรรลุเป้า',      type: 'percent' as const,  align: 'right' as const },
  ],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowData = Record<string, any>

export default function Home() {
  const [tab, setTab] = useState<Tab>('sell')
  const [data, setData] = useState<Record<Tab, RowData[]>>({ sell: [], buy: [], products: [], inventory: [], targets: [] })
  const [loading, setLoading] = useState(true)

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

  const rows = data[tab]
  const cols = COLUMNS[tab]

  const summary: Record<string, number> = {}
  const numericCols = cols.filter((c) => c.type === 'currency' || c.type === 'number')
  numericCols.forEach((col) => {
    summary[col.key] = rows.reduce((sum, row) => sum + (parseFloat(row[col.key]) || 0), 0)
  })

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-800 text-white px-6 py-4 shadow">
        <h1 className="text-xl font-bold">กระดาษฝอยไทย — ระบบจัดการข้อมูล</h1>
        <p className="text-green-200 text-xs mt-0.5">ข้อมูลจาก Railway PostgreSQL</p>
      </header>

      <div className="bg-white border-b border-gray-200 px-4 flex gap-0 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-green-600 text-green-700 bg-green-50'
                : 'border-transparent text-gray-600 hover:text-green-700 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {loading ? 'กำลังโหลด...' : `${rows.length} รายการ`}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <DataTable columns={cols} rows={rows} summary={summary} />
        )}
      </main>
    </div>
  )
}
