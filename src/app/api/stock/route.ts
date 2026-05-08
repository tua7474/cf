import { NextResponse } from 'next/server'
import pool from '@/lib/db'

// ── Sync paper_stock total → products_catalog.quantity ───────────────────────
// Sums stock_qty across all colors for a given model_name, then updates
// products_catalog where group_name='กระดาษฝอย' AND product_name=model_name

async function syncToCatalog(model_name: string) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(stock_qty), 0) AS total FROM paper_stock WHERE model_name = $1`,
    [model_name]
  )
  const total = rows[0].total
  await pool.query(
    `UPDATE products_catalog
     SET quantity = $1, updated_at = NOW()
     WHERE group_name = 'กระดาษฝอย' AND product_name = $2`,
    [total, model_name]
  )
}

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

// ── Migrate รุ่นสีพิเศษ A → paper_stock model '2 มิล พิเศษ A' ────────────────
// Runs once on first GET after deploy. Copies products from products_catalog
// (group_name='รุ่นสีพิเศษ A') into paper_stock as model_name='2 มิล พิเศษ A'.
// Also ensures '2 มิล พิเศษ A' exists in catalog group กระดาษฝอย (for dropdown).
// Does NOT delete from catalog — user will verify first.

async function migrateGroup(modelTarget: string, groupSource: string) {
  // Check if migration already done
  const { rows: existing } = await pool.query(
    `SELECT 1 FROM paper_stock WHERE model_name = $1 LIMIT 1`,
    [modelTarget]
  )
  if (existing.length > 0) return  // already migrated

  // Fetch source products from catalog
  const { rows: src } = await pool.query(
    `SELECT product_name, price FROM products_catalog WHERE group_name = $1 ORDER BY id`,
    [groupSource]
  )
  if (src.length === 0) return

  // Insert into paper_stock
  for (const p of src) {
    await pool.query(
      `INSERT INTO paper_stock (model_name, color_name, warehouse_price)
       VALUES ($1, $2, $3)`,
      [modelTarget, p.product_name, parseFloat(p.price ?? '0') || 0]
    )
  }

  // Ensure model name exists in catalog กระดาษฝอย group (for dropdown)
  const { rows: inCat } = await pool.query(
    `SELECT 1 FROM products_catalog WHERE group_name = 'กระดาษฝอย' AND product_name = $1 LIMIT 1`,
    [modelTarget]
  )
  if (inCat.length === 0) {
    await pool.query(
      `INSERT INTO products_catalog (group_name, product_name) VALUES ('กระดาษฝอย', $1)`,
      [modelTarget]
    )
  }
}

// ── GET — list all items ──────────────────────────────────────────────────────

export async function GET() {
  await pool.query(CREATE_TABLE)
  await migrateGroup('2 มิล พิเศษ A', 'รุ่นสีพิเศษ A')
  await migrateGroup('2 มิล พิเศษ B', 'รุ่นสีพิเศษ B')
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
    await syncToCatalog(rows[0].model_name)
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
    await syncToCatalog(rows[0].model_name)
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
  const { rows } = await pool.query('DELETE FROM paper_stock WHERE id = $1 RETURNING model_name', [id])
  if (rows[0]?.model_name) await syncToCatalog(rows[0].model_name)
  return NextResponse.json({ ok: true })
}
