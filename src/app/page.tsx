'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: number
  group_name: string
  product_name: string
  price: string | null
  quantity: string | null
  last_added_qty: string | null
  last_added_at: string | null
  last_booked_qty: string | null
  last_booked_at: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtQty(n: string | number | null): string {
  if (n === null || n === undefined || n === '') return '0'
  const v = parseFloat(String(n))
  return isNaN(v) ? '0' : v.toLocaleString('th-TH', { maximumFractionDigits: 2 })
}

function fmtMoney(n: string | number | null): string {
  if (n === null || n === undefined || n === '') return '-'
  const v = parseFloat(String(n))
  return isNaN(v) ? '-' : v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [addInputs, setAddInputs]   = useState<Record<number, string>>({})
  const [bookInputs, setBookInputs] = useState<Record<number, string>>({})
  const [rowEdits, setRowEdits] = useState<Record<number, { group_name?: string; product_name?: string; price?: string }>>({})
  const [busy, setBusy]   = useState<Record<string, boolean>>({})
  const [msg, setMsg]     = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/catalog')
      .then(r => r.json())
      .then((data: Product[]) => { setProducts(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const showMsg = (text: string) => {
    setMsg(text)
    setTimeout(() => setMsg(null), 2500)
  }

  // ── Stock operations ─────────────────────────────────────────────────────────

  const handleStock = async (id: number, action: 'add' | 'book') => {
    const raw = action === 'add' ? addInputs[id] : bookInputs[id]
    const qty = parseFloat(raw ?? '')
    if (!qty || qty <= 0) return
    setBusy(b => ({ ...b, [`${action}-${id}`]: true }))
    const res = await fetch('/api/catalog', {
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
      payload[k] = k === 'price' ? (parseFloat(String(v)) || null) : v
    }
    const res = await fetch('/api/catalog', {
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

  const setEdit = (id: number, key: string, val: string) =>
    setRowEdits(p => ({ ...p, [id]: { ...p[id], [key]: val } }))

  const editVal = (p: Product, key: 'group_name' | 'product_name' | 'price') =>
    rowEdits[p.id]?.[key] !== undefined ? String(rowEdits[p.id][key]) : String(p[key] ?? '')

  // ── Build grouped entries ─────────────────────────────────────────────────────

  type Entry = { type: 'group'; name: string } | { type: 'row'; product: Product }
  const entries: Entry[] = []
  let lastGroup = ''
  for (const p of products) {
    if (p.group_name !== lastGroup) {
      entries.push({ type: 'group', name: p.group_name })
      lastGroup = p.group_name
    }
    entries.push({ type: 'row', product: p })
  }

  // ── Input styles ─────────────────────────────────────────────────────────────

  const inputCls = (pending: boolean) =>
    `w-full px-1.5 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-green-400 ${pending ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">กระดาษฝอยไทย — ระบบจัดการข้อมูล</h1>
          <p className="text-green-200 text-xs mt-0.5">ข้อมูลจาก Railway PostgreSQL</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/catalog"
            className="px-4 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white font-medium transition-colors border border-white/30">
            🏷 แก้ไขสินค้า
          </Link>
          <Link href="/booking"
            className="px-4 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white font-medium transition-colors border border-white/30">
            📋 ใบจอง
          </Link>
          {msg && (
            <span className="text-sm px-3 py-1 rounded-full bg-green-500 text-white">{msg}</span>
          )}
        </div>
      </header>

      {/* Tab bar */}
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

      {/* Main */}
      <main className="p-4 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลดข้อมูล...</div>
        ) : (
          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-green-700 text-white text-left">
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">หมวดสินค้า ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">ชื่อสินค้า ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">สต็อคล่าสุด</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">เพิ่มสต็อค</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">จำนวนจอง</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-right">ราคาโกดัง ✎</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-right">ราคา+9%</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">ราคา+9%+7%</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, ei) => {
                  if (entry.type === 'group') {
                    return (
                      <tr key={`g-${ei}`} className="bg-green-800 text-white">
                        <td colSpan={8} className="px-3 py-1.5 font-bold text-sm tracking-wide">
                          {entry.name}
                        </td>
                      </tr>
                    )
                  }

                  const p = entry.product
                  const hasPending = !!rowEdits[p.id] && Object.keys(rowEdits[p.id]).length > 0
                  const stock = parseFloat(String(p.quantity ?? 0))
                  const price = parseFloat(String(p.price ?? 0))
                  const price9    = price > 0 ? price * 1.09 : null
                  const price9p7  = price > 0 ? price * 1.09 * 1.07 : null

                  return (
                    <tr key={p.id} className="bg-white even:bg-gray-50 hover:bg-yellow-50/40 transition-colors">

                      {/* 1. หมวดสินค้า */}
                      <td className="px-2 py-1 border-r border-gray-200">
                        <input type="text" value={editVal(p, 'group_name')}
                          onChange={e => setEdit(p.id, 'group_name', e.target.value)}
                          className={inputCls(!!rowEdits[p.id]?.group_name)} />
                      </td>

                      {/* 2. ชื่อสินค้า */}
                      <td className="px-2 py-1 border-r border-gray-200">
                        <input type="text" value={editVal(p, 'product_name')}
                          onChange={e => setEdit(p.id, 'product_name', e.target.value)}
                          className={inputCls(!!rowEdits[p.id]?.product_name)} />
                      </td>

                      {/* 3. สต็อคล่าสุด */}
                      <td className="px-3 py-1 border-r border-gray-200 text-center whitespace-nowrap">
                        <div className={`text-sm font-bold ${stock < 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {fmtQty(p.quantity)}
                        </div>
                      </td>

                      {/* 4. เพิ่มสต็อค */}
                      <td className="px-2 py-1 border-r border-gray-200 min-w-[130px]">
                        <div className="text-[10px] text-gray-400 mb-0.5">
                          ล่าสุด {fmtQty(p.last_added_qty)} · {fmtDate(p.last_added_at)}
                        </div>
                        <div className="flex gap-1">
                          <input type="text" inputMode="numeric" placeholder="จำนวน"
                            value={addInputs[p.id] ?? ''}
                            onChange={e => setAddInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-16 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-green-400 text-right" />
                          <button onClick={() => handleStock(p.id, 'add')}
                            disabled={!!busy[`add-${p.id}`]}
                            className="px-2 py-1 text-xs rounded bg-green-100 hover:bg-green-200 text-green-800 border border-green-300 transition-colors disabled:opacity-50 whitespace-nowrap">
                            + เพิ่ม
                          </button>
                          <Link href={`/history?id=${p.id}&type=add&name=${encodeURIComponent(p.product_name)}`}
                            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 transition-colors whitespace-nowrap">
                            ประวัติ
                          </Link>
                        </div>
                      </td>

                      {/* 5. จำนวนจอง */}
                      <td className="px-2 py-1 border-r border-gray-200 min-w-[130px]">
                        <div className="text-[10px] text-gray-400 mb-0.5">
                          ล่าสุด {fmtQty(p.last_booked_qty)} · {fmtDate(p.last_booked_at)}
                        </div>
                        <div className="flex gap-1">
                          <input type="text" inputMode="numeric" placeholder="จำนวน"
                            value={bookInputs[p.id] ?? ''}
                            onChange={e => setBookInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-16 px-1.5 py-1 text-xs rounded border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 text-right" />
                          <button onClick={() => handleStock(p.id, 'book')}
                            disabled={!!busy[`book-${p.id}`]}
                            className="px-2 py-1 text-xs rounded bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 transition-colors disabled:opacity-50 whitespace-nowrap">
                            − จอง
                          </button>
                          <Link href={`/history?id=${p.id}&type=book&name=${encodeURIComponent(p.product_name)}`}
                            className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 transition-colors whitespace-nowrap">
                            ประวัติ
                          </Link>
                        </div>
                      </td>

                      {/* 6. ราคาโกดัง */}
                      <td className="px-2 py-1 border-r border-gray-200">
                        <input type="text" inputMode="numeric" value={editVal(p, 'price')}
                          onChange={e => setEdit(p.id, 'price', e.target.value)}
                          className={`${inputCls(!!rowEdits[p.id]?.price)} text-right`} />
                      </td>

                      {/* 7. ราคา+9% */}
                      <td className="px-3 py-1 border-r border-gray-200 text-right text-gray-600 whitespace-nowrap">
                        {price9 !== null ? fmtMoney(price9) : '-'}
                      </td>

                      {/* 8. ราคา+9%+7% */}
                      <td className="px-3 py-1 text-right text-gray-600 whitespace-nowrap">
                        <div>{price9p7 !== null ? fmtMoney(price9p7) : '-'}</div>
                        {hasPending && (
                          <button onClick={() => handleSaveInfo(p.id)}
                            disabled={!!busy[`info-${p.id}`]}
                            className="mt-0.5 px-2 py-0.5 text-[10px] rounded bg-yellow-400 hover:bg-yellow-300 text-green-900 font-semibold transition-colors disabled:opacity-50 whitespace-nowrap">
                            💾 บันทึก
                          </button>
                        )}
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
