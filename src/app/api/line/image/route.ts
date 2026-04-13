import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import pool from '@/lib/db'

// ── Session helper ────────────────────────────────────────────────────────────

async function getOrder(userId: string): Promise<Record<number, number>> {
  const { rows } = await pool.query('SELECT order_data FROM line_sessions WHERE user_id=$1', [userId])
  return rows[0]?.order_data ?? {}
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function today() {
  return new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Image generation with satori ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') ?? ''

  try {
    const order = await getOrder(userId)
    const ids   = Object.keys(order).map(Number).filter(id => order[id] > 0)

    // Get ordered products
    const products: Record<string, unknown>[] = []
    if (ids.length) {
      const { rows } = await pool.query(`
        SELECT id, product_name, unit_price, section_name, section_order,
               subgroup_name, is_vat_included
        FROM booking_products WHERE id=ANY($1)
        ORDER BY section_order, subgroup_order, sort_order
      `, [ids])
      products.push(...rows)
    }

    // Group by section
    const sections: {
      name: string
      isVat: boolean
      items: { name: string; qty: number; price: number; total: number }[]
    }[] = []
    const secMap: Record<number, number> = {}

    let grayTotal = 0, orangeTotal = 0
    for (const p of products) {
      const secOrder = p.section_order as number
      if (secMap[secOrder] === undefined) {
        secMap[secOrder] = sections.length
        sections.push({ name: p.section_name as string, isVat: p.is_vat_included as boolean, items: [] })
      }
      const qty   = order[p.id as number]
      const total = (p.unit_price as number) * qty
      sections[secMap[secOrder]].items.push({
        name: p.product_name as string,
        qty,
        price: p.unit_price as number,
        total
      })
      if (p.is_vat_included) grayTotal += total
      else orangeTotal += total
    }

    const noVat   = grayTotal + orangeTotal
    const withVat = grayTotal + orangeTotal * 1.07

    // Load fonts
    const fontDir = path.join(process.cwd(), 'public', 'fonts')
    const fontRegular = fs.readFileSync(path.join(fontDir, 'Sarabun-Regular.ttf'))
    const fontBold    = fs.readFileSync(path.join(fontDir, 'Sarabun-Bold.ttf'))

    // Dynamic import satori (ESM)
    const { default: satori } = await import('satori')

    // Build JSX-like element tree (satori accepts plain objects too via h-like structure)
    // We'll build the SVG content as nested objects
    const W = 800

    // Row height constants
    const ROW_H   = 32
    const HEAD_H  = 80
    const SEC_H   = 36
    const FOOT_H  = 100
    const PAD     = 24

    // Calculate total height
    let totalRows = 0
    sections.forEach(s => { totalRows += 1 + s.items.length }) // 1 section header + items
    const H = HEAD_H + PAD + totalRows * ROW_H + SEC_H * sections.length + FOOT_H + PAD * 2

    // Build element using satori's JSX-compatible format
    const element = {
      type: 'div',
      props: {
        style: {
          display: 'flex', flexDirection: 'column',
          width: W, minHeight: H,
          backgroundColor: '#ffffff',
          fontFamily: 'Sarabun',
          fontSize: 14,
          color: '#222222',
        },
        children: [
          // Header
          {
            type: 'div',
            props: {
              style: {
                display: 'flex', flexDirection: 'column',
                backgroundColor: '#1a5c29',
                padding: '16px 24px', gap: 4,
              },
              children: [
                { type: 'div', props: { style: { fontSize: 22, fontWeight: 700, color: '#ffffff', display: 'flex' }, children: 'กระดาษฝอยไทย — ใบจอง' }},
                { type: 'div', props: { style: { fontSize: 13, color: '#aaffaa', display: 'flex' }, children: `วันที่: ${today()}  ·  รายการ: ${ids.length} รายการ` }}
              ]
            }
          },
          // Column headers
          {
            type: 'div',
            props: {
              style: {
                display: 'flex', flexDirection: 'row',
                backgroundColor: '#e8f5e9', padding: '6px 24px',
                borderBottom: '2px solid #1a5c29',
              },
              children: [
                { type: 'div', props: { style: { flex: 5, fontWeight: 700, fontSize: 13, display: 'flex' }, children: 'สินค้า' }},
                { type: 'div', props: { style: { flex: 2, fontWeight: 700, fontSize: 13, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }, children: 'ราคา/หน่วย' }},
                { type: 'div', props: { style: { flex: 1, fontWeight: 700, fontSize: 13, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }, children: 'จำนวน' }},
                { type: 'div', props: { style: { flex: 2, fontWeight: 700, fontSize: 13, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }, children: 'รวม (฿)' }},
              ]
            }
          },
          // Sections
          ...sections.map((sec, si) => ({
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' },
              children: [
                // Section header
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex', flexDirection: 'row',
                      backgroundColor: sec.isVat ? '#555555' : '#e07000',
                      padding: '6px 24px',
                    },
                    children: [
                      { type: 'div', props: { style: { fontWeight: 700, fontSize: 14, color: '#ffffff', display: 'flex' }, children: `${sec.isVat ? '🔘' : '🟠'} ${sec.name}${sec.isVat ? ' (รวม VAT)' : ''}` }}
                    ]
                  }
                },
                // Products
                ...sec.items.map((item, ii) => ({
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex', flexDirection: 'row',
                      backgroundColor: ii % 2 === 0 ? (sec.isVat ? '#f5f5f5' : '#fff8f0') : '#ffffff',
                      padding: '5px 24px',
                      borderBottom: '1px solid #eeeeee',
                    },
                    children: [
                      { type: 'div', props: { style: { flex: 5, fontSize: 13, display: 'flex' }, children: item.name }},
                      { type: 'div', props: { style: { flex: 2, fontSize: 13, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', color: '#555555' }, children: fmt(item.price) }},
                      { type: 'div', props: { style: { flex: 1, fontSize: 13, fontWeight: 700, textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }, children: String(item.qty) }},
                      { type: 'div', props: { style: { flex: 2, fontSize: 13, fontWeight: 700, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', color: '#1a5c29' }, children: fmt(item.total) }},
                    ]
                  }
                }))
              ]
            }
          })),
          // Footer totals
          {
            type: 'div',
            props: {
              style: {
                display: 'flex', flexDirection: 'column',
                margin: '16px 24px 0', gap: 8,
                borderTop: '2px solid #cccccc', paddingTop: 16,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff3e0', padding: '10px 16px', borderRadius: 8 },
                    children: [
                      { type: 'div', props: { style: { fontWeight: 700, color: '#c05000', fontSize: 16, display: 'flex' }, children: '🟠 ไม่มีใบกำกับภาษี' }},
                      { type: 'div', props: { style: { fontWeight: 700, color: '#c05000', fontSize: 16, display: 'flex' }, children: `${fmt(noVat)} ฿` }},
                    ]
                  }
                },
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f5f5f5', padding: '10px 16px', borderRadius: 8 },
                    children: [
                      { type: 'div', props: { style: { fontWeight: 700, color: '#333333', fontSize: 16, display: 'flex' }, children: '🔘 มีใบกำกับภาษี' }},
                      { type: 'div', props: { style: { fontWeight: 700, color: '#333333', fontSize: 16, display: 'flex' }, children: `${fmt(withVat)} ฿` }},
                    ]
                  }
                },
                { type: 'div', props: { style: { fontSize: 11, color: '#aaaaaa', display: 'flex', paddingTop: 8 }, children: 'กระดาษฝอยไทย · สร้างจาก LINE Bot · ' + new Date().toLocaleString('th-TH') }}
              ]
            }
          }
        ]
      }
    }

    const svg = await satori(element as Parameters<typeof satori>[0], {
      width: W,
      height: H + 80,
      fonts: [
        { name: 'Sarabun', data: fontRegular, weight: 400, style: 'normal' },
        { name: 'Sarabun', data: fontBold,    weight: 700, style: 'normal' },
      ],
    })

    // Convert SVG to JPEG using sharp
    const { default: sharp } = await import('sharp')
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer()

    return new NextResponse(jpeg as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      }
    })
  } catch (err) {
    console.error('Image generation error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
