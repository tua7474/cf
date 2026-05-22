'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockItem {
  id: number
  model_name: string
  color_code: string
  color_name: string
  stock_qty: string
  last_added_qty: string
  last_added_at: string | null
  last_booked_qty: string
  last_booked_at: string | null
  warehouse_price: string
  retail_price: string
  show_in_booking: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtQty(n: string | number): string {
  const v = parseFloat(String(n))
  return isNaN(v) ? '0' : v.toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function fmtMoney(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

const EMPTY_NEW = { model_name: '', color_code: '', color_name: '', warehouse_price: '', retail_price: '' }

export default function StockPage() {
  const [items, setItems]               = useState<StockItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [newRow, setNewRow]             = useState(EMPTY_NEW)
  const [addInputs, setAddInputs]       = useState<Record<number, string>>({})
  const [bookInputs, setBookInputs]     = useState<Record<number, string>>({})
  const [rowEdits, setRowEdits]         = useState<Record<number, Partial<StockItem>>>({})
  const [busy, setBusy]                 = useState<Record<number | string, boolean>>({})
  const [msg, setMsg]                   = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/stock')
      .then(r => r.json())
      .then((data: StockItem[]) => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/catalog')
      .then(r => r.json())
      .then((data: { group_name: string; product_name: string }[]) => {
        const names = data
          .filter(p => p.group_name === 'กระดาษฝอย')
          .map(p => p.product_name)
        setModelOptions(names)
      })
      .catch(() => {})
  }, [])

  const showMsg = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 2500)
  }

  // ── Duplicate check ──────────────────────────────────────────────────────────

  const isDuplicate = (model_name: string, color_name: string, excludeId?: number) =>
    items.some(it =>
      it.id !== excludeId &&
      it.model_name.trim() === model_name.trim() &&
      it.color_name.trim() === color_name.trim()
    )

  // ── Add new row ──────────────────────────────────────────────────────────────

  const handleAddRow = async () => {
    if (!newRow.model_name.trim()) return
    if (isDuplicate(newRow.model_name, newRow.color_name)) {
      showMsg('❌ ชื่อรุ่น + ชื่อสี ซ้ำกับที่มีอยู่แล้ว')
      return
    }
    setBusy(b => ({ ...b, new: true }))
    const res = await fetch('/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newRow,
        warehouse_price: parseFloat(newRow.warehouse_price) || 0,
        retail_price:    parseFloat(newRow.retail_price)    || 0,
      }),
    })
    setBusy(b => ({ ...b, new: false }))
    if (res.ok) { setNewRow(EMPTY_NEW); load(); showMsg('เพิ่มรุ่นสำเร็จ') }
  }

  // ── Stock operations (add / book) ────────────────────────────────────────────

  const handleStock = async (id: number, action: 'add' | 'book') => {
    const raw = action === 'add' ? addInputs[id] : bookInputs[id]
    const qty = parseFloat(raw ?? '')
    if (!qty || qty <= 0) return
    setBusy(b => ({ ...b, [`${action}-${id}`]: true }))
    const res = await fetch('/api/stock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, qty }),
    })
    setBusy(b => ({ ...b, [`${action}-${id}`]: false }))
    if (res.ok) {
      if (action === 'add') setAddInputs(p => ({ ...p, [id]: '' }))
      else setBookInputs(p => ({ ...p, [id]: '' }))
      load()
      showMsg(action === 'add' ? 'เพิ่มสต็อคสำเร็จ' : 'บันทึกจองสำเร็จ')
    }
  }

  // ── Save info edits ──────────────────────────────────────────────────────────

  const handleSaveInfo = async (id: number) => {
    const edits = rowEdits[id]
    if (!edits || Object.keys(edits).length === 0) return
    const item = items.find(it => it.id === id)
    if (item) {
      const newModel = edits.model_name ?? item.model_name
      const newColor = edits.color_name ?? item.color_name
      if (isDuplicate(String(newModel), String(newColor), id)) {
        showMsg('❌ ชื่อรุ่น + ชื่อสี ซ้ำกับที่มีอยู่แล้ว')
        return
      }
    }
    setBusy(b => ({ ...b, [`info-${id}`]: true }))
    const payload: Record<string, unknown> = { id }
    for (const [k, v] of Object.entries(edits)) {
      payload[k] = (k === 'warehouse_price' || k === 'retail_price') ? parseFloat(String(v)) || 0 : v
    }
    const res = await fetch('/api/stock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setBusy(b => ({ ...b, [`info-${id}`]: false }))
    if (res.ok) {
      setRowEdits(p => { const n = { ...p }; delete n[id]; return n })
      load()
      showMsg('บันทึกสำเร็จ')
    }
  }

  // ── Toggle show_in_booking ───────────────────────────────────────────────────

  const handleToggleBooking = useCallback(async (id: number, newVal: boolean) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, show_in_booking: newVal } : it))
    await fetch('/api/stock', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, show_in_booking: newVal }),
    })
  }, [])

  const setEdit = (id: number, key: string, val: string) => {
    setRowEdits(p => ({ ...p, [id]: { ...p[id], [key]: val } }))
  }

  const editVal = (item: StockItem, key: keyof StockItem) =>
    rowEdits[item.id]?.[key] !== undefined ? String(rowEdits[item.id][key]) : String(item[key])

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`ลบ "${name}" ใช่หรือไม่?`)) return
    await fetch('/api/stock', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const inputCls = (pending: boolean) =>
    `w-full px-1.5 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-green-400 ${pending ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-green-200 hover:text-white text-sm transition-colors">
            ← กลับหน้าหลัก
          </Link>
          <div>
            <h1 className="text-xl font-bold">สต็อคกระดาษฝอย</h1>
            <p className="text-green-200 text-xs mt-0.5">จัดการสต็อคและราคาสินค้า</p>
          </div>
        </div>
        {msg && (
          <span className={`text-sm px-3 py-1 rounded-full text-white ${msg.startsWith('❌') ? 'bg-red-500' : 'bg-green-500'}`}>{msg}</span>
        )}
        <Link href="/booking-foy"
          className="ml-auto px-4 py-1.5 text-sm rounded bg-yellow-400 hover:bg-yellow-300 text-green-900 font-semibold transition-colors">
          📋 ใบจองกระดาษฝอย
        </Link>
      </header>

      {/* Main */}
      <main className="p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลด...</div>
        ) : (
          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 96px)' }}>
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-20">
                <tr className="bg-green-700 text-white text-left">
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap min-w-[180px]">ชื่อรุ่น ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">รหัสสี ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">ชื่อสี ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">สต็อคล่าสุด</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">เพิ่มเข้าสต็อค</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">จำนวนจอง</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-right">ราคาโกดัง ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-right">ราคาลูกค้า ✎</th>
                  <th className="px-3 py-2 border-r border-yellow-400 whitespace-nowrap text-right bg-yellow-500 text-gray-900">ราคา+9%</th>
                  <th className="px-3 py-2 border-r border-red-500 whitespace-nowrap text-right bg-red-600">ราคา+9%+7%</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">ใบจองฝอย</th>
                  <th className="px-3 py-2 whitespace-nowrap text-center">จัดการ</th>
                </tr>

                {/* ── Add new row (sticky) ── */}
                {(() => {
                  const addDup = !!(newRow.model_name && isDuplicate(newRow.model_name, newRow.color_name))
                  return (
                    <tr className="bg-blue-50 border-b-2 border-blue-300">
                      <td className="px-2 py-1.5 border-r border-gray-200 min-w-[180px]">
                        <select value={newRow.model_name}
                          onChange={e => setNewRow(p => ({ ...p, model_name: e.target.value }))}
                          className="w-full px-1.5 py-1 text-xs rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="">-- เลือกรุ่น --</option>
                          {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" placeholder="รหัสสี" value={newRow.color_code}
                          onChange={e => setNewRow(p => ({ ...p, color_code: e.target.value }))}
                          className="w-full px-1.5 py-1 text-xs rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" placeholder="ชื่อสี" value={newRow.color_name}
                          onChange={e => setNewRow(p => ({ ...p, color_name: e.target.value }))}
                          className={`w-full px-1.5 py-1 text-xs rounded border focus:outline-none focus:ring-1 ${addDup ? 'border-red-400 bg-red-50 text-red-600 focus:ring-red-400' : 'border-blue-300 bg-white focus:ring-blue-400'}`} />
                        {addDup && <div className="text-[10px] text-red-600 mt-0.5 font-semibold">ชื่อนี้ซ้ำกับที่มีอยู่แล้ว</div>}
                      </td>
                      <td className="border-r border-gray-200" />
                      <td className="border-r border-gray-200" />
                      <td className="border-r border-gray-200" />
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" inputMode="numeric" placeholder="ราคาโกดัง" value={newRow.warehouse_price}
                          onChange={e => setNewRow(p => ({ ...p, warehouse_price: e.target.value }))}
                          className="w-full px-1.5 py-1 text-xs rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-right" />
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" inputMode="numeric" placeholder="ราคาลูกค้า" value={newRow.retail_price}
                          onChange={e => setNewRow(p => ({ ...p, retail_price: e.target.value }))}
                          className="w-full px-1.5 py-1 text-xs rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-right" />
                      </td>
                      {/* ราคา+9%, ราคา+9%+7%, ใบจอง — empty in add row */}
                      <td className="border-r border-gray-200 bg-yellow-50" />
                      <td className="border-r border-gray-200 bg-red-50" />
                      <td className="border-r border-gray-200" />
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={handleAddRow} disabled={!!busy.new || addDup}
                          className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 whitespace-nowrap">
                          + เพิ่มรุ่น
                        </button>
                      </td>
                    </tr>
                  )
                })()}
              </thead>
              <tbody>

                {/* ── Data rows ── */}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-10 text-gray-400">ยังไม่มีข้อมูล กรอกแถวด้านบนเพื่อเพิ่มรุ่น</td>
                  </tr>
                ) : items.map((item, i) => {
                  const isFirstOfModel = i === 0 || items[i - 1].model_name !== item.model_name
                  const hasPending = !!rowEdits[item.id] && Object.keys(rowEdits[item.id]!).length > 0
                  const stock      = parseFloat(item.stock_qty)
                  const editModel  = String(rowEdits[item.id]?.model_name ?? item.model_name)
                  const editColor  = String(rowEdits[item.id]?.color_name ?? item.color_name)
                  const editDup    = hasPending && isDuplicate(editModel, editColor, item.id)

                  const wPrice   = parseFloat(item.warehouse_price) || 0
                  const price9   = wPrice > 0 ? wPrice * 1.09 : null
                  const price9p7 = wPrice > 0 ? wPrice * 1.09 * 1.07 : null

                  return (
                    <Fragment key={item.id}>
                    {isFirstOfModel && (
                      <tr className="bg-green-800 text-white">
                        <td colSpan={12} className="px-3 py-1 text-[11px] font-bold tracking-wide">
                          {item.model_name}
                        </td>
                      </tr>
                    )}
                    <tr className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>

                      {/* 1. ชื่อรุ่น */}
                      <td className="px-2 py-1.5 border-r border-gray-200 min-w-[180px]">
                        <select value={editVal(item, 'model_name')}
                          onChange={e => setEdit(item.id, 'model_name', e.target.value)}
                          className={inputCls(!!rowEdits[item.id]?.model_name)}>
                          {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>

                      {/* 2. รหัสสี */}
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" value={editVal(item, 'color_code')}
                          onChange={e => setEdit(item.id, 'color_code', e.target.value)}
                          className={inputCls(!!rowEdits[item.id]?.color_code)} />
                      </td>

                      {/* 3. ชื่อสี */}
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" value={editVal(item, 'color_name')}
                          onChange={e => setEdit(item.id, 'color_name', e.target.value)}
                          className={editDup ? 'w-full px-1.5 py-1 text-xs rounded border border-red-400 bg-red-50 text-red-600 focus:outline-none focus:ring-1 focus:ring-red-400' : inputCls(!!rowEdits[item.id]?.color_name)} />
                        {editDup && <div className="text-[10px] text-red-600 mt-0.5 font-semibold">ชื่อนี้ซ้ำกับที่มีอยู่แล้ว</div>}
                      </td>

                      {/* 4. สต็อคล่าสุด */}
                      <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                        <div className={`text-base font-bold ${stock < 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {fmtQty(item.stock_qty)}
                        </div>
                        <div className="text-[10px] text-gray-400">หน่วย</div>
                      </td>

                      {/* 5. เพิ่มเข้าสต็อค */}
                      <td className="px-2 py-1.5 border-r border-gray-200 min-w-[160px]">
                        <div className="text-[10px] text-gray-500 mb-1">
                          ล่าสุด: <span className="font-semibold text-green-700">{fmtQty(item.last_added_qty)}</span>
                          <span className="ml-1 text-gray-400">({fmtDate(item.last_added_at)})</span>
                        </div>
                        <div className="flex gap-1">
                          <input type="text" inputMode="numeric" placeholder="จำนวน"
                            value={addInputs[item.id] ?? ''}
                            onChange={e => setAddInputs(p => ({ ...p, [item.id]: e.target.value }))}
                            className="w-16 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-green-400 text-right" />
                          <button onClick={() => handleStock(item.id, 'add')}
                            disabled={!!busy[`add-${item.id}`]}
                            className="px-2 py-1 text-xs rounded bg-green-100 hover:bg-green-200 text-green-800 border border-green-300 transition-colors disabled:opacity-50 whitespace-nowrap">
                            + เพิ่ม
                          </button>
                          <Link href={`/stock-history?id=${item.id}&type=add&name=${encodeURIComponent(item.model_name + ' ' + item.color_name)}`}
                            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 transition-colors whitespace-nowrap">
                            ประวัติ
                          </Link>
                        </div>
                      </td>

                      {/* 6. จำนวนจอง */}
                      <td className="px-2 py-1.5 border-r border-gray-200 min-w-[160px]">
                        <div className="text-[10px] text-gray-500 mb-1">
                          ล่าสุด: <span className="font-semibold text-orange-700">{fmtQty(item.last_booked_qty)}</span>
                          <span className="ml-1 text-gray-400">({fmtDate(item.last_booked_at)})</span>
                        </div>
                        <div className="flex gap-1">
                          <input type="text" inputMode="numeric" placeholder="จำนวน"
                            value={bookInputs[item.id] ?? ''}
                            onChange={e => setBookInputs(p => ({ ...p, [item.id]: e.target.value }))}
                            className="w-16 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 text-right" />
                          <button onClick={() => handleStock(item.id, 'book')}
                            disabled={!!busy[`book-${item.id}`]}
                            className="px-2 py-1 text-xs rounded bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 transition-colors disabled:opacity-50 whitespace-nowrap">
                            − จอง
                          </button>
                          <Link href={`/stock-history?id=${item.id}&type=book&name=${encodeURIComponent(item.model_name + ' ' + item.color_name)}`}
                            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 transition-colors whitespace-nowrap">
                            ประวัติ
                          </Link>
                        </div>
                      </td>

                      {/* 7. ราคาโกดัง */}
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" inputMode="numeric"
                          value={editVal(item, 'warehouse_price')}
                          onChange={e => setEdit(item.id, 'warehouse_price', e.target.value)}
                          className={`${inputCls(!!rowEdits[item.id]?.warehouse_price)} text-right`} />
                      </td>

                      {/* 8. ราคาลูกค้า */}
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" inputMode="numeric"
                          value={editVal(item, 'retail_price')}
                          onChange={e => setEdit(item.id, 'retail_price', e.target.value)}
                          className={`${inputCls(!!rowEdits[item.id]?.retail_price)} text-right`} />
                      </td>

                      {/* 9. ราคา+9% */}
                      <td className="px-3 py-1.5 border-r border-yellow-200 bg-yellow-50 text-right text-gray-700 whitespace-nowrap font-medium">
                        {price9 !== null ? fmtMoney(price9) : '-'}
                      </td>

                      {/* 10. ราคา+9%+7% */}
                      <td className="px-3 py-1.5 border-r border-red-200 bg-red-50 text-right text-red-700 whitespace-nowrap font-medium">
                        <div>{price9p7 !== null ? fmtMoney(price9p7) : '-'}</div>
                        {hasPending && (
                          <button onClick={() => handleSaveInfo(item.id)}
                            disabled={!!busy[`info-${item.id}`] || editDup}
                            className={`mt-0.5 px-2 py-0.5 text-[10px] rounded font-semibold transition-colors disabled:opacity-50 whitespace-nowrap ${editDup ? 'bg-red-100 text-red-700 border border-red-300 cursor-not-allowed' : 'bg-yellow-400 hover:bg-yellow-300 text-green-900'}`}>
                            {editDup ? '⛔ ชื่อซ้ำ' : '💾 บันทึก'}
                          </button>
                        )}
                      </td>

                      {/* 11. ใบจองฝอย toggle */}
                      <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleBooking(item.id, !item.show_in_booking)}
                          className={`px-2 py-0.5 text-[11px] rounded-full font-semibold transition-colors ${item.show_in_booking ? 'bg-green-500 hover:bg-green-400 text-white' : 'bg-red-500 hover:bg-red-400 text-white'}`}>
                          {item.show_in_booking ? '● โชว์' : '● ซ่อน'}
                        </button>
                      </td>

                      {/* 12. จัดการ */}
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => handleDelete(item.id, item.model_name)}
                          className="px-2 py-1 text-xs rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors">
                          ลบ
                        </button>
                      </td>

                    </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
