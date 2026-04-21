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
  created_at: string
  updated_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอดำเนินการ',
  queue:   'จองคิวรถแล้ว',
  waiting: 'รอพ่วง',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  queue:   'bg-blue-100 text-blue-800',
  waiting: 'bg-orange-100 text-orange-800',
}

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders]   = useState<BookingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState<string | null>(null)

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

  const handleQueue = async (order: BookingOrder) => {
    const total = parseFloat(String(order.total_amount))
    if (total < 50000) {
      alert(`กรุณาเพิ่มยอดให้ครบ 50,000 บาท เพื่อจองคิวรถ\n(ยอดปัจจุบัน ${fmtMoney(total)} บาท)`)
      return
    }
    await patch(order.order_no, { status: 'queue' })
  }

  const handleWaiting = async (order: BookingOrder) => {
    await patch(order.order_no, { status: 'waiting' })
  }

  const handlePaid = async (order: BookingOrder) => {
    if (!confirm(`ยืนยันการชำระเงิน ใบจอง ${order.order_no} ใช่หรือไม่?`)) return
    await patch(order.order_no, { payment_status: 'paid' })
  }

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/booking" className="text-green-200 hover:text-white text-sm transition-colors">
            ← กลับหน้าใบจอง
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
                  <th className="px-4 py-2 whitespace-nowrap border-r border-green-600">สถานะ</th>
                  <th className="px-4 py-2 whitespace-nowrap">สถานะการชำระเงิน</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => (
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

                    {/* 4. สถานะ + ปุ่มดำเนินการ */}
                    <td className="px-4 py-3 border-r border-gray-200">
                      <div className="flex flex-col gap-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => router.push(`/booking?order=${order.order_no}`)}
                            className="px-2 py-1 text-xs rounded bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-300 transition-colors"
                          >
                            ✎ แก้ไข
                          </button>
                          <button
                            onClick={() => handleQueue(order)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${order.status === 'queue' ? 'bg-blue-200 text-blue-900 border-blue-400 font-semibold' : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'}`}
                          >
                            🚛 จองคิวรถ
                          </button>
                          <button
                            onClick={() => handleWaiting(order)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${order.status === 'waiting' ? 'bg-orange-200 text-orange-900 border-orange-400 font-semibold' : 'bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-300'}`}
                          >
                            ⏳ รอพ่วง
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* 5. สถานะการชำระเงิน */}
                    <td className="px-4 py-3">
                      {order.payment_status === 'paid' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          ✅ ชำระแล้ว
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                            รอการชำระเงิน
                          </span>
                          <button
                            onClick={() => handlePaid(order)}
                            className="px-2 py-1 text-xs rounded bg-green-50 hover:bg-green-100 text-green-800 border border-green-300 transition-colors"
                          >
                            ✓ ชำระแล้ว
                          </button>
                        </div>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
