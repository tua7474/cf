import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!

async function pushLine(lineUserId: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_TOKEN}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text }] }),
  })
}

// POST { action: 'send', phone } → send OTP via LINE
// POST { action: 'verify', phone, code } → verify OTP
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ── SEND OTP ──────────────────────────────────────────────────────────────
    if (body.action === 'send') {
      const clean = String(body.phone ?? '').replace(/\D/g, '')
      if (!clean) return NextResponse.json({ error: 'phone required' }, { status: 400 })

      // Check phone is registered as admin
      const { rows: ph } = await pool.query(
        `SELECT bp.line_user_id FROM branch_phones bp
         WHERE bp.phone=$1 AND bp.is_admin=true`, [clean]
      )
      if (!ph[0]) return NextResponse.json({ error: 'not_admin' }, { status: 403 })

      // Invalidate old OTPs
      await pool.query(`UPDATE branch_otps SET used=true WHERE phone=$1 AND used=false`, [clean])

      // Generate 6-digit OTP
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const expires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      await pool.query(
        `INSERT INTO branch_otps (phone, code, expires_at) VALUES ($1,$2,$3)`,
        [clean, code, expires]
      )

      const lineUserId = ph[0].line_user_id
      if (lineUserId) {
        await pushLine(lineUserId, `🔐 รหัส OTP สำหรับยืนยันชำระเงิน:\n\n${code}\n\nรหัสนี้ใช้ได้ 5 นาที อย่าแจ้งรหัสนี้แก่ผู้อื่น`)
        return NextResponse.json({ ok: true, sent_via: 'line' })
      } else {
        // LINE not linked yet — tell admin to register
        return NextResponse.json({ ok: false, error: 'line_not_linked' })
      }
    }

    // ── VERIFY OTP ────────────────────────────────────────────────────────────
    if (body.action === 'verify') {
      const clean = String(body.phone ?? '').replace(/\D/g, '')
      const code  = String(body.code ?? '').trim()
      if (!clean || !code) return NextResponse.json({ error: 'phone and code required' }, { status: 400 })

      const { rows } = await pool.query(
        `SELECT id FROM branch_otps
         WHERE phone=$1 AND code=$2 AND used=false AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [clean, code]
      )
      if (!rows[0]) return NextResponse.json({ valid: false })

      await pool.query(`UPDATE branch_otps SET used=true WHERE id=$1`, [rows[0].id])
      return NextResponse.json({ valid: true })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
