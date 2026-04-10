import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(`
    SELECT
      b.id,
      b.date,
      b.product_name,
      b.price,
      b.unit,
      b.actual_quantity,
      b.other_costs,
      ROUND(b.price * b.actual_quantity + COALESCE(b.other_costs, 0), 2) AS total_value,
      TO_CHAR(b.date, 'YYYY-MM') AS year_month,
      b.ordered_qty
    FROM transactions_buy b
    ORDER BY b.date DESC
  `)
  return NextResponse.json(rows)
}

export async function PATCH(request: Request) {
  const changes: { id: number; price: number }[] = await request.json()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const { id, price } of changes) {
      await client.query('UPDATE transactions_buy SET price = $1 WHERE id = $2', [price, id])
    }
    await client.query('COMMIT')
    return NextResponse.json({ ok: true, updated: changes.length })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}
