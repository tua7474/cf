'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import DataTable from '@/components/DataTable'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowData = Record<string, any>
type PendingEdits = Record<string, Record<string, string | number>>

const DRAFT_KEY = 'cf_draft_catalog'

const VIEW_COLUMNS = [
  { key: 'group_name',   label: 'กลุ่มสินค้า' },
  { key: 'product_name', label: 'ชื่อสินค้า' },
  { key: 'price',      label: 'ราคาสินค้า', type: 'currency' as const, align: 'right' as const },
  { key: 'cost',       label: 'ต้นทุน',     type: 'currency' as const, align: 'right' as const },
  { key: 'quantity',   label: 'จำนวน',      type: 'number'   as const, align: 'right' as const },
  { key: 'updated_at', label: 'แก้ไขล่าสุด', align: 'center' as const },
]

const EDIT_COLUMNS = [
  { key: 'group_name',   label: 'กลุ่มสินค้า', editable: true, confirmOnEdit: true },
  { key: 'product_name', label: 'ชื่อสินค้า',  editable: true },
  { key: 'price',      label: 'ราคาสินค้า', type: 'currency' as const, align: 'right' as const, editable: true },
  { key: 'cost',       label: 'ต้นทุน',     type: 'currency' as const, align: 'right' as const, editable: true },
  { key: 'quantity',   label: 'จำนวน',      type: 'number'   as const, align: 'right' as const, editable: true },
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
  const [rows, setRows]         = useState<RowData[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState<string | null>(null)
  const [pending, setPending]   = useState<PendingEdits>({})
  const [filterGroup, setFilterGroup] = useState<string>('')
  const [isEditing, setIsEditing]     = useState(false)

  useEffect(() => { setPending(loadDraft()) }, [])

  useEffect(() => {
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

  const handleAddProduct = useCallback(async (data: Record<string, string | number>) => {
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      const fresh: RowData[] = await fetch('/api/catalog').then(r => r.json())
      setRows(fresh)
    } catch {
      alert('เกิดข้อผิดพลาดในการเพิ่มสินค้า')
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
      const fresh: RowData[] = await fetch('/api/catalog').then(r => r.json())
      setRows(fresh)
    } catch {
      setSaveMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  const handleCancelEdit = () => {
    setPending({})
    localStorage.removeItem(DRAFT_KEY)
    setIsEditing(false)
  }

  // Unique group names for filter tabs and confirmOnEdit
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
            <h1 className="text-xl font-bold">
              กระดาษฝอยไทย — รายการสินค้า
              {isEditing && <span className="ml-2 text-yellow-300 text-base font-normal">(โหมดแก้ไข)</span>}
            </h1>
            <p className="text-green-200 text-xs mt-0.5">
              {rows.length} รายการ
              {isEditing ? ' · แก้ไขได้ทุกช่อง · เพิ่มรายการใหม่ได้' : ' · กด แก้ไข เพื่อแก้ไขข้อมูล'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm px-3 py-1 rounded-full text-white ${saveMsg.includes('สำเร็จ') ? 'bg-green-500' : 'bg-red-500'}`}>
              {saveMsg}
            </span>
          )}

          {isEditing ? (
            <>
              {pendingCount > 0 && (
                <span className="text-yellow-300 text-sm">
                  ✎ แก้ไขค้างอยู่ {pendingCount} แถว
                </span>
              )}
              {pendingCount > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 text-sm rounded bg-yellow-400 hover:bg-yellow-300 text-green-900 font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? 'กำลังบันทึก...' : '💾 บันทึกลง DB'}
                </button>
              )}
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-1.5 text-sm rounded bg-white text-green-900 font-semibold hover:bg-green-100 transition-colors"
              >
                ✓ เสร็จแล้ว
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-1.5 text-sm rounded bg-white text-green-900 font-semibold hover:bg-green-100 transition-colors"
            >
              ✎ แก้ไข
            </button>
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
          const pendingInGroup = isEditing ? Object.keys(pending).filter(id => {
            const row = rows.find(r => String(r.id) === id)
            return row?.group_name === g
          }).length : 0
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
          {isEditing && pendingCount > 0 && (
            <span className="ml-2 text-yellow-600 font-medium">
              — มีการแก้ไขที่ยังไม่บันทึกลง DB (auto-saved ใน browser แล้ว)
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <DataTable
            columns={isEditing ? EDIT_COLUMNS : VIEW_COLUMNS}
            rows={filteredRows}
            pendingEdits={isEditing ? pending : {}}
            onCellEdit={isEditing ? handleCellEdit : undefined}
            rowKeyField="id"
            groupByField={isEditing ? 'group_name' : undefined}
            onAddRow={isEditing ? handleAddProduct : undefined}
            existingGroups={isEditing ? groups : []}
          />
        )}
      </main>
    </div>
  )
}
