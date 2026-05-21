import { NextResponse } from 'next/server'
import pool from '@/lib/db'

// ── group_name → section/subgroup mapping (catalog → booking format) ───────────

type SectionInfo = {
  section_order: number; section_name: string; is_vat_included: boolean
  subgroup_order: number; subgroup_name: string
}

const GROUP_MAP: Record<string, SectionInfo> = {
  // S1 กล่อง
  'กล่อง':                        { section_order: 1, section_name: 'กล่อง',          is_vat_included: true,  subgroup_order: 0,  subgroup_name: '' },
  // S2 ซองน้ำตาล
  'ซองน้ำตาล':                    { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 1,  subgroup_name: 'ซองน้ำตาล' },
  'ซองขยายข้าง':                  { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 2,  subgroup_name: 'ซองขยายข้าง' },
  'ซองจ่าหน้า':                   { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 3,  subgroup_name: 'ซองจ่าหน้า' },
  'ซองบับเบิล':                   { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 4,  subgroup_name: 'ซองบับเบิล' },
  'ซองPPกันกระแทก':               { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 5,  subgroup_name: 'ซองPPกันกระแทก' },
  'เทปOPPแกนดำ':                  { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 6,  subgroup_name: 'เทป OPP แกนดำ' },
  'เทปOPPแกนส้ม':                 { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 7,  subgroup_name: 'เทป OPP แกนส้ม' },
  'เทประวังแตก':                  { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 8,  subgroup_name: 'เทประวังแตก' },
  'เทปThankYou':                  { section_order: 2, section_name: 'ซองน้ำตาล',      is_vat_included: false, subgroup_order: 9,  subgroup_name: 'เทป Thank You' },
  'กล่องเอกสาร':                  { section_order: 6, section_name: 'ซองกันกระแทก',   is_vat_included: false, subgroup_order: 5,  subgroup_name: 'กล่องเอกสาร' },
  // S3 ซอง PP
  'ซอง PP':                       { section_order: 3, section_name: 'ซอง PP',          is_vat_included: false, subgroup_order: 1,  subgroup_name: 'ซอง PP' },
  'ซองเมทาลิค':                   { section_order: 3, section_name: 'ซอง PP',          is_vat_included: false, subgroup_order: 2,  subgroup_name: 'ซองเมทาลิค' },
  'ซอง PP สี':                    { section_order: 3, section_name: 'ซอง PP',          is_vat_included: false, subgroup_order: 3,  subgroup_name: 'ซอง PP สี' },
  'ลาเบล 10x15':                  { section_order: 3, section_name: 'ซอง PP',          is_vat_included: false, subgroup_order: 4,  subgroup_name: 'ลาเบล 10x15' },
  'ฟิล์มยืด':                     { section_order: 3, section_name: 'ซอง PP',          is_vat_included: false, subgroup_order: 5,  subgroup_name: 'ฟิล์มยืด' },
  'กระบอก':                       { section_order: 3, section_name: 'ซอง PP',          is_vat_included: false, subgroup_order: 6,  subgroup_name: 'กระบอก' },
  'ฝาปิดกระบอก':                  { section_order: 3, section_name: 'ซอง PP',          is_vat_included: false, subgroup_order: 7,  subgroup_name: 'ฝาปิดกระบอก' },
  'ถุงหิ้วบริการ':                 { section_order: 6, section_name: 'ซองกันกระแทก',   is_vat_included: false, subgroup_order: 6,  subgroup_name: 'ถุงหิ้วบริการ' },
  // S4 บับเบิล
  'บับเบิล':                      { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 1,  subgroup_name: 'บับเบิล' },
  'บับเบิลสี':                    { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 2,  subgroup_name: 'บับเบิลสี' },
  'โฟมบาง 2 มิล':                 { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 3,  subgroup_name: 'โฟมบาง 2 มิล' },
  'ตัวตัดเทป':                    { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 4,  subgroup_name: 'ตัวตัดเทป' },
  'สายรัด PP':                    { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 5,  subgroup_name: 'สายรัด PP' },
  'กระดาษห่อ':                    { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 6,  subgroup_name: 'กระดาษห่อ' },
  'สติกเกอร์ระวังแตกม้วน':        { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 7,  subgroup_name: 'สติกเกอร์ระวังแตก' },
  // กระดาษฝอย subgroup 8 — ดึงจาก paper_stock ใน GET handler แทน products_catalog
  'ซองใสปะหน้า':                  { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 15, subgroup_name: 'ซองใสปะหน้า' },
  'ปากกาเขียน PP':                { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 16, subgroup_name: 'ปากกาเขียน PP' },
  'ถุงใส่กระดาษฝอย':              { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 17, subgroup_name: 'ถุงใส่กระดาษฝอย' },
  'เบิกฟรี':                      { section_order: 4, section_name: 'บับเบิล',         is_vat_included: false, subgroup_order: 18, subgroup_name: 'เบิกฟรี' },
  // S5 กล่อง Thank You
  'กล่อง Thank You':              { section_order: 5, section_name: 'กล่อง Thank You', is_vat_included: false, subgroup_order: 1,  subgroup_name: 'กล่อง Thank You' },
  'กล่องผลไม้ 5 ชั้น':            { section_order: 5, section_name: 'กล่อง Thank You', is_vat_included: false, subgroup_order: 2,  subgroup_name: 'กล่องผลไม้ 5 ชั้น' },
  'ถุงแก้วฝากาว 60M/100P':        { section_order: 5, section_name: 'กล่อง Thank You', is_vat_included: false, subgroup_order: 3,  subgroup_name: 'ถุงแก้วฝากาว 60M/100P' },
  'ถุงซิปรูด':                    { section_order: 5, section_name: 'กล่อง Thank You', is_vat_included: false, subgroup_order: 4,  subgroup_name: 'ถุงซิปรูด' },
  'เชือก':                        { section_order: 5, section_name: 'กล่อง Thank You', is_vat_included: false, subgroup_order: 5,  subgroup_name: 'เชือก' },
  // S6 ซองกันกระแทก
  'ซองกันกระแทก':                 { section_order: 6, section_name: 'ซองกันกระแทก',   is_vat_included: false, subgroup_order: 1,  subgroup_name: 'ซองกันกระแทก' },
  'MINI AIR BAG ม้วนเปล่า':       { section_order: 6, section_name: 'ซองกันกระแทก',   is_vat_included: false, subgroup_order: 2,  subgroup_name: 'MINI AIR BAG ม้วนเปล่า' },
  'MINI AIR เครื่องเป่า':         { section_order: 6, section_name: 'ซองกันกระแทก',   is_vat_included: false, subgroup_order: 3,  subgroup_name: 'MINI AIR เครื่องเป่า' },
  'กล่อง 5 ชั้น':                 { section_order: 6, section_name: 'ซองกันกระแทก',   is_vat_included: false, subgroup_order: 4,  subgroup_name: 'กล่อง 5 ชั้น' },
  'กระดาษพิมพ์สลิป':              { section_order: 6, section_name: 'ซองกันกระแทก',   is_vat_included: false, subgroup_order: 7,  subgroup_name: 'กระดาษพิมพ์สลิป' },
  'เครื่อง/สติกเกอร์/เคส':        { section_order: 5, section_name: 'กล่อง Thank You', is_vat_included: false, subgroup_order: 6,  subgroup_name: 'เครื่อง/สติกเกอร์/เคส' },
}

export async function GET() {
  try {
    // One-time migration: rename old group key to match current GROUP_MAP
    await pool.query(
      `UPDATE products_catalog SET group_name = 'เบิกฟรี', updated_at = NOW()
       WHERE group_name = 'เบิกของ ฟรี'`
    )

    const groupNames = Object.keys(GROUP_MAP)
    const { rows } = await pool.query<{
      id: number; group_name: string; product_name: string
      price: string | null; stock_qty: string | null
    }>(
      `SELECT id, group_name, product_name, price,
              quantity AS stock_qty
       FROM products_catalog
       WHERE group_name = ANY($1) AND show_in_booking = true
       ORDER BY group_name, id`,
      [groupNames]
    )
    const enriched = rows.map(p => ({ ...p, ...GROUP_MAP[p.group_name] }))

    // กระดาษฝอย models จาก paper_stock (subgroup 8)
    const { rows: foyRows } = await pool.query<{
      model_name: string; total_qty: string
    }>(
      `SELECT model_name, COALESCE(SUM(stock_qty), 0) AS total_qty
       FROM paper_stock
       WHERE show_in_booking = true
       GROUP BY model_name
       ORDER BY model_name`
    )
    const foyProducts = foyRows.map((r, i) => ({
      id: -(i + 1),
      group_name: 'กระดาษฝอย',
      product_name: r.model_name,
      price: null as string | null,
      stock_qty: r.total_qty,
      section_order: 4,
      section_name: 'บับเบิล',
      is_vat_included: false,
      subgroup_order: 8,
      subgroup_name: 'กระดาษฝอย',
    }))

    const all = [...enriched, ...foyProducts]
    all.sort((a, b) =>
      a.section_order - b.section_order ||
      a.subgroup_order - b.subgroup_order ||
      a.id - b.id
    )
    return NextResponse.json(all)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
