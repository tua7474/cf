import { NextResponse } from 'next/server'
import pool from '@/lib/db'

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS booking_items (
    id            SERIAL PRIMARY KEY,
    row_order     INTEGER      NOT NULL DEFAULT 0,
    row_type      VARCHAR(20)  NOT NULL DEFAULT 'data',
    section_label VARCHAR(100)          DEFAULT '',
    left_code     VARCHAR(50)           DEFAULT '',
    left_name     VARCHAR(200)          DEFAULT '',
    left_spec     VARCHAR(100)          DEFAULT '',
    left_qty      DECIMAL(12,3),
    left_unit     VARCHAR(20)           DEFAULT '',
    left_price    DECIMAL(12,2),
    left_amount   DECIMAL(12,2),
    right_code    VARCHAR(50)           DEFAULT '',
    right_name    VARCHAR(200)          DEFAULT '',
    right_qty     DECIMAL(12,3),
    right_unit    VARCHAR(20)           DEFAULT '',
    right_price   DECIMAL(12,2),
    right_amount  DECIMAL(12,2),
    note          VARCHAR(200)          DEFAULT '',
    updated_at    TIMESTAMP             DEFAULT NOW()
  )
`

// Initial seed: section headers + data rows matching image structure
const SEED_ROWS = [
  // row_order, row_type, section_label
  [1,  'section', 'หมวดที่ 1'],
  [2,  'data', ''], [3,  'data', ''], [4,  'data', ''], [5,  'data', ''], [6,  'data', ''], [7,  'data', ''],
  [8,  'section', 'หมวดที่ 2'],
  [9,  'data', ''], [10, 'data', ''], [11, 'data', ''], [12, 'data', ''], [13, 'data', ''], [14, 'data', ''],
  [15, 'section', 'หมวดที่ 3'],
  [16, 'data', ''], [17, 'data', ''], [18, 'data', ''], [19, 'data', ''], [20, 'data', ''], [21, 'data', ''],
  [22, 'section', 'หมวดที่ 4'],
  [23, 'data', ''], [24, 'data', ''], [25, 'data', ''], [26, 'data', ''], [27, 'data', ''], [28, 'data', ''],
  [29, 'section', 'หมวดที่ 5'],
  [30, 'data', ''], [31, 'data', ''], [32, 'data', ''], [33, 'data', ''], [34, 'data', ''], [35, 'data', ''],
  [36, 'summary', 'รวมทั้งสิ้น'],
  [37, 'summary', 'ภาษีมูลค่าเพิ่ม 7%'],
  [38, 'summary', 'ยอดรวมสุทธิ'],
]

export async function GET() {
  try {
    await pool.query(CREATE_TABLE)
    const { rows } = await pool.query('SELECT * FROM booking_items ORDER BY row_order, id')

    if (rows.length === 0) {
      const values = SEED_ROWS.map(
        ([ord, typ, lbl]) =>
          `(${ord}, '${typ}', '${lbl}', '', '', '', NULL, '', NULL, NULL, '', '', NULL, '', NULL, NULL, '')`
      ).join(',\n      ')

      await pool.query(`
        INSERT INTO booking_items
          (row_order, row_type, section_label, left_code, left_name, left_spec, left_qty, left_unit, left_price, left_amount, right_code, right_name, right_qty, right_unit, right_price, right_amount, note)
        VALUES ${values}
      `)

      const { rows: seeded } = await pool.query('SELECT * FROM booking_items ORDER BY row_order, id')
      return NextResponse.json(seeded)
    }

    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const edits: Array<{ id: number } & Record<string, unknown>> = await request.json()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const edit of edits) {
      const { id, ...fields } = edit
      if (Object.keys(fields).length === 0) continue
      const setClauses = Object.keys(fields).map((k, i) => `"${k}" = $${i + 2}`).join(', ')
      const values = [id, ...Object.values(fields)]
      await client.query(
        `UPDATE booking_items SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
        values
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ ok: true, updated: edits.length })
  } catch (e) {
    await client.query('ROLLBACK')
    return NextResponse.json({ error: String(e) }, { status: 500 })
  } finally {
    client.release()
  }
}
