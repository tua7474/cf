import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(`
    SELECT
      s.id,
      s.date,
      s.product_name,
      s.price,
      s.unit,
      s.quantity_sold,
      ROUND(s.price * s.quantity_sold, 2)                          AS total_value,
      ROUND(avg_cost.avg_price * s.quantity_sold, 2)               AS avg_cost_total,
      ROUND((s.price - avg_cost.avg_price) * s.quantity_sold, 2)   AS gross_profit,
      CASE WHEN s.price > 0
        THEN ROUND((s.price - avg_cost.avg_price) / s.price * 100, 2)
        ELSE 0 END                                                  AS gross_profit_pct,
      TO_CHAR(s.date, 'YYYY-MM')                                   AS year_month,
      p.product_group,
      s.note
    FROM transactions_sell s
    JOIN products p ON p.product_name = s.product_name
    LEFT JOIN (
      SELECT product_name,
             ROUND(SUM(price * actual_quantity) / NULLIF(SUM(actual_quantity), 0), 2) AS avg_price
      FROM transactions_buy
      GROUP BY product_name
    ) avg_cost ON avg_cost.product_name = s.product_name
    ORDER BY s.date DESC
  `)
  return NextResponse.json(rows)
}
