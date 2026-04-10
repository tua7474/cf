import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(`
    SELECT product_name, buy_price, sell_price, unit, min_quantity, product_group, status
    FROM products ORDER BY product_group, product_name
  `)
  return NextResponse.json(rows)
}

export async function PATCH(request: Request) {
  const changes: { product_name: string; buy_price: number; sell_price: number }[] = await request.json()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const { product_name, buy_price, sell_price } of changes) {
      await client.query(
        'UPDATE products SET buy_price = $1, sell_price = $2 WHERE product_name = $3',
        [buy_price, sell_price, product_name]
      )
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
