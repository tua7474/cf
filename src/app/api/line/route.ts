import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import pool from '@/lib/db'

// ── LINE API helpers ──────────────────────────────────────────────────────────

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!
const SECRET = process.env.LINE_CHANNEL_SECRET!

async function replyMessage(replyToken: string, messages: object[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })
}

function textMsg(text: string) {
  return { type: 'text', text }
}

// ── Signature verification ────────────────────────────────────────────────────

function verifySignature(body: string, signature: string): boolean {
  const hash = crypto.createHmac('sha256', SECRET).update(body).digest('base64')
  return hash === signature
}

// ── DB queries ────────────────────────────────────────────────────────────────

async function querySell() {
  const { rows } = await pool.query(`
    SELECT date, product_name, price, unit, quantity_sold, total_value, gross_profit
    FROM sell_transactions
    ORDER BY date DESC, id DESC
    LIMIT 10
  `)
  return rows
}

async function queryBuy() {
  const { rows } = await pool.query(`
    SELECT date, product_name, price, unit, actual_quantity, total_value
    FROM buy_transactions
    ORDER BY date DESC, id DESC
    LIMIT 10
  `)
  return rows
}

async function queryProducts() {
  const { rows } = await pool.query(`
    SELECT product_name, buy_price, sell_price, unit, min_quantity, product_group, status
    FROM products
    ORDER BY product_group, product_name
  `)
  return rows
}

async function queryInventory() {
  const { rows } = await pool.query(`
    SELECT product_name, unit, stock_qty, min_quantity, avg_cost, sell_price, status
    FROM inventory_view
    ORDER BY product_name
  `)
  return rows
}

async function queryLowStock() {
  const { rows } = await pool.query(`
    SELECT product_name, unit, stock_qty, min_quantity
    FROM inventory_view
    WHERE stock_qty < min_quantity
    ORDER BY stock_qty ASC
  `)
  return rows
}

async function queryTargets() {
  const { rows } = await pool.query(`
    SELECT year_month, target, actual, achievement_pct
    FROM targets
    ORDER BY year_month DESC
    LIMIT 6
  `)
  return rows
}

async function queryBooking() {
  const { rows } = await pool.query(`
    SELECT section_name, subgroup_name, product_name, unit_price, current_qty, is_free
    FROM booking_products
    WHERE current_qty > 0 OR is_free = false
    ORDER BY section_order, subgroup_order, sort_order
  `)
  return rows
}

async function queryBookingWithQty() {
  const { rows } = await pool.query(`
    SELECT section_name, subgroup_name, product_name, unit_price, current_qty, is_vat_included, is_free
    FROM booking_products
    WHERE current_qty > 0
    ORDER BY section_order, subgroup_order, sort_order
  `)
  return rows
}

async function updateBookingQty(productName: string, qty: number) {
  const { rowCount } = await pool.query(
    `UPDATE booking_products SET current_qty = $1, updated_at = NOW()
     WHERE LOWER(product_name) LIKE $2`,
    [qty, `%${productName.toLowerCase()}%`]
  )
  return rowCount ?? 0
}

async function searchBookingProduct(keyword: string) {
  const { rows } = await pool.query(
    `SELECT id, product_name, unit_price, current_qty, section_name, subgroup_name
     FROM booking_products
     WHERE LOWER(product_name) LIKE $1 OR LOWER(subgroup_name) LIKE $1
     LIMIT 5`,
    [`%${keyword.toLowerCase()}%`]
  )
  return rows
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatCurrency(n: number | string | null): string {
  const num = parseFloat(String(n ?? 0))
  if (isNaN(num)) return '-'
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(d: string | null): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Flex Message builders ─────────────────────────────────────────────────────

function flexSell(rows: Record<string, unknown>[]) {
  if (!rows.length) return textMsg('ไม่มีข้อมูลยอดขาย')
  const contents = rows.map(r => ({
    type: 'box', layout: 'horizontal', spacing: 'sm',
    contents: [
      { type: 'text', text: formatDate(r.date as string), size: 'xs', color: '#888888', flex: 2 },
      { type: 'text', text: String(r.product_name ?? ''), size: 'xs', flex: 4, wrap: false },
      { type: 'text', text: formatCurrency(r.total_value as number), size: 'xs', align: 'end', flex: 3, color: '#1a7f37' },
    ],
  }))
  return {
    type: 'flex', altText: '📊 ยอดขายล่าสุด',
    contents: {
      type: 'bubble', size: 'giga',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#1a5c29', contents: [
        { type: 'text', text: '📊 ยอดขายล่าสุด 10 รายการ', color: '#ffffff', weight: 'bold', size: 'md' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'วันที่', size: 'xs', color: '#aaaaaa', flex: 2, weight: 'bold' },
          { type: 'text', text: 'สินค้า', size: 'xs', color: '#aaaaaa', flex: 4, weight: 'bold' },
          { type: 'text', text: 'มูลค่า', size: 'xs', color: '#aaaaaa', flex: 3, align: 'end', weight: 'bold' },
        ]},
        { type: 'separator' },
        ...contents,
      ]},
    },
  }
}

function flexBuy(rows: Record<string, unknown>[]) {
  if (!rows.length) return textMsg('ไม่มีข้อมูล transaction ซื้อ')
  const contents = rows.map(r => ({
    type: 'box', layout: 'horizontal', spacing: 'sm',
    contents: [
      { type: 'text', text: formatDate(r.date as string), size: 'xs', color: '#888888', flex: 2 },
      { type: 'text', text: String(r.product_name ?? ''), size: 'xs', flex: 4, wrap: false },
      { type: 'text', text: formatCurrency(r.total_value as number), size: 'xs', align: 'end', flex: 3, color: '#c05000' },
    ],
  }))
  return {
    type: 'flex', altText: '💸 Transaction ซื้อล่าสุด',
    contents: {
      type: 'bubble', size: 'giga',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#7a3000', contents: [
        { type: 'text', text: '💸 Transaction ซื้อล่าสุด 10 รายการ', color: '#ffffff', weight: 'bold', size: 'md' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'วันที่', size: 'xs', color: '#aaaaaa', flex: 2, weight: 'bold' },
          { type: 'text', text: 'สินค้า', size: 'xs', color: '#aaaaaa', flex: 4, weight: 'bold' },
          { type: 'text', text: 'มูลค่า', size: 'xs', color: '#aaaaaa', flex: 3, align: 'end', weight: 'bold' },
        ]},
        { type: 'separator' },
        ...contents,
      ]},
    },
  }
}

function flexProducts(rows: Record<string, unknown>[]) {
  if (!rows.length) return textMsg('ไม่มีข้อมูลสินค้า')
  const contents = rows.slice(0, 20).map(r => ({
    type: 'box', layout: 'horizontal', spacing: 'sm',
    contents: [
      { type: 'text', text: String(r.product_name ?? ''), size: 'xs', flex: 5, wrap: false },
      { type: 'text', text: formatCurrency(r.sell_price as number), size: 'xs', align: 'end', flex: 3, color: '#1a7f37' },
      { type: 'text', text: String(r.unit ?? ''), size: 'xs', align: 'end', flex: 2, color: '#888888' },
    ],
  }))
  return {
    type: 'flex', altText: '📦 รายการสินค้า',
    contents: {
      type: 'bubble', size: 'giga',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#1a5c29', contents: [
        { type: 'text', text: `📦 รายการสินค้า (${rows.length} รายการ)`, color: '#ffffff', weight: 'bold', size: 'md' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'ชื่อสินค้า', size: 'xs', color: '#aaaaaa', flex: 5, weight: 'bold' },
          { type: 'text', text: 'ราคาขาย', size: 'xs', color: '#aaaaaa', flex: 3, align: 'end', weight: 'bold' },
          { type: 'text', text: 'หน่วย', size: 'xs', color: '#aaaaaa', flex: 2, align: 'end', weight: 'bold' },
        ]},
        { type: 'separator' },
        ...contents,
        ...(rows.length > 20 ? [{ type: 'text' as const, text: `... และอีก ${rows.length - 20} รายการ`, size: 'xs' as const, color: '#aaaaaa' }] : []),
      ]},
    },
  }
}

function flexInventory(rows: Record<string, unknown>[], lowOnly: boolean) {
  const label = lowOnly ? '⚠️ Stock ต่ำกว่าขั้นต่ำ' : '📊 สินค้าคงเหลือ'
  if (!rows.length) return textMsg(lowOnly ? '✅ Stock ทุกรายการอยู่ในเกณฑ์ดี' : 'ไม่มีข้อมูลสินค้าคงเหลือ')
  const contents = rows.slice(0, 20).map(r => {
    const stock = parseFloat(String(r.stock_qty ?? 0))
    const min = parseFloat(String(r.min_quantity ?? 0))
    const isLow = stock < min
    return {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: String(r.product_name ?? ''), size: 'xs', flex: 5, wrap: false, color: isLow ? '#cc0000' : '#333333' },
        { type: 'text', text: String(stock), size: 'xs', align: 'end', flex: 2, color: isLow ? '#cc0000' : '#1a7f37' },
        { type: 'text', text: String(r.unit ?? ''), size: 'xs', align: 'end', flex: 2, color: '#888888' },
      ],
    }
  })
  return {
    type: 'flex', altText: label,
    contents: {
      type: 'bubble', size: 'giga',
      header: { type: 'box', layout: 'vertical', backgroundColor: lowOnly ? '#7a0000' : '#1a5c29', contents: [
        { type: 'text', text: label, color: '#ffffff', weight: 'bold', size: 'md' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'สินค้า', size: 'xs', color: '#aaaaaa', flex: 5, weight: 'bold' },
          { type: 'text', text: 'คงเหลือ', size: 'xs', color: '#aaaaaa', flex: 2, align: 'end', weight: 'bold' },
          { type: 'text', text: 'หน่วย', size: 'xs', color: '#aaaaaa', flex: 2, align: 'end', weight: 'bold' },
        ]},
        { type: 'separator' },
        ...contents,
        ...(rows.length > 20 ? [{ type: 'text' as const, text: `... และอีก ${rows.length - 20} รายการ`, size: 'xs' as const, color: '#aaaaaa' }] : []),
      ]},
    },
  }
}

function flexTargets(rows: Record<string, unknown>[]) {
  if (!rows.length) return textMsg('ไม่มีข้อมูลเป้าหมาย')
  const contents = rows.map(r => {
    const pct = parseFloat(String(r.achievement_pct ?? 0))
    const color = pct >= 100 ? '#1a7f37' : pct >= 80 ? '#e67e00' : '#cc0000'
    return {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: String(r.year_month ?? ''), size: 'xs', flex: 3, color: '#888888' },
        { type: 'text', text: formatCurrency(r.target as number), size: 'xs', flex: 4, align: 'end' },
        { type: 'text', text: formatCurrency(r.actual as number), size: 'xs', flex: 4, align: 'end', color: '#1a7f37' },
        { type: 'text', text: `${pct.toFixed(1)}%`, size: 'xs', flex: 3, align: 'end', color, weight: 'bold' },
      ],
    }
  })
  return {
    type: 'flex', altText: '🎯 เป้าหมาย',
    contents: {
      type: 'bubble', size: 'giga',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#1a3a6c', contents: [
        { type: 'text', text: '🎯 เป้าหมายยอดขาย', color: '#ffffff', weight: 'bold', size: 'md' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'เดือน', size: 'xs', color: '#aaaaaa', flex: 3, weight: 'bold' },
          { type: 'text', text: 'เป้า', size: 'xs', color: '#aaaaaa', flex: 4, align: 'end', weight: 'bold' },
          { type: 'text', text: 'จริง', size: 'xs', color: '#aaaaaa', flex: 4, align: 'end', weight: 'bold' },
          { type: 'text', text: '%', size: 'xs', color: '#aaaaaa', flex: 3, align: 'end', weight: 'bold' },
        ]},
        { type: 'separator' },
        ...contents,
      ]},
    },
  }
}

function flexBooking(rows: Record<string, unknown>[]) {
  if (!rows.length) return textMsg('📝 ยังไม่มีรายการในใบจอง\nพิมพ์ "จอง [ชื่อสินค้า] [จำนวน]" เพื่อเพิ่ม')

  let grayTotal = 0, orangeTotal = 0
  const contents: object[] = []
  let lastSection = ''

  for (const r of rows) {
    const secName = String(r.section_name ?? '')
    if (secName !== lastSection) {
      contents.push({ type: 'text', text: `── ${secName} ──`, size: 'xs', color: '#888888', margin: 'sm' })
      lastSection = secName
    }
    const qty = parseFloat(String(r.current_qty ?? 0))
    const price = parseFloat(String(r.unit_price ?? 0))
    const total = qty * price
    const isFree = Boolean(r.is_free)
    const isVat = Boolean(r.is_vat_included)

    if (!isFree) {
      if (isVat) grayTotal += total
      else orangeTotal += total
    }

    contents.push({
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: String(r.product_name ?? ''), size: 'xs', flex: 5, wrap: false, color: isFree ? '#880000' : '#333333' },
        { type: 'text', text: isFree ? 'ฟรี' : `×${qty}`, size: 'xs', flex: 2, align: 'end', color: '#555555' },
        { type: 'text', text: isFree ? '-' : formatCurrency(total), size: 'xs', flex: 3, align: 'end', color: '#1a7f37' },
      ],
    })
  }

  const noVatTotal = grayTotal + orangeTotal
  const withVatTotal = grayTotal + orangeTotal * 1.07

  return {
    type: 'flex', altText: '📝 ใบจอง',
    contents: {
      type: 'bubble', size: 'giga',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#1a5c29', contents: [
        { type: 'text', text: '📝 ใบจองปัจจุบัน', color: '#ffffff', weight: 'bold', size: 'md' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'สินค้า', size: 'xs', color: '#aaaaaa', flex: 5, weight: 'bold' },
          { type: 'text', text: 'จำนวน', size: 'xs', color: '#aaaaaa', flex: 2, align: 'end', weight: 'bold' },
          { type: 'text', text: 'รวม', size: 'xs', color: '#aaaaaa', flex: 3, align: 'end', weight: 'bold' },
        ]},
        { type: 'separator' },
        ...contents,
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
          { type: 'text', text: '🟠 ไม่มีใบกำกับภาษี', size: 'xs', flex: 5, weight: 'bold', color: '#c05000' },
          { type: 'text', text: `${formatCurrency(noVatTotal)} ฿`, size: 'xs', flex: 5, align: 'end', weight: 'bold', color: '#c05000' },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '🔘 มีใบกำกับภาษี', size: 'xs', flex: 5, weight: 'bold', color: '#444444' },
          { type: 'text', text: `${formatCurrency(withVatTotal)} ฿`, size: 'xs', flex: 5, align: 'end', weight: 'bold', color: '#444444' },
        ]},
      ]},
    },
  }
}

function helpMsg() {
  return textMsg(
    `🤖 คำสั่งที่ใช้ได้:\n\n` +
    `📊 ขาย — ยอดขายล่าสุด 10 รายการ\n` +
    `💸 ซื้อ — Transaction ซื้อล่าสุด\n` +
    `📦 สินค้า — รายการสินค้าและราคา\n` +
    `📋 คงเหลือ — stock ทั้งหมด\n` +
    `⚠️ stockต่ำ — สินค้าที่ต่ำกว่าขั้นต่ำ\n` +
    `🎯 เป้าหมาย — เป้าและยอดขายรายเดือน\n` +
    `📝 ใบจอง — ดูรายการที่จองไว้\n` +
    `🔍 หา [ชื่อ] — ค้นหาสินค้าในใบจอง\n` +
    `✏️ จอง [ชื่อ] [จำนวน] — ตั้งจำนวนในใบจอง\n` +
    `\nตัวอย่าง: จอง AA 100`
  )
}

// ── Command handler ───────────────────────────────────────────────────────────

async function handleText(text: string, replyToken: string) {
  const cmd = text.trim().toLowerCase()

  // ยอดขาย
  if (cmd === 'ขาย' || cmd === 'sell') {
    const rows = await querySell()
    return replyMessage(replyToken, [flexSell(rows)])
  }

  // ซื้อ
  if (cmd === 'ซื้อ' || cmd === 'buy') {
    const rows = await queryBuy()
    return replyMessage(replyToken, [flexBuy(rows)])
  }

  // สินค้า
  if (cmd === 'สินค้า' || cmd === 'product' || cmd === 'products') {
    const rows = await queryProducts()
    return replyMessage(replyToken, [flexProducts(rows)])
  }

  // คงเหลือทั้งหมด
  if (cmd === 'คงเหลือ' || cmd === 'stock' || cmd === 'inventory') {
    const rows = await queryInventory()
    return replyMessage(replyToken, [flexInventory(rows, false)])
  }

  // stock ต่ำ
  if (cmd === 'stockต่ำ' || cmd === 'stock ต่ำ' || cmd === 'ต่ำ' || cmd === 'lowstock') {
    const rows = await queryLowStock()
    return replyMessage(replyToken, [flexInventory(rows, true)])
  }

  // เป้าหมาย
  if (cmd === 'เป้าหมาย' || cmd === 'เป้า' || cmd === 'target' || cmd === 'targets') {
    const rows = await queryTargets()
    return replyMessage(replyToken, [flexTargets(rows)])
  }

  // ใบจอง
  if (cmd === 'ใบจอง' || cmd === 'จอง' || cmd === 'booking') {
    const rows = await queryBookingWithQty()
    return replyMessage(replyToken, [flexBooking(rows)])
  }

  // ค้นหาสินค้าในใบจอง: "หา AA"
  if (cmd.startsWith('หา ') || cmd.startsWith('ค้นหา ')) {
    const keyword = text.trim().replace(/^(หา|ค้นหา)\s+/i, '')
    const rows = await searchBookingProduct(keyword)
    if (!rows.length) return replyMessage(replyToken, [textMsg(`ไม่พบสินค้า "${keyword}" ในใบจอง`)])
    const result = rows.map(r =>
      `• ${r.product_name} [${r.section_name}/${r.subgroup_name}]\n  ราคา: ${formatCurrency(r.unit_price)} | จำนวนปัจจุบัน: ${r.current_qty}`
    ).join('\n\n')
    return replyMessage(replyToken, [textMsg(`🔍 ผลค้นหา "${keyword}":\n\n${result}`)])
  }

  // อัปเดตจำนวนใบจอง: "จอง AA 100"
  const bookingMatch = text.trim().match(/^จอง\s+(.+)\s+(\d+(?:\.\d+)?)$/)
  if (bookingMatch) {
    const [, productName, qtyStr] = bookingMatch
    const qty = parseFloat(qtyStr)
    const updated = await updateBookingQty(productName, qty)
    if (updated === 0) {
      const suggestions = await searchBookingProduct(productName)
      if (suggestions.length) {
        const list = suggestions.map(r => `• ${r.product_name}`).join('\n')
        return replyMessage(replyToken, [textMsg(`ไม่พบ "${productName}" ตรงๆ\nชื่อที่ใกล้เคียง:\n${list}\n\nลองพิมพ์ชื่อให้ตรงขึ้นครับ`)])
      }
      return replyMessage(replyToken, [textMsg(`ไม่พบสินค้า "${productName}" ในใบจอง`)])
    }
    return replyMessage(replyToken, [textMsg(`✅ อัปเดตแล้ว\n"${productName}" → ${qty} ชิ้น`)])
  }

  // ช่วยเหลือ
  if (cmd === 'ช่วยเหลือ' || cmd === 'help' || cmd === '?' || cmd === 'เมนู') {
    return replyMessage(replyToken, [helpMsg()])
  }

  // default
  return replyMessage(replyToken, [
    textMsg(`ไม่เข้าใจคำสั่ง "${text}"\nพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมดครับ`),
  ])
}

// ── Webhook entry point ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('x-line-signature') ?? ''

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  const payload = JSON.parse(body)
  const events = payload.events ?? []

  await Promise.all(
    events.map(async (event: Record<string, unknown>) => {
      if (event.type !== 'message') return
      const message = event.message as Record<string, unknown>
      if (message.type !== 'text') return
      const replyToken = event.replyToken as string
      const text = message.text as string
      await handleText(text, replyToken)
    })
  )

  return NextResponse.json({ ok: true })
}

// LINE webhook verification (GET)
export async function GET() {
  return NextResponse.json({ ok: true, service: 'LINE webhook' })
}
