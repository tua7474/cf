import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(`
    SELECT
      t.year_month,
      t.target,
      COALESCE(s.actual, 0) AS actual,
      ROUND(COALESCE(s.actual, 0) / NULLIF(t.target, 0) * 100, 1) AS achievement_pct
    FROM sales_targets t
    LEFT JOIN (
      SELECT TO_CHAR(date, 'YYYY-MM') AS ym, SUM(price * quantity_sold) AS actual
      FROM transactions_sell
      WHERE price IS NOT NULL AND quantity_sold IS NOT NULL
      GROUP BY ym
    ) s ON s.ym = t.year_month
    ORDER BY t.year_month
  `)
  return NextResponse.json(rows)
}

export async function PATCH(request: Request) {
  const changes: { year_month: string; target: number }[] = await request.json()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const { year_month, target } of changes) {
      await client.query('UPDATE sales_targets SET target = $1 WHERE year_month = $2', [target, year_month])
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
