'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BranchPhone { id: number; phone: string; is_admin: boolean; line_user_id: string | null }
interface Branch { id: number; name: string; phones: BranchPhone[] }
interface BranchOrder {
  id: number; order_no: string; total_amount: string
  status: string; payment_status: string; created_at: string; updated_at: string
}
interface BranchSession {
  branch_id: number; branch_name: string; phone: string; is_admin: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: string | number | null) {
  if (n === null || n === undefined) return '0'
  const v = parseFloat(String(n))
  return isNaN(v) ? '0' : v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  })
}
function fmtDateShort(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('th-TH', {
    day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Bangkok',
  })
}

const MONTH_NAMES = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// ── Branch Row Component ──────────────────────────────────────────────────────

function BranchRow({
  branch, session, onManage,
}: {
  branch: Branch
  session: BranchSession | null
  onManage: (b: Branch) => void
}) {
  const [orders, setOrders] = useState<BranchOrder[]>([])
  const [monthOrders, setMonthOrders] = useState<BranchOrder[]>([])
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<Record<number, { pending: number; paid: number }>>({})
  const [showOtp, setShowOtp] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [payMsg, setPayMsg] = useState('')

  const thisMonth = new Date().getMonth() + 1
  const thisYear  = new Date().getFullYear()

  const loadOrders = useCallback(async () => {
    const r = await fetch(`/api/branches/orders?branch_id=${branch.id}`)
    const all: BranchOrder[] = await r.json()
    setOrders(all)

    // Build monthly summary
    const summary: Record<number, { pending: number; paid: number }> = {}
    for (let m = 1; m <= 12; m++) summary[m] = { pending: 0, paid: 0 }
    for (const o of all) {
      const m = new Date(o.created_at).getMonth() + 1
      if (o.payment_status === 'paid') summary[m].paid++
      else summary[m].pending++
    }
    setMonthlySummary(summary)
  }, [branch.id])

  useEffect(() => { loadOrders() }, [loadOrders])

  const pendingOrders = orders.filter(o => o.payment_status !== 'paid')
  const thisMonthPaid = monthlySummary[thisMonth]?.paid ?? 0
  const thisMonthPending = monthlySummary[thisMonth]?.pending ?? 0

  const handleMonthClick = async (month: number) => {
    if (selectedMonth === month) { setSelectedMonth(null); return }
    setSelectedMonth(month)
    const r = await fetch(`/api/branches/orders?branch_id=${branch.id}&year=${thisYear}&month=${month}`)
    setMonthOrders(await r.json())
  }

  const handleSendOtp = async () => {
    setOtpError('')
    const res = await fetch('/api/branches/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', phone: session?.phone }),
    })
    const data = await res.json()
    if (data.ok) {
      setOtpSent(true)
    } else if (data.error === 'line_not_linked') {
      setOtpError('ยังไม่ได้เชื่อม LINE กรุณาส่ง "ลงทะเบียน [เบอร์]" ใน LINE Bot ก่อนครับ')
    } else {
      setOtpError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  const handleVerifyOtp = async () => {
    setOtpError('')
    const res = await fetch('/api/branches/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', phone: session?.phone, code: otpCode }),
    })
    const { valid } = await res.json()
    if (!valid) { setOtpError('รหัส OTP ไม่ถูกต้องหรือหมดอายุแล้ว'); return }

    // Mark pending orders as paid
    const ids = pendingOrders.map(o => o.id)
    await fetch('/api/branches/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_id: branch.id, order_ids: ids, action: 'pay' }),
    })
    setShowOtp(false)
    setOtpCode('')
    setOtpSent(false)
    setPayMsg('บันทึกชำระเงินสำเร็จ')
    setTimeout(() => setPayMsg(''), 3000)
    loadOrders()
  }

  return (
    <tr className="bg-white even:bg-gray-50 align-top border-b border-gray-200">

      {/* 1. ชื่อสาขา */}
      <td className="px-3 py-2 border-r border-gray-200 font-semibold text-green-800 whitespace-nowrap">
        <div>{branch.name}</div>
        {session?.is_admin && (
          <button onClick={() => onManage(branch)}
            className="mt-1 text-[10px] text-gray-400 hover:text-green-600 underline">
            จัดการ
          </button>
        )}
      </td>

      {/* 2. เบอร์โทร */}
      <td className="px-3 py-2 border-r border-gray-200">
        {branch.phones.map(p => (
          <div key={p.id} className="text-xs whitespace-nowrap">
            {p.phone}
            {p.is_admin && <span className="ml-1 text-[10px] text-orange-500">(admin)</span>}
          </div>
        ))}
      </td>

      {/* 3. ใบจองรอชำระ */}
      <td className="px-3 py-2 border-r border-gray-200 min-w-[180px]">
        {pendingOrders.length === 0 ? (
          <span className="text-xs text-gray-400">ไม่มีรายการค้าง</span>
        ) : pendingOrders.map(o => (
          <div key={o.id} className="text-xs mb-1 pb-1 border-b border-gray-100 last:border-0">
            <div className="font-medium text-gray-700">#{o.order_no}</div>
            <div className="text-gray-500">
              จำนวน 1 ใบ · ฿{fmtMoney(o.total_amount)}
            </div>
            <div className="text-[10px] text-gray-400">{fmtDate(o.created_at)}</div>
          </div>
        ))}
      </td>

      {/* 4. สถานะ + ชำระเงิน */}
      <td className="px-3 py-2 border-r border-gray-200 min-w-[130px]">
        {pendingOrders.length > 0 ? (
          <div>
            <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium mb-1">
              รอชำระเงิน
            </span>
            {payMsg && <div className="text-xs text-green-600">{payMsg}</div>}
            {session?.is_admin && !showOtp && (
              <button onClick={() => { setShowOtp(true); setOtpSent(false); setOtpCode(''); setOtpError('') }}
                className="block text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white mt-1 whitespace-nowrap">
                ✓ ชำระเงินแล้ว
              </button>
            )}
            {session?.is_admin && showOtp && (
              <div className="mt-1 space-y-1">
                {!otpSent ? (
                  <button onClick={handleSendOtp}
                    className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">
                    ส่ง OTP ทาง LINE
                  </button>
                ) : (
                  <div className="space-y-1">
                    <input value={otpCode} onChange={e => setOtpCode(e.target.value)}
                      placeholder="รหัส OTP 6 หลัก"
                      className="w-28 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-400" />
                    <div className="flex gap-1">
                      <button onClick={handleVerifyOtp}
                        className="text-xs px-2 py-1 rounded bg-green-600 hover:bg-green-700 text-white">
                        ยืนยัน
                      </button>
                      <button onClick={() => setShowOtp(false)}
                        className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
                {otpError && <div className="text-[10px] text-red-500">{otpError}</div>}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-green-600">ชำระครบแล้ว</span>
        )}
      </td>

      {/* 5. สรุปเดือนนี้ */}
      <td className="px-3 py-2 border-r border-gray-200 text-center">
        <div className="text-xs text-gray-500 mb-0.5">{MONTH_NAMES[thisMonth - 1]}</div>
        <div className="text-sm font-bold text-orange-600">{thisMonthPending}</div>
        <div className="text-xs text-gray-400">/ {thisMonthPaid} ชำระแล้ว</div>
      </td>

      {/* 6. ปุ่มเดือน 1-12 */}
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
            const s = monthlySummary[m] ?? { pending: 0, paid: 0 }
            const isSelected = selectedMonth === m
            return (
              <button key={m} onClick={() => handleMonthClick(m)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  isSelected
                    ? 'bg-green-700 text-white border-green-700'
                    : s.pending > 0
                    ? 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}>
                {m}
                {(s.pending > 0 || s.paid > 0) && (
                  <span className="ml-0.5">{s.pending}/{s.paid}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Month detail */}
        {selectedMonth !== null && (
          <div className="mt-2 border border-gray-200 rounded p-2 bg-white text-xs max-w-[280px]">
            <div className="font-semibold text-gray-600 mb-1">{MONTH_NAMES[selectedMonth - 1]} {thisYear}</div>
            {monthOrders.length === 0 ? (
              <div className="text-gray-400">ไม่มีรายการ</div>
            ) : monthOrders.map(o => (
              <div key={o.id} className={`flex justify-between items-start py-1 border-b border-gray-100 last:border-0 ${o.payment_status === 'paid' ? 'text-green-700' : 'text-gray-700'}`}>
                <div>
                  <span className="font-medium">#{o.order_no}</span>
                  <span className="ml-1 text-[10px] text-gray-400">{o.payment_status === 'paid' ? '✓ชำระ' : 'รอชำระ'}</span>
                </div>
                <div className="text-right ml-2">
                  <div>฿{fmtMoney(o.total_amount)}</div>
                  <div className="text-[10px] text-gray-400">
                    จอง {fmtDateShort(o.created_at)}
                    {o.payment_status === 'paid' && (
                      <span className="block text-green-500">ชำระ {fmtDateShort(o.updated_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </td>

    </tr>
  )
}

// ── Manage Branch Modal ───────────────────────────────────────────────────────

function ManageModal({ branch, onClose, onSaved }: { branch: Branch; onClose: () => void; onSaved: () => void }) {
  const [newPhone, setNewPhone] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)

  const addPhone = async () => {
    const p = newPhone.replace(/\D/g, '')
    if (!p) return
    setSaving(true)
    await fetch('/api/branches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_phone', branch_id: branch.id, phone: p, is_admin: isAdmin }),
    })
    setNewPhone(''); setIsAdmin(false); setSaving(false)
    onSaved()
  }

  const removePhone = async (phone_id: number) => {
    await fetch('/api/branches', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_phone', phone_id }),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-sm">
        <h3 className="text-base font-bold text-green-800 mb-3">จัดการสาขา: {branch.name}</h3>

        {/* Phone list */}
        <div className="mb-3">
          <div className="text-xs text-gray-500 mb-1">เบอร์โทรที่ลงทะเบียน</div>
          {branch.phones.length === 0 && <div className="text-xs text-gray-400">ยังไม่มีเบอร์</div>}
          {branch.phones.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1 border-b border-gray-100">
              <div className="text-sm">
                {p.phone}
                {p.is_admin && <span className="ml-1 text-[10px] text-orange-500 font-medium">(admin)</span>}
                {p.line_user_id && <span className="ml-1 text-[10px] text-green-500">✓LINE</span>}
              </div>
              <button onClick={() => removePhone(p.id)}
                className="text-xs text-red-400 hover:text-red-600">ลบ</button>
            </div>
          ))}
        </div>

        {/* Add phone */}
        <div className="space-y-2">
          <div className="text-xs text-gray-500">เพิ่มเบอร์โทร</div>
          <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
            placeholder="0812345678" type="text" inputMode="numeric"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-400" />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)}
              className="rounded" />
            เป็น Admin (กดชำระเงินได้)
          </label>
          <button onClick={addPhone} disabled={saving}
            className="w-full py-1.5 text-sm rounded bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50">
            + เพิ่มเบอร์
          </button>
        </div>

        <button onClick={onClose}
          className="mt-3 w-full py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200 text-gray-700">
          ปิด
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BranchesPage() {
  const [session, setSession]         = useState<BranchSession | null>(null)
  const [loginPhone, setLoginPhone]   = useState('')
  const [loginError, setLoginError]   = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [branches, setBranches]       = useState<Branch[]>([])
  const [loading, setLoading]         = useState(true)
  const [manageBranch, setManageBranch] = useState<Branch | null>(null)
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  // Load session from localStorage
  useEffect(() => {
    try {
      const s = localStorage.getItem('branch_session')
      if (s) setSession(JSON.parse(s))
    } catch { /* ignore */ }
  }, [])

  const loadBranches = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/branches')
    setBranches(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadBranches() }, [loadBranches])

  const handleLogin = async () => {
    setLoginError('')
    setLoginLoading(true)
    const clean = loginPhone.replace(/\D/g, '')
    const res = await fetch('/api/branches/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: clean }),
    })
    setLoginLoading(false)
    if (!res.ok) { setLoginError('ไม่พบเบอร์โทรนี้ในระบบ กรุณาติดต่อผู้ดูแล'); return }
    const data = await res.json()
    const s: BranchSession = { branch_id: data.branch_id, branch_name: data.branch_name, phone: clean, is_admin: data.is_admin }
    localStorage.setItem('branch_session', JSON.stringify(s))
    setSession(s)
  }

  const handleLogout = () => {
    localStorage.removeItem('branch_session')
    setSession(null)
    setLoginPhone('')
  }

  const handleAddBranch = async () => {
    if (!newBranchName.trim()) return
    await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBranchName.trim() }),
    })
    setNewBranchName(''); setShowAddBranch(false)
    loadBranches()
  }

  // Filter branches: non-admin sees only their branch
  const visibleBranches = session?.is_admin
    ? branches
    : branches.filter(b => b.id === session?.branch_id)

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header */}
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-green-200 hover:text-white text-sm transition-colors">← กลับ</Link>
          <div>
            <h1 className="text-xl font-bold">สาขาและตัวแทน</h1>
            {session && <p className="text-green-200 text-xs mt-0.5">เข้าสู่ระบบ: {session.branch_name} · {session.phone}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session?.is_admin && (
            <button onClick={() => setShowAddBranch(true)}
              className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-colors">
              + เพิ่มสาขา
            </button>
          )}
          {session ? (
            <button onClick={handleLogout}
              className="px-3 py-1.5 text-sm rounded bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-colors">
              ออกจากระบบ
            </button>
          ) : (
            <span className="text-green-200 text-sm">กรุณาล็อกอิน</span>
          )}
        </div>
      </header>

      {/* Login Modal */}
      {!session && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xs">
            <h2 className="text-lg font-bold text-green-800 mb-1">เข้าสู่ระบบสาขา</h2>
            <p className="text-xs text-gray-500 mb-4">กรอกเบอร์โทรที่ลงทะเบียนไว้</p>
            <input value={loginPhone} onChange={e => setLoginPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="0812345678" type="text" inputMode="numeric"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 mb-2" />
            {loginError && <p className="text-xs text-red-500 mb-2">{loginError}</p>}
            <button onClick={handleLogin} disabled={loginLoading}
              className="w-full py-2 rounded-lg bg-green-700 hover:bg-green-800 text-white font-semibold disabled:opacity-50">
              {loginLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-xs">
            <h3 className="text-base font-bold text-green-800 mb-3">เพิ่มสาขาใหม่</h3>
            <input value={newBranchName} onChange={e => setNewBranchName(e.target.value)}
              placeholder="ชื่อสาขา" className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-400 mb-3" />
            <div className="flex gap-2">
              <button onClick={handleAddBranch}
                className="flex-1 py-1.5 text-sm rounded bg-green-600 hover:bg-green-700 text-white font-medium">
                เพิ่ม
              </button>
              <button onClick={() => { setShowAddBranch(false); setNewBranchName('') }}
                className="flex-1 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200 text-gray-700">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Branch Modal */}
      {manageBranch && (
        <ManageModal
          branch={manageBranch}
          onClose={() => setManageBranch(null)}
          onSaved={() => { loadBranches(); setManageBranch(null) }}
        />
      )}

      {/* Main Table */}
      <main className="p-4 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กำลังโหลด...</div>
        ) : !session ? (
          <div className="flex items-center justify-center h-40 text-gray-400">กรุณาล็อกอินก่อนครับ</div>
        ) : visibleBranches.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">ยังไม่มีสาขา</div>
        ) : (
          <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-green-700 text-white text-left">
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">ชื่อสาขา</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">เบอร์โทร</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">ใบจองรอชำระ</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap">สถานะ</th>
                  <th className="px-3 py-2 border-r border-green-600 whitespace-nowrap text-center">เดือนนี้</th>
                  <th className="px-3 py-2 whitespace-nowrap">ประวัติรายเดือน</th>
                </tr>
              </thead>
              <tbody>
                {visibleBranches.map(b => (
                  <BranchRow key={b.id} branch={b} session={session}
                    onManage={setManageBranch} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
