'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import DataTable from '@/components/DataTable'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowData = Record<string, any>
type PendingEdits = Record<string, Record<string, number>>

const DRAFT_KEY = 'cf_draft_catalog'

const COLUMNS = [
  { key: 'group_name',   label: 'กลุ่มสินค้า' },
  { key: 'product_name', label: 'ชื่อสินค้า' },
  { key: 'price',    label: 'ราคาสินค้า', type: 'currency' as const, align: 'right' as const, editable: true },
  { key: 'cost',     label: 'ต้นทุน',     type: 'currency' as const, align: 'right' as const, editable: true },
  { key: 'quantity', label: 'จำนวน',      type: 'number'   as const, align: 'right' as const, editable: true },
  { key: 'updated_at', label: 'แก้ไขล่าสุด', align: 'center' as const },
]

function loadDraft(): PendingEdits {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveDraft(edits: PendingEdits) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(edits))
}

export default function CatalogPage() {
  const [rows, setRows]       = useState<RowData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingEdits>({})
  const [filterGroup, setFilterGroup] = useState<string>('')

  useEffect(() => { setPending(loadDraft()) }, [])

  useEffect(() => {
    fetch('/api/catalog')
      .then(r => r.json())
      .then((data: RowData[]) => { setRows(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleCellEdit = useCallback((rowKey: string, colKey: string, value: number) => {
    setPending(prev => {
      const next = {
        ...prev,
        [rowKey]: { ...prev[rowKey], [colKey]: value },
      }
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
      const fresh: RowData[] = await fetch('/api/catalog').then(r => r.json())
      setRows(fresh)
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  // Unique group names for filter tabs
  const groups = Array.from(new Set(rows.map(r => r.group_name as string)))

  const filteredRows = filterGroup ? rows.filter(r => r.group_name === filterGroup) : rows

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-green-200 hover:text-white text-sm transition-colors">
            ← กลับหน้าหลัก
          </Link>
          <div>
            <h1 className="text-xl font-bold">กระดาษฝอยไทย — แก้ไขราคาสินค้า</h1>
            <p className="text-green-200 text-xs mt-0.5">224 รายการ · แก้ไขราคา/ต้นทุน/จำนวนได้ · Auto-save ใน browser</p>
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
                ✎ แก้ไขค้างอยู่ {pendingCount} แถว (auto-saved)
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

      {/* ── Group filter tabs ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-0 shadow-sm overflow-x-auto">
        <button
          onClick={() => setFilterGroup('')}
          className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            filterGroup === ''
              ? 'border-green-600 text-green-700 bg-green-50'
              : 'border-transparent text-gray-600 hover:text-green-700 hover:bg-gray-50'
          }`}
        >
          ทั้งหมด ({rows.length})
        </button>
        {groups.map(g => {
          const cnt = rows.filter(r => r.group_name === g).length
          const pendingInGroup = Object.keys(pending).filter(id => {
            const row = rows.find(r => String(r.id) === id)
            return row?.group_name === g
          }).length
          return (
            <button
              key={g}
              onClick={() => setFilterGroup(g)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors relative ${
                filterGroup === g
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-600 hover:text-green-700 hover:bg-gray-50'
              }`}
            >
              {g} ({cnt})
              {pendingInGroup > 0 && (
                <span className="ml-1.5 bg-yellow-400 text-yellow-900 text-xs rounded-full px-1.5 py-0.5 font-bold">
                  {pendingInGroup}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="p-4">
        <div className="mb-3 text-sm text-gray-500">
          {loading ? 'กำลังโหลด...' : `${filteredRows.length} รายการ`}
          {pendingCount > 0 && (
            <span className="ml-2 text-yellow-600 font-medium">
              — มีการแก้ไขที่ยังไม่บันทึกลง DB (auto-saved ใน browser แล้ว)
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={filteredRows}
            pendingEdits={pending}
            onCellEdit={handleCellEdit}
            rowKeyField="id"
          />
        )}
      </main>
    </div>
  )
}
