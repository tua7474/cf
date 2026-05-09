'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingOrder {
  id: number
  order_no: string
  total_amount: string
  quantities: Record<string, number>
  status: string
  payment_status: string
  payment_date: string | null
  payment_bank: string | null
  pickup_status: string
  source_type: string | null
  vehicle_type: string | null
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: string | number): string {
  return parseFloat(String(n)).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    year:     '2-digit',
    month:    '2-digit',
    day:      '2-digit',
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'Asia/Bangkok',
  })
}

function fmtPayDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders]   = useState<BookingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState<string | null>(null)

  // Payment form state
  const [payingOrderNo, setPayingOrderNo] = useState<string | null>(null)
  const [payDate, setPayDate] = useState('')
  const [payBank, setPayBank] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/orders')
      .then(r => r.json())
      .then((data: BookingOrder[]) => { setOrders(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const patch = async (order_no: string, fields: Record<string, unknown>) => {
    const res = await fetch('/api/orders', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ order_no, ...fields }),
    })
    if (!res.ok) { setMsg('เกิดข้อผิดพลาด'); return }
    load()
  }

  const handlePickup = async (order: BookingOrder) => {
    if (!confirm(`ยืนยัน "ขึ้นของแล้ว" สำหรับใบจอง ${order.order_no}?`)) return
    await patch(order.order_no, { pickup_status: 'picked_up' })
  }

  const handlePayment = async (order_no: string) => {
    if (!payDate || !payBank.trim()) return
    await patch(order_no, {
      payment_status: 'paid',
      payment_date:   payDate,
      payment_bank:   payBank.trim(),
    })
    setPayingOrderNo(null)
    setPayDate('')
    setPayBank('')
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/booking2" className="text-green-200 hover:text-white text-sm transition-colors">
            ← กลับหน้าใบจองสินค้า
          </Link>
          <div>
            <h1 className="text-xl font-bold">บันทึกใบจอง</h1>
            <p className="text-green-200 text-xs mt-0.5">ประวัติรายการทั้งหมด</p>
          </div>
        </div>
        {msg && (
          <span className="text-sm px-3 py-1 rounded-full bg-red-500 text-white">{msg}</span>
        )}
      </header>

      {/* Main */}
      <main className="p-4 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลด...</div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">ยังไม่มีใบจอง</div>
        ) : (
          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-green-700 text-white text-left text-xs">
                  <th className="px-4 py-2 whitespace-nowrap border-r border-green-600">เลขที่ใบจอง</th>
                  <th className="px-4 py-2 whitespace-nowrap border-r border-green-600 text-right">ยอดเงินรวม (฿)</th>
                  <th className="px-4 py-2 whitespace-nowrap border-r border-green-600">วันเวลาอัพเดทล่าสุด</th>
                  <th className="px-4 py-2 whitespace-nowrap border-r border-green-600">สถานะใบจอง</th>
                  <th className="px-4 py-2 whitespace-nowrap border-r border-green-600">ขึ้นของ</th>
                  <th className="px-4 py-2 whitespace-nowrap">สถานะการชำระเงิน</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => {
                  const pickedUp = order.pickup_status === 'picked_up'
                  const paid     = order.payment_status === 'paid'
                  const isPaying = payingOrderNo === order.order_no

                  return (
                    <tr key={order.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>

                      {/* 1. เลขที่ใบจอง */}
                      <td className="px-4 py-3 border-r border-gray-200 font-mono font-bold text-green-800 text-base">
                        {order.order_no}
                      </td>

                      {/* 2. ยอดเงินรวม */}
                      <td className="px-4 py-3 border-r border-gray-200 text-right font-semibold">
                        {fmtMoney(order.total_amount)}
                      </td>

                      {/* 3. วันเวลาอัพเดท */}
                      <td className="px-4 py-3 border-r border-gray-200 text-gray-600 whitespace-nowrap text-xs">
                        {fmtDate(order.updated_at)}
                      </td>

                      {/* 4. สถานะใบจอง */}
                      <td className="px-4 py-3 border-r border-gray-200">
                        <div className="flex flex-col gap-2">
                          {/* แก้ไข — disabled after pickup */}
                          {pickedUp ? (
                            <span className="inline-block px-2 py-1 text-xs rounded border border-red-200 bg-red-50 text-red-400 cursor-not-allowed select-none w-fit">
                              ✎ แก้ไขไม่ได้
                            </span>
                          ) : (
                            <button
                              onClick={() => router.push(`/booking2?edit=${order.order_no}`)}
                              className="px-2 py-1 text-xs rounded bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-300 transition-colors w-fit"
                            >
                              ✎ แก้ไข
                            </button>
                          )}
                          {/* รถ */}
                          {order.vehicle_type && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${order.vehicle_type === 'จองรถ60000' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                              🚛 {order.vehicle_type === 'จองรถ60000' ? 'จองรถ 60,000' : 'รอพ่วง'}
                            </span>
                          )}
                          {/* เบิกของ */}
                          {order.source_type && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 w-fit">
                              📦 เบิกของ: {order.source_type}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. ขึ้นของ */}
                      <td className="px-4 py-3 border-r border-gray-200 text-center">
                        {pickedUp ? (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ✅ ขึ้นของแล้ว
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePickup(order)}
                            className="px-3 py-1 text-xs rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 transition-colors font-medium"
                          >
                            📦 ขึ้นของ
                          </button>
                        )}
                      </td>

                      {/* 6. สถานะการชำระเงิน */}
                      <td className="px-4 py-3">
                        {paid ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              ✅ ชำระแล้ว
                            </span>
                            {order.payment_date && (
                              <span className="text-[11px] text-gray-500">{fmtPayDate(order.payment_date)}</span>
                            )}
                            {order.payment_bank && (
                              <span className="text-[11px] text-gray-500">{order.payment_bank}</span>
                            )}
                          </div>
                        ) : isPaying ? (
                          /* ── Payment form ── */
                          <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <div className="text-[11px] text-gray-500 font-semibold">บันทึกการชำระเงิน</div>
                            <input
                              type="date"
                              value={payDate}
                              onChange={e => setPayDate(e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-400"
                            />
                            <input
                              type="text"
                              placeholder="ธนาคาร / ยอดเงิน"
                              value={payBank}
                              onChange={e => setPayBank(e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-green-400"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => handlePayment(order.order_no)}
                                disabled={!payDate || !payBank.trim()}
                                className="flex-1 px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-40"
                              >
                                ✓ ยืนยัน
                              </button>
                              <button
                                onClick={() => { setPayingOrderNo(null); setPayDate(''); setPayBank('') }}
                                className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 transition-colors"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPayingOrderNo(order.order_no)}
                            className="px-2 py-1 text-xs rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                          >
                            รอการชำระเงิน
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
