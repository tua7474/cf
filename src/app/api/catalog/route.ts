import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

// ── Ensure table + seed ───────────────────────────────────────────────────────

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products_catalog (
      id           SERIAL PRIMARY KEY,
      group_name   VARCHAR(100) NOT NULL,
      product_name VARCHAR(200) NOT NULL,
      price        NUMERIC(12,2),
      cost         NUMERIC(12,2),
      quantity     NUMERIC(12,2),
      updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `)
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products_catalog')
  if (rows[0].n === 0) await seedData()
  // Seed กระดาษฝอย products if not yet present
  await seedKradaatFoi()
  // Merge groups that share the same prefix into one group
  await mergeGroupsByPrefix()
}

async function mergeGroupsByPrefix() {
  // Merge any group starting with "กระดาษฝอย" → "กระดาษฝอย"
  await pool.query(`
    UPDATE products_catalog SET group_name = 'กระดาษฝอย', updated_at = NOW()
    WHERE group_name LIKE 'กระดาษฝอย%' AND group_name <> 'กระดาษฝอย'
  `)
  // Merge any group starting with "กระบอก" → "กระบอก"
  await pool.query(`
    UPDATE products_catalog SET group_name = 'กระบอก', updated_at = NOW()
    WHERE group_name LIKE 'กระบอก%' AND group_name <> 'กระบอก'
  `)
}

async function seedKradaatFoi() {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS n FROM products_catalog WHERE group_name IN ('รุ่นสีอ่อน','รุ่นสีพิเศษ A','รุ่นหยัก')"
  )
  if (rows[0].n > 0) return  // already seeded

  const foiProducts: [string, string, number, number][] = [
    ['รุ่นสีอ่อน',  '510 ขาวธรรมชาติ',    150, 90],
    ['รุ่นสีอ่อน',  '861 ฟ้าอ่อน',        150, 80],
    ['รุ่นสีอ่อน',  '831 สีโอรส',         150, 80],
    ['รุ่นสีอ่อน',  '552 ชมพูเข้ม',       150, 80],
    ['รุ่นสีอ่อน',  '551 ชมพูอ่อน',       150, 80],
    ['รุ่นสีอ่อน',  '860 ม่วงอ่อน',       150, 80],
    ['รุ่นสีอ่อน',  '591 เทาอ่อน',        150, 70],
    ['รุ่นสีอ่อน',  '561 ฟ้าเข้ม',        150, 80],
    ['รุ่นสีอ่อน',  '521 ครีม',           150, 80],
    ['รุ่นสีพิเศษ A','111 เงินเงา',        400, 250],
    ['รุ่นสีพิเศษ A','112 เงินด้าน',       400, 250],
    ['รุ่นสีอ่อน',  '881 เปลือกไม้',      150, 80],
    ['รุ่นสีอ่อน',  '863 ฟ้าพาสเทลเข้ม', 150, 70],
    ['รุ่นหยัก',    '881 เปลือกไม้ รุ่นหยัก', 250, 20],
    ['รุ่นสีอ่อน',  '853 ชมพูพาสเทล',    150, 80],
    ['รุ่นสีอ่อน',  '862 ฟ้า PT อ่อน',   150, 80],
    ['รุ่นสีอ่อน',  '863 ฟ้า PT เข้ม',   150, 80],
    ['รุ่นสีอ่อน',  '522 เหลืองอ่อน',    150, 60],
    ['รุ่นสีอ่อน',  '571 เขียวหยก',      150, 60],
    ['รุ่นสีอ่อน',  '882 กาแฟ',          150, 60],
    ['รุ่นสีอ่อน',  '511 กรีนรีด',       150, 60],
  ]

  const placeholders = foiProducts.map((_, j) => {
    const b = j * 4
    return `($${b+1},$${b+2},$${b+3},$${b+4})`
  }).join(',')
  const flat = foiProducts.flatMap(([g, n, p, c]) => [g, n, p, c])
  await pool.query(
    `INSERT INTO products_catalog (group_name,product_name,price,cost) VALUES ${placeholders}`,
    flat
  )
}

async function seedData() {
  const values: [string, string, number | null, null, number | null][] = [
    ['กล่อง','00ม.พ.',0.83,null,null],
    ['กล่อง','00',0.88,null,null],
    ['กล่อง','0',1.10,null,null],
    ['กล่อง','0+4',1.42,null,null],
    ['กล่อง','00+',2.62,null,null],
    ['กล่อง','AA',1.48,null,null],
    ['กล่อง','A',1.66,null,null],
    ['กล่อง','AB',1.94,null,null],
    ['กล่อง','2A',2.11,null,null],
    ['กล่อง','AH',4.24,null,null],
    ['กล่อง','Q',2.13,null,null],
    ['กล่อง','B',2.60,null,null],
    ['กล่อง','B+7',3.37,null,null],
    ['กล่อง','2B',3.53,null,null],
    ['กล่อง','BH',5.47,null,null],
    ['กล่อง','C',3.57,null,null],
    ['กล่อง','2C',4.97,null,null],
    ['กล่อง','CD',2.18,null,null],
    ['กล่อง','C+8',4.62,null,null],
    ['กล่อง','C+9',4.83,null,null],
    ['กล่อง','D-7',3.30,null,null],
    ['กล่อง','D',4.91,null,null],
    ['กล่อง','D+11',6.39,null,null],
    ['กล่อง','2D',6.75,null,null],
    ['กล่อง','S+',5.62,null,null],
    ['กล่อง','E',6.21,null,null],
    ['กล่อง','F',7.22,null,null],
    ['กล่อง','Fกลาง',8.76,null,null],
    ['กล่อง','F+',11.72,null,null],
    ['กล่อง','2F',8.11,null,null],
    ['กล่อง','ฉ',9.47,null,null],
    ['กล่อง','M',7.93,null,null],
    ['กล่อง','M+',11.36,null,null],
    ['กล่อง','G',8.88,null,null],
    ['กล่อง','H',15.09,null,null],
    ['กล่อง','L',14.73,null,null],
    ['กล่อง','7',13.73,null,null],
    ['กล่อง','P1',8.34,null,null],
    ['กล่อง','P2',10.23,null,null],
    ['กล่อง','P3',7.71,null,null],
    ['กล่อง','P4',12.85,null,null],
    ['กล่อง','1',19.35,null,null],
    ['กล่อง','2',11.86,null,null],
    ['กล่อง','7(5ชั้น)',26.51,null,null],
    ['กล่อง','I (3ชั้น)',19.53,null,null],
    ['กล่อง','I (5ชั้น)',35.38,null,null],
    ['กล่อง','T1',1.93,null,null],
    ['กล่อง','T2',4.62,null,null],
    ['กล่อง','2E',11.60,null,null],
    ['ซองน้ำตาล','5x8',0.88,null,null],
    ['ซองน้ำตาล','7x10',0.92,null,null],
    ['ซองน้ำตาล','9x12.75',1.35,null,null],
    ['ซองน้ำตาล','10x15',1.63,null,null],
    ['ซองน้ำตาล','15x19',3.42,null,null],
    ['ซองน้ำตาล','9x12.75+2',2.31,null,null],
    ['ซองน้ำตาล','10x15+2',3.47,null,null],
    ['ซองน้ำตาล','11x17+2',3.53,null,null],
    ['ซองน้ำตาล','6x9',1.44,null,null],
    ['ซองน้ำตาล','7x10',1.55,null,null],
    ['ซองน้ำตาล','9x12.75',1.85,null,null],
    ['ซองน้ำตาล','6x9',0.74,null,null],
    ['ซองน้ำตาล','7x10',1.03,null,null],
    ['ซองน้ำตาล','9x12.75',1.35,null,null],
    ['ซองน้ำตาล','5*8',0.90,null,null],
    ['ซองน้ำตาล','7x9.2',1.44,null,null],
    ['ซองน้ำตาล','8x10',1.73,null,null],
    ['ซองน้ำตาล','10x12',2.67,null,null],
    ['ซองน้ำตาล','11x15+2',3.63,null,null],
    ['ซองน้ำตาล','ใส 45',12.04,null,null],
    ['ซองน้ำตาล','ใส 100',23.60,null,null],
    ['ซองน้ำตาล','ทึบ 45',12.04,null,null],
    ['ซองน้ำตาล','ทึบ 100',23.60,null,null],
    ['ซองน้ำตาล','เหลือง',12.40,null,null],
    ['ซองน้ำตาล','ดำ',12.40,null,null],
    ['ซองน้ำตาล','แดง',12.40,null,null],
    ['ซองน้ำตาล','ขาว',12.40,null,null],
    ['ซองน้ำตาล','ใส 45',9.63,null,null],
    ['ซองน้ำตาล','ใส 100',19.26,null,null],
    ['ซองน้ำตาล','ทึบ 45',9.63,null,null],
    ['ซองน้ำตาล','ทึบ 100',19.26,null,null],
    ['ซองน้ำตาล','เขียว',20.33,null,null],
    ['ซองน้ำตาล','ชมพู',20.33,null,null],
    ['ซองน้ำตาล','บานเย็น',20.33,null,null],
    ['ซองน้ำตาล','ฟ้า',20.33,null,null],
    ['ซองน้ำตาล','ม่วง',20.33,null,null],
    ['ซองน้ำตาล','เหลือง',20.33,null,null],
    ['ซองน้ำตาล','NO.01',28.36,null,null],
    ['ซองน้ำตาล','No.03',33.23,null,null],
    ['ซองน้ำตาล','No.04',38.00,null,null],
    ['ซอง PP','0/17x30',0.75,null,null],
    ['ซอง PP','1/25x35',1.25,null,null],
    ['ซอง PP','2/28x42',1.69,null,null],
    ['ซอง PP','3/32x45',2.10,null,null],
    ['ซอง PP','4/38x52',2.85,null,null],
    ['ซอง PP','5/45x60',3.75,null,null],
    ['ซอง PP','6/50x70',5.20,null,null],
    ['ซอง PP','7/60x80',6.70,null,null],
    ['ซอง PP','0/17x30',0.70,null,null],
    ['ซอง PP','1/25x35',1.00,null,null],
    ['ซอง PP','2/28x42',1.20,null,null],
    ['ซอง PP','3/32x45',1.60,null,null],
    ['ซอง PP','4/38x52',2.30,null,null],
    ['ซอง PP','5/45x60',3.10,null,null],
    ['ซอง PP','0/17x30',0.75,null,null],
    ['ซอง PP','1/25x35',1.25,null,null],
    ['ซอง PP','2/28x42',1.69,null,null],
    ['ซอง PP','3/32x45',2.10,null,null],
    ['ซอง PP','4/38x52',2.85,null,null],
    ['ซอง PP','350 แผ่น',85.00,null,null],
    ['ซอง PP','15x250',117.70,null,null],
    ['ซอง PP','15x300',144.45,null,null],
    ['ซอง PP','45 cm',7.43,null,null],
    ['ซอง PP','55 cm',8.07,null,null],
    ['ซอง PP','65 cm',8.82,null,null],
    ['ซอง PP','75 cm',9.56,null,null],
    ['ซอง PP','85 cm',10.21,null,null],
    ['ซอง PP','95 cm',10.96,null,null],
    ['ซอง PP','100 cm',11.33,null,null],
    ['ซอง PP','120 cm',12.83,null,null],
    ['ซอง PP','45 cm',9.92,null,null],
    ['ซอง PP','55 cm',10.99,null,null],
    ['ซอง PP','65 cm',12.12,null,null],
    ['ซอง PP','ฝามินิ',1.50,null,null],
    ['ซอง PP','ฝา2นิ้ว',2.00,null,null],
    ['ซอง PP','ฝา3นิ้ว',2.50,null,null],
    ['ซอง PP','9x18',30.00,null,null],
    ['ซอง PP','12x20',30.00,null,null],
    ['ซอง PP','12x26',30.00,null,null],
    ['ซอง PP','15x30',30.00,null,null],
    ['ซอง PP','18x36',30.00,null,null],
    ['บับเบิล','32.5x100',109.14,null,null],
    ['บับเบิล','65x100',208.65,null,null],
    ['บับเบิล','130x100',417.30,null,null],
    ['บับเบิล','32.5x150',244.00,null,null],
    ['บับเบิล','65x150',482.00,null,null],
    ['บับเบิล','130x150',900.00,null,null],
    ['บับเบิล','รุ่นล็อค',42.80,null,null],
    ['บับเบิล','รุ่นมีเบรค',37.45,null,null],
    ['บับเบิล','Shocking Pink',15.00,null,null],
    ['บับเบิล','12มิล',230.99,null,null],
    ['บับเบิล','15มิล',193.67,null,null],
    ['บับเบิล','A 80g',2.80,null,null],
    ['บับเบิล','A 110g',3.40,null,null],
    ['บับเบิล','KA 125g',4.90,null,null],
    ['บับเบิล','แดง',95.00,null,null],
    ['บับเบิล','พิเศษ A',225.00,null,null],
    ['บับเบิล','พิเศษ B',200.00,null,null],
    ['บับเบิล','รุ่นสีอ่อน',100.00,null,null],
    ['บับเบิล','รุ่นปุยนุ่น',150.00,null,null],
    ['บับเบิล','14.5x18cm.',1.00,null,null],
    ['บับเบิล','17x25cm.',1.50,null,null],
    ['บับเบิล','32.5x150',98.98,null,null],
    ['บับเบิล','65x150',187.25,null,null],
    ['บับเบิล','130x150',374.50,null,null],
    ['กล่อง Thank You','00',0.72,null,null],
    ['กล่อง Thank You','0',0.90,null,null],
    ['กล่อง Thank You','0+4',1.16,null,null],
    ['กล่อง Thank You','A',1.36,null,null],
    ['กล่อง Thank You','AA',1.21,null,null],
    ['กล่อง Thank You','2A',2.11,null,null],
    ['กล่อง Thank You','AB',1.59,null,null],
    ['กล่อง Thank You','B',2.13,null,null],
    ['กล่อง Thank You','2B',2.89,null,null],
    ['กล่อง Thank You','C',2.93,null,null],
    ['กล่อง Thank You','D',4.03,null,null],
    ['กล่อง Thank You','E',5.09,null,null],
    ['กล่อง Thank You','S+',16.00,null,null],
    ['กล่อง Thank You','D+11',18.00,null,null],
    ['กล่อง Thank You','M',20.00,null,null],
    ['กล่อง Thank You','M+',24.40,null,null],
    ['กล่อง Thank You','L',30.50,null,null],
    ['กล่อง Thank You','20*34',64.20,null,null],
    ['กล่อง Thank You','25*35',74.90,null,null],
    ['กล่อง Thank You','28*40',90.95,null,null],
    ['กล่อง Thank You','32*45',112.35,null,null],
    ['กล่อง Thank You','15*20',64.20,null,null],
    ['กล่อง Thank You','20*25',74.90,null,null],
    ['กล่อง Thank You','25*30',101.65,null,null],
    ['กล่อง Thank You','30*35',128.40,null,null],
    ['กล่อง Thank You','35*45',171.20,null,null],
    ['กล่อง Thank You','40*50',208.65,null,null],
    ['กล่อง Thank You','50*60',272.85,null,null],
    ['กล่อง Thank You','เชือกฟาง',32.00,null,null],
    ['กล่อง Thank You','500 g.',55.00,null,null],
    ['กล่อง Thank You','1 kg.',114.00,null,null],
    ['ซองกันกระแทก','6x9',2.68,null,null],
    ['ซองกันกระแทก','7x10',3.08,null,null],
    ['ซองกันกระแทก','9x12.75',3.70,null,null],
    ['ซองกันกระแทก','No.30',1200.00,null,null],
    ['ซองกันกระแทก','No.45',1200.00,null,null],
    ['ซองกันกระแทก','No.610',1200.00,null,null],
    ['ซองกันกระแทก','No.1016',700.00,null,null],
    ['ซองกันกระแทก','รุ่น 1003',8346.00,null,null],
    ['ซองกันกระแทก','รุ่น1002',5493.00,null,null],
    ['ซองกันกระแทก','ใบเสร็จ',21.00,null,null],
    ['ซองกันกระแทก','1หัว',2.00,null,null],
    ['ซองกันกระแทก','2หัว',3.00,null,null],
    ['ซองกันกระแทก','เครื่อง+STK',856.00,null,null],
    ['ซองกันกระแทก','STK.เว้นขอบ',27.30,null,null],
    ['ซองกันกระแทก','STKปกติ',26.00,null,null],
    ['ซองกันกระแทก','STK.สี',27.30,null,null],
    ['ซองกันกระแทก','เคสใส',53.50,null,null],
    ['ซองกันกระแทก','เคสซิลิโคน',53.50,null,null],
    ['ซองกันกระแทก','พิเศษ A',250.00,null,null],
    ['ซองกันกระแทก','พิเศษ B',225.00,null,null],
    ['ซองกันกระแทก','รุ่นสีอ่อน',125.00,null,null],
    ['ซองกันกระแทก','พิเศษ A',275.00,null,null],
    ['ซองกันกระแทก','พิเศษ B',250.00,null,null],
    ['ซองกันกระแทก','รุ่นสีอ่อน',150.00,null,null],
    ['ซองกันกระแทก','ถุง 30 กรัม',1.00,null,null],
    ['ซองกันกระแทก','34cm',6.80,null,null],
    ['ซองกันกระแทก','S+',9.60,null,null],
    ['ซองกันกระแทก','M',12.37,null,null],
    ['ซองกันกระแทก','M+',17.46,null,null],
    ['ซองกันกระแทก','L',23.28,null,null],
    ['ซองกันกระแทก','G',16.01,null,null],
    ['ซองกันกระแทก','H',24.06,null,null],
    ['ซองกันกระแทก','1',28.62,null,null],
    ['ซองกันกระแทก','2',17.90,null,null],
    ['ซองกันกระแทก','J',55.78,null,null],
    ['ซองกันกระแทก','K',35.89,null,null],
    ['ซองกันกระแทก','X',54.32,null,null],
    ['ซองกันกระแทก','D',7.99,null,null],
    ['ซองกันกระแทก','T3',3.67,null,null],
  ]

  // Batch insert
  const chunkSize = 50
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize)
    const placeholders = chunk.map((_, j) => {
      const base = j * 5
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5})`
    }).join(',')
    const flat = chunk.flatMap(([g, n, p, c, q]) => [g, n, p, c, q])
    await pool.query(
      `INSERT INTO products_catalog (group_name,product_name,price,cost,quantity) VALUES ${placeholders}`,
      flat
    )
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    await ensureTable()
    const { rows } = await pool.query(`
      SELECT id, group_name, product_name, price, cost, quantity,
             to_char(updated_at, 'YYYY-MM-DD HH24:MI') AS updated_at
      FROM products_catalog
      ORDER BY group_name, id
    `)
    return NextResponse.json(rows)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: number
      group_name?: string; product_name?: string
      price?: number; cost?: number; quantity?: number
    }[]
    for (const row of body) {
      const fields: string[] = []
      const vals: unknown[] = []
      let n = 1
      if (row.group_name   !== undefined) { fields.push(`group_name=$${n++}`);   vals.push(row.group_name) }
      if (row.product_name !== undefined) { fields.push(`product_name=$${n++}`); vals.push(row.product_name) }
      if (row.price        !== undefined) { fields.push(`price=$${n++}`);        vals.push(row.price) }
      if (row.cost         !== undefined) { fields.push(`cost=$${n++}`);         vals.push(row.cost) }
      if (row.quantity     !== undefined) { fields.push(`quantity=$${n++}`);     vals.push(row.quantity) }
      if (!fields.length) continue
      fields.push(`updated_at=NOW()`)
      vals.push(row.id)
      await pool.query(
        `UPDATE products_catalog SET ${fields.join(',')} WHERE id=$${n}`,
        vals
      )
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await ensureTable()
    const { group_name, product_name, price, cost, quantity } =
      await req.json() as { group_name: string; product_name: string; price?: number; cost?: number; quantity?: number }
    if (!group_name || !product_name)
      return NextResponse.json({ error: 'group_name and product_name required' }, { status: 400 })
    const { rows } = await pool.query(
      `INSERT INTO products_catalog (group_name,product_name,price,cost,quantity)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [group_name, product_name, price ?? null, cost ?? null, quantity ?? null]
    )
    return NextResponse.json({ ok: true, id: rows[0].id })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    await pool.query('DELETE FROM products_catalog WHERE id=$1', [id])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
