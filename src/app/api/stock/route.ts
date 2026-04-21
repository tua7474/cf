import { NextResponse } from 'next/server'
import pool from '@/lib/db'

// ── Table ─────────────────────────────────────────────────────────────────────

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS paper_stock (
    id               SERIAL PRIMARY KEY,
    model_name       VARCHAR(100) NOT NULL,
    color_code       VARCHAR(50)  NOT NULL DEFAULT '',
    color_name       VARCHAR(100) NOT NULL DEFAULT '',
    stock_qty        DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_added_qty   DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_added_at    TIMESTAMP,
    last_booked_qty  DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_booked_at   TIMESTAMP,
    warehouse_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
    retail_price     DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
  )
`

// ── GET — list all items ──────────────────────────────────────────────────────

export async function GET() {
  await pool.query(CREATE_TABLE)
  const { rows } = await pool.query(
    'SELECT * FROM paper_stock ORDER BY model_name, color_name'
  )
  return NextResponse.json(rows)
}

// ── POST — create new item ────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { model_name, color_code, color_name, warehouse_price, retail_price } = await request.json()
  await pool.query(CREATE_TABLE)
  const { rows } = await pool.query(
    `INSERT INTO paper_stock (model_name, color_code, color_name, warehouse_price, retail_price)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [model_name, color_code ?? '', color_name ?? '', warehouse_price ?? 0, retail_price ?? 0]
  )
  return NextResponse.json(rows[0], { status: 201 })
}

// ── PATCH — update info / add stock / book stock ──────────────────────────────
// action = 'add'  → stock_qty += qty, last_added_qty = qty, last_added_at = NOW()
// action = 'book' → stock_qty -= qty, last_booked_qty = qty, last_booked_at = NOW()
// no action       → update info fields (model_name, color_*, prices)

export async function PATCH(request: Request) {
  const body = await request.json()
  const { id, action, qty } = body

  if (action === 'add') {
    const { rows } = await pool.query(
      `UPDATE paper_stock
       SET stock_qty      = stock_qty + $1,
           last_added_qty = $1,
           last_added_at  = NOW()
       WHERE id = $2 RETURNING *`,
      [qty, id]
    )
    return NextResponse.json(rows[0])
  }

  if (action === 'book') {
    const { rows } = await pool.query(
      `UPDATE paper_stock
       SET stock_qty       = stock_qty - $1,
           last_booked_qty = $1,
           last_booked_at  = NOW()
       WHERE id = $2 RETURNING *`,
      [qty, id]
    )
    return NextResponse.json(rows[0])
  }

  // Update info fields
  const { model_name, color_code, color_name, warehouse_price, retail_price } = body
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1

  if (model_name       !== undefined) { sets.push(`model_name = $${i++}`);       vals.push(model_name) }
  if (color_code       !== undefined) { sets.push(`color_code = $${i++}`);       vals.push(color_code) }
  if (color_name       !== undefined) { sets.push(`color_name = $${i++}`);       vals.push(color_name) }
  if (warehouse_price  !== undefined) { sets.push(`warehouse_price = $${i++}`);  vals.push(warehouse_price) }
  if (retail_price     !== undefined) { sets.push(`retail_price = $${i++}`);     vals.push(retail_price) }

  if (sets.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  vals.push(id)
  const { rows } = await pool.query(
    `UPDATE paper_stock SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  )
  return NextResponse.json(rows[0])
}

// ── DELETE — remove item ──────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  const { id } = await request.json()
  await pool.query('DELETE FROM paper_stock WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
