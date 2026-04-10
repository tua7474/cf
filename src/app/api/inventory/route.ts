import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(`
    SELECT
      p.product_name,
      p.product_group,
      p.unit,
      p.min_quantity,
      COALESCE(b.total_bought, 0)                                          AS total_bought,
      COALESCE(s.total_sold, 0)                                            AS total_sold,
      COALESCE(b.total_bought, 0) - COALESCE(s.total_sold, 0)             AS stock_qty,
      COALESCE(b.avg_cost, p.buy_price)                                    AS avg_cost,
      ROUND((COALESCE(b.total_bought, 0) - COALESCE(s.total_sold, 0))
        * COALESCE(b.avg_cost, p.buy_price), 2)                           AS stock_value,
      p.sell_price,
      p.status
    FROM products p
    LEFT JOIN (
      SELECT product_name,
             SUM(actual_quantity) AS total_bought,
             ROUND(SUM(price * actual_quantity) / NULLIF(SUM(actual_quantity),0), 2) AS avg_cost
      FROM transactions_buy GROUP BY product_name
    ) b ON b.product_name = p.product_name
    LEFT JOIN (
      SELECT product_name, SUM(quantity_sold) AS total_sold
      FROM transactions_sell GROUP BY product_name
    ) s ON s.product_name = p.product_name
    ORDER BY p.product_group, p.product_name
  `)
  return NextResponse.json(rows)
}
