import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  const { rows } = await pool.query(`
    SELECT product_name, buy_price, sell_price, unit, min_quantity, product_group, status
    FROM products ORDER BY product_group, product_name
  `)
  return NextResponse.json(rows)
}
