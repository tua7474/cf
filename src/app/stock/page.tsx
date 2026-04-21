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
  last_added_qty: string
  last_added_at: string | null
  last_booked_qty: string
  last_booked_at: string | null
  warehouse_price: string
  retail_price: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtQty(n: string | number): string {
  const v = parseFloat(String(n))
  return isNaN(v) ? '0' : v.toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function fmtMoney(n: string | number): string {
  const v = parseFloat(String(n))
  return isNaN(v) ? '0.00' : v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [items, setItems]       = useState<StockItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [newRow, setNewRow]     = useState(EMPTY_NEW)
  const [addInputs, setAddInputs]   = useState<Record<number, string>>({})
  const [bookInputs, setBookInputs] = useState<Record<number, string>>({})
  const [rowEdits, setRowEdits] = useState<Record<number, Partial<StockItem>>>({})
  const [busy, setBusy]         = useState<Record<number | string, boolean>>({})
  const [msg, setMsg]           = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/stock')
      .then(r => r.json())
      .then((data: StockItem[]) => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const showMsg = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 2500)
  }

  // ── Add new row ──────────────────────────────────────────────────────────────

  const handleAddRow = async () => {
    if (!newRow.model_name.trim()) return
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

  // ── Save info edits ───────────────────────────────────────────────────────────

  const handleSaveInfo = async (id: number) => {
    const edits = rowEdits[id]
    if (!edits || Object.keys(edits).length === 0) return
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

  const setEdit = (id: number, key: string, val: string) => {
    setRowEdits(p => ({ ...p, [id]: { ...p[id], [key]: val } }))
  }

  const editVal = (item: StockItem, key: keyof StockItem) =>
    rowEdits[item.id]?.[key] !== undefined ? String(rowEdits[item.id][key]) : String(item[key])

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`ลบ "${name}" ใช่หรือไม่?`)) return
    await fetch('/api/stock', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <span className="text-sm px-3 py-1 rounded-full bg-green-500 text-white">{msg}</span>
        )}
      </header>

      {/* Main */}
      <main className="p-4 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลด...</div>
        ) : (
          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-green-700 text-white text-left">
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">ชื่อรุ่น ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">รหัสสี ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">ชื่อสี ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">สต็อคล่าสุด</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">เพิ่มเข้าสต็อค</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">จำนวนจอง</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-right">ราคาโกดัง ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-right">ราคาลูกค้า ✎</th>
                  <th className="px-3 py-2 whitespace-nowrap text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>

                {/* ── Add new row ── */}
                <tr className="bg-blue-50 border-b-2 border-blue-300">
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    <input type="text" placeholder="ชื่อรุ่น" value={newRow.model_name}
                      onChange={e => setNewRow(p => ({ ...p, model_name: e.target.value }))}
                      className="w-full px-1.5 py-1 text-xs rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    <input type="text" placeholder="รหัสสี" value={newRow.color_code}
                      onChange={e => setNewRow(p => ({ ...p, color_code: e.target.value }))}
                      className="w-full px-1.5 py-1 text-xs rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </td>
                  <td className="px-2 py-1.5 border-r border-gray-200">
                    <input type="text" placeholder="ชื่อสี" value={newRow.color_name}
                      onChange={e => setNewRow(p => ({ ...p, color_name: e.target.value }))}
                      className="w-full px-1.5 py-1 text-xs rounded border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
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
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={handleAddRow} disabled={!!busy.new}
                      className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50 whitespace-nowrap">
                      + เพิ่มรุ่น
                    </button>
                  </td>
                </tr>

                {/* ── Data rows ── */}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-400">ยังไม่มีข้อมูล กรอกแถวด้านบนเพื่อเพิ่มรุ่น</td>
                  </tr>
                ) : items.map((item, i) => {
                  const hasPending = !!rowEdits[item.id] && Object.keys(rowEdits[item.id]!).length > 0
                  const stock = parseFloat(item.stock_qty)

                  return (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>

                      {/* 1. ชื่อรุ่น */}
                      <td className="px-2 py-1.5 border-r border-gray-200">
                        <input type="text" value={editVal(item, 'model_name')}
                          onChange={e => setEdit(item.id, 'model_name', e.target.value)}
                          className={inputCls(!!rowEdits[item.id]?.model_name)} />
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
                          className={inputCls(!!rowEdits[item.id]?.color_name)} />
                      </td>

                      {/* 4. สต็อคล่าสุด */}
                      <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                        <div className={`text-base font-bold ${stock < 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {fmtQty(item.stock_qty)}
                        </div>
                        <div className="text-[10px] text-gray-400">หน่วย</div>
                      </td>

                      {/* 5. เพิ่มเข้าสต็อค */}
                      <td className="px-2 py-1.5 border-r border-gray-200 min-w-[130px]">
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
                        </div>
                      </td>

                      {/* 6. จำนวนจอง */}
                      <td className="px-2 py-1.5 border-r border-gray-200 min-w-[130px]">
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

                      {/* Actions */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex flex-col gap-1">
                          {hasPending && (
                            <button onClick={() => handleSaveInfo(item.id)}
                              disabled={!!busy[`info-${item.id}`]}
                              className="px-2 py-1 text-xs rounded bg-yellow-400 hover:bg-yellow-300 text-green-900 font-semibold transition-colors disabled:opacity-50 whitespace-nowrap">
                              💾 บันทึก
                            </button>
                          )}
                          <button onClick={() => handleDelete(item.id, item.model_name)}
                            className="px-2 py-1 text-xs rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors">
                            ลบ
                          </button>
                        </div>
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
