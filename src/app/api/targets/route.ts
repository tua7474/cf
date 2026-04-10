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
