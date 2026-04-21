'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import DataTable from '@/components/DataTable'

type PendingEdits = Record<string, Record<string, string | number>>

const CATALOG_COLUMNS = [
  { key: 'group_name',   label: 'กลุ่มสินค้า', editable: true, confirmOnEdit: true },
  { key: 'product_name', label: 'ชื่อสินค้า',  editable: true },
  { key: 'price',        label: 'ราคาโกดัง',  type: 'currency' as const, align: 'right' as const, editable: true },
  { key: 'cost',         label: 'สต็อค',      type: 'currency' as const, align: 'right' as const, editable: true },
  { key: 'quantity',     label: 'จำนวน',       type: 'number'   as const, align: 'right' as const, editable: true },
  { key: 'updated_at',   label: 'แก้ไขล่าสุด', align: 'center' as const },
]

const DRAFT_KEY = 'cf_draft_products'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowData = Record<string, any>

function loadDraft(): PendingEdits {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') } catch { return {} }
}
function saveDraft(edits: PendingEdits) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(edits))
}

export default function Home() {
  const [rows, setRows]       = useState<RowData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingEdits>({})

  useEffect(() => { setPending(loadDraft()) }, [])

  useEffect(() => {
    setLoading(true)
    fetch('/api/catalog')
      .then(r => r.json())
      .then((data: RowData[]) => { setRows(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleCellEdit = useCallback((rowKey: string, colKey: string, value: string | number) => {
    setPending(prev => {
      const next = { ...prev, [rowKey]: { ...prev[rowKey], [colKey]: value } }
      saveDraft(next)
      return next
    })
    // Immediately re-sort when group_name changes
    if (colKey === 'group_name') {
      const newGroup = String(value)
      setRows(prev => {
        const updated = prev.map(r => String(r.id) === rowKey ? { ...r, group_name: newGroup } : r)
        const groupOrder = Array.from(new Set(prev.map(r => r.group_name as string)))
        const finalOrder = groupOrder.includes(newGroup) ? groupOrder : [...groupOrder, newGroup]
        return finalOrder.flatMap(g => updated.filter(r => r.group_name === g))
      })
    }
  }, [])

  const pendingCount = Object.keys(pending).length

  const handleSave = async () => {
    if (!pendingCount) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const body = Object.entries(pending).map(([id, cols]) => ({ id: Number(id), ...cols }))
      const res = await fetch('/api/catalog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setPending({})
      localStorage.removeItem(DRAFT_KEY)
      setSaveMsg(`บันทึกสำเร็จ ${pendingCount} รายการ`)
      const fresh = await fetch('/api/catalog').then(r => r.json())
      setRows(fresh)
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  const handleAddProduct = useCallback(async (data: Record<string, string | number>) => {
    if (!data.group_name || !data.product_name) return
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const fresh = await fetch('/api/catalog').then(r => r.json())
      setRows(fresh)
      setSaveMsg('เพิ่มสินค้าสำเร็จ')
      setTimeout(() => setSaveMsg(null), 3000)
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด')
    }
  }, [])

  const existingGroups = Array.from(new Set(rows.map(r => r.group_name as string)))

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">กระดาษฝอยไทย — ระบบจัดการข้อมูล</h1>
          <p className="text-green-200 text-xs mt-0.5">ข้อมูลจาก Railway PostgreSQL</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/catalog"
            className="px-4 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white font-medium transition-colors border border-white/30"
          >
            🏷 แก้ไขสินค้า
          </Link>
          <Link
            href="/booking"
            className="px-4 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white font-medium transition-colors border border-white/30"
          >
            📋 ใบจอง
          </Link>
          {saveMsg && (
            <span className={`text-sm px-3 py-1 rounded-full ${saveMsg.includes('สำเร็จ') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {saveMsg}
            </span>
          )}
          {pendingCount > 0 && (
            <>
              <span className="text-yellow-300 text-sm">✎ แก้ไขค้างอยู่ {pendingCount} แถว</span>
              <button onClick={() => { setPending({}); localStorage.removeItem(DRAFT_KEY) }}
                className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white transition-colors">
                ยกเลิก
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-1.5 text-sm rounded bg-yellow-400 hover:bg-yellow-300 text-green-900 font-semibold transition-colors disabled:opacity-50">
                {saving ? 'กำลังบันทึก...' : '💾 บันทึกลง DB'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Tab header */}
      <div className="bg-white border-b border-gray-200 px-4 shadow-sm flex">
        <span className="inline-block px-4 py-3 text-sm font-medium border-b-2 border-green-600 text-green-700 bg-green-50">
          📦 สินค้า
        </span>
        <Link href="/stock"
          className="inline-block px-4 py-3 text-sm font-medium text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors">
          🌿 สต็อคกระดาษฝอย
        </Link>
        <Link href="/branches"
          className="inline-block px-4 py-3 text-sm font-medium text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors">
          🏪 สาขาและตัวแทน
        </Link>
      </div>

      <main className="p-4">
        <div className="mb-3 text-sm text-gray-500">
          {loading ? 'กำลังโหลด...' : `${rows.length} รายการ`}
          {pendingCount > 0 && (
            <span className="ml-2 text-yellow-600 font-medium">— มีการแก้ไขที่ยังไม่บันทึกลง DB</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <DataTable
            columns={CATALOG_COLUMNS}
            rows={rows}
            pendingEdits={pending}
            onCellEdit={handleCellEdit}
            rowKeyField="id"
            groupByField="group_name"
            onAddRow={handleAddProduct}
            existingGroups={existingGroups}
          />
        )}
      </main>
    </div>
  )
}
