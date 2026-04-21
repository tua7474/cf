import { NextResponse } from 'next/server'
import pool from '@/lib/db'

// ── Table ─────────────────────────────────────────────────────────────────────

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS booking_orders (
    id             SERIAL PRIMARY KEY,
    order_no       VARCHAR(14) UNIQUE NOT NULL,
    total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
    quantities     JSONB        NOT NULL DEFAULT '{}',
    status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
    payment_status VARCHAR(20)  NOT NULL DEFAULT 'unpaid',
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
  )
`

// ── Generate order number (Thai time UTC+7) ────────────────────────────────────
// Format: YYMMDDHHmm (10 digits) — e.g. 2604211023

function genOrderNo(): string {
  const thai = new Date(Date.now() + 7 * 60 * 60 * 1000)
  const yy   = String(thai.getUTCFullYear()).slice(-2)
  const mo   = String(thai.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(thai.getUTCDate()).padStart(2, '0')
  const hh   = String(thai.getUTCHours()).padStart(2, '0')
  const mn   = String(thai.getUTCMinutes()).padStart(2, '0')
  return `${yy}${mo}${dd}${hh}${mn}`
}

// ── GET — list all orders (or single order by ?no=XXXX) ───────────────────────

export async function GET(request: Request) {
  await pool.query(CREATE_TABLE)
  const { searchParams } = new URL(request.url)
  const no = searchParams.get('no')

  if (no) {
    const { rows } = await pool.query(
      'SELECT * FROM booking_orders WHERE order_no = $1', [no]
    )
    return NextResponse.json(rows[0] ?? null)
  }

  const { rows } = await pool.query(
    'SELECT * FROM booking_orders ORDER BY created_at DESC'
  )
  return NextResponse.json(rows)
}

// ── POST — create new order ───────────────────────────────────────────────────

export async function POST(request: Request) {
  const { total_amount, quantities } = await request.json()
  await pool.query(CREATE_TABLE)

  let order_no = genOrderNo()

  try {
    const { rows } = await pool.query(
      `INSERT INTO booking_orders (order_no, total_amount, quantities)
       VALUES ($1, $2, $3) RETURNING *`,
      [order_no, total_amount, JSON.stringify(quantities)]
    )
    return NextResponse.json(rows[0], { status: 201 })
  } catch (e: unknown) {
    // Collision: same minute — append seconds
    if ((e as { code?: string }).code === '23505') {
      order_no = order_no + String(new Date().getUTCSeconds()).padStart(2, '0')
      const { rows } = await pool.query(
        `INSERT INTO booking_orders (order_no, total_amount, quantities)
         VALUES ($1, $2, $3) RETURNING *`,
        [order_no, total_amount, JSON.stringify(quantities)]
      )
      return NextResponse.json(rows[0], { status: 201 })
    }
    throw e
  }
}

// ── PATCH — update order (status / payment / quantities) ─────────────────────

export async function PATCH(request: Request) {
  const { order_no, status, payment_status, total_amount, quantities } = await request.json()

  const sets: string[] = ['updated_at = NOW()']
  const vals: unknown[] = []
  let i = 1

  if (status         !== undefined) { sets.push(`status = $${i++}`);         vals.push(status) }
  if (payment_status !== undefined) { sets.push(`payment_status = $${i++}`); vals.push(payment_status) }
  if (total_amount   !== undefined) { sets.push(`total_amount = $${i++}`);   vals.push(total_amount) }
  if (quantities     !== undefined) { sets.push(`quantities = $${i++}`);     vals.push(JSON.stringify(quantities)) }

  vals.push(order_no)
  const { rows } = await pool.query(
    `UPDATE booking_orders SET ${sets.join(', ')} WHERE order_no = $${i} RETURNING *`,
    vals
  )
  return NextResponse.json(rows[0])
}
