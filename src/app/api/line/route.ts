import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import pool from '@/lib/db'

const TOKEN  = process.env.LINE_CHANNEL_ACCESS_TOKEN!
const SECRET = process.env.LINE_CHANNEL_SECRET!
const BASE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://cf-production-6234.up.railway.app'

// ── LINE API ──────────────────────────────────────────────────────────────────

async function reply(replyToken: string, messages: object[]) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ replyToken, messages }),
  })
}

function verifySignature(body: string, sig: string) {
  const hash = crypto.createHmac('sha256', SECRET).update(body).digest('base64')
  return hash === sig
}

// ── Session (DB) ──────────────────────────────────────────────────────────────

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS line_sessions (
      user_id    VARCHAR(100) PRIMARY KEY,
      order_data JSONB        NOT NULL DEFAULT '{}',
      updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
    )`)
}

async function getOrder(userId: string): Promise<Record<number, number>> {
  await ensureTable()
  const { rows } = await pool.query('SELECT order_data FROM line_sessions WHERE user_id=$1', [userId])
  return rows[0]?.order_data ?? {}
}

async function saveOrder(userId: string, data: Record<number, number>) {
  await ensureTable()
  await pool.query(`
    INSERT INTO line_sessions (user_id, order_data, updated_at) VALUES ($1,$2,NOW())
    ON CONFLICT (user_id) DO UPDATE SET order_data=$2, updated_at=NOW()
  `, [userId, JSON.stringify(data)])
}

// ── DB Queries ────────────────────────────────────────────────────────────────

async function getSections() {
  const { rows } = await pool.query(`
    SELECT DISTINCT section_order, section_name, is_vat_included
    FROM booking_products ORDER BY section_order`)
  return rows
}

async function getSubgroups(sectionOrder: number) {
  const { rows } = await pool.query(`
    SELECT DISTINCT subgroup_order, subgroup_name
    FROM booking_products WHERE section_order=$1 AND subgroup_order>0
    ORDER BY subgroup_order`, [sectionOrder])
  return rows
}

async function getProducts(sectionOrder: number, subgroupOrder: number) {
  const { rows } = await pool.query(`
    SELECT id, product_name, unit_price, is_free
    FROM booking_products
    WHERE section_order=$1 AND subgroup_order=$2 AND is_free=false
    ORDER BY sort_order`, [sectionOrder, subgroupOrder])
  return rows
}

async function getSectionInfo(sectionOrder: number) {
  const { rows } = await pool.query(`
    SELECT section_name, is_vat_included FROM booking_products
    WHERE section_order=$1 LIMIT 1`, [sectionOrder])
  return rows[0]
}

async function getSubgroupInfo(sectionOrder: number, subgroupOrder: number) {
  const { rows } = await pool.query(`
    SELECT section_name, subgroup_name, is_vat_included FROM booking_products
    WHERE section_order=$1 AND subgroup_order=$2 LIMIT 1`, [sectionOrder, subgroupOrder])
  return rows[0]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function countOrdered(userId: string): Promise<Record<number, number>> {
  const order = await getOrder(userId)
  // returns { sectionOrder: count }
  const ids = Object.keys(order).map(Number).filter(id => order[id] > 0)
  if (!ids.length) return {}
  const { rows } = await pool.query(`
    SELECT section_order, COUNT(*)::int as cnt FROM booking_products
    WHERE id=ANY($1) GROUP BY section_order`, [ids])
  return Object.fromEntries(rows.map(r => [r.section_order, r.cnt]))
}

// ── Flex Builders ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 7

async function mainMenu(userId: string) {
  const [sections, secCounts] = await Promise.all([getSections(), countOrdered(userId)])
  const totalItems = Object.values(await getOrder(userId)).filter(q => q > 0).length

  const rows = sections.map(sec => {
    const cnt = secCounts[sec.section_order] ?? 0
    const color = sec.is_vat_included ? '#555555' : '#e07000'
    return {
      type: 'box', layout: 'horizontal', paddingAll: '10px',
      borderWidth: '1px', borderColor: '#eeeeee', cornerRadius: '8px', margin: 'sm',
      contents: [
        {
          type: 'box', layout: 'vertical', flex: 1, justifyContent: 'center',
          contents: [{ type: 'text', text: sec.is_vat_included ? '🔘' : '🟠', size: 'lg', align: 'center' }]
        },
        {
          type: 'box', layout: 'vertical', flex: 5, paddingStart: '8px',
          contents: [
            { type: 'text', text: sec.section_name, weight: 'bold', size: 'sm', color: '#222222' },
            { type: 'text', text: cnt ? `✅ จอง ${cnt} รายการแล้ว` : 'ยังไม่ได้จอง', size: 'xs', color: cnt ? '#1a7f37' : '#aaaaaa' }
          ]
        },
        {
          type: 'button', flex: 2,
          action: { type: 'postback', label: 'เลือก >', data: `S:${sec.section_order}` },
          style: 'primary', color, height: 'sm'
        }
      ]
    }
  })

  return {
    type: 'flex', altText: '📋 เมนูใบจอง',
    contents: {
      type: 'bubble', size: 'giga',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#1a5c29',
        contents: [
          { type: 'text', text: '📋 กระดาษฝอยไทย — ใบจอง', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: totalItems ? `เลือกไว้แล้ว ${totalItems} รายการ` : 'เลือกหมวดสินค้าที่ต้องการ', color: '#aaffaa', size: 'xs' }
        ]
      },
      body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: rows },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'postback', label: '🧾 สรุปรายการสั่งซื้อรอบนี้', data: 'C' },
            style: 'primary', color: '#1a5c29', height: 'sm'
          }
        ]
      }
    }
  }
}

async function sectionMenu(sectionOrder: number, userId: string) {
  const [sec, subgroups] = await Promise.all([
    getSectionInfo(sectionOrder), getSubgroups(sectionOrder)
  ])
  if (!subgroups.length) return productsView(sectionOrder, 0, 0, userId)

  const order = await getOrder(userId)
  const ids = Object.keys(order).map(Number).filter(id => order[id] > 0)
  const sgCounts: Record<number, number> = {}
  if (ids.length) {
    const { rows } = await pool.query(`
      SELECT subgroup_order, COUNT(*)::int as cnt FROM booking_products
      WHERE section_order=$1 AND id=ANY($2) GROUP BY subgroup_order`,
      [sectionOrder, ids])
    rows.forEach(r => { sgCounts[r.subgroup_order] = r.cnt })
  }

  const btns = subgroups.map(sg => {
    const cnt = sgCounts[sg.subgroup_order] ?? 0
    return {
      type: 'box', layout: 'horizontal', margin: 'sm', paddingAll: '6px',
      borderWidth: '1px', borderColor: '#eeeeee', cornerRadius: '6px',
      contents: [
        {
          type: 'box', layout: 'vertical', flex: 4, justifyContent: 'center',
          contents: [
            { type: 'text', text: sg.subgroup_name, size: 'sm', wrap: true, color: '#222222' },
            ...(cnt ? [{ type: 'text', text: `✅ ${cnt} รายการ`, size: 'xs', color: '#1a7f37' }] : [])
          ]
        },
        {
          type: 'button', flex: 2,
          action: { type: 'postback', label: 'เลือก', data: `SG:${sectionOrder}:${sg.subgroup_order}:0` },
          style: 'primary', color: '#e07000', height: 'sm'
        }
      ]
    }
  })

  const headerColor = sec?.is_vat_included ? '#444444' : '#c06000'
  return {
    type: 'flex', altText: `${sec?.section_name} — เลือกหมวดย่อย`,
    contents: {
      type: 'bubble', size: 'giga',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: headerColor,
        contents: [
          { type: 'text', text: sec?.section_name ?? '', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: 'เลือกหมวดย่อย', color: '#ffffff99', size: 'xs' }
        ]
      },
      body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: btns },
      footer: {
        type: 'box', layout: 'vertical',
        contents: [{
          type: 'button',
          action: { type: 'postback', label: '← กลับเมนูหลัก', data: 'M' },
          style: 'secondary', height: 'sm'
        }]
      }
    }
  }
}

async function productsView(sectionOrder: number, subgroupOrder: number, page: number, userId: string) {
  const [products, info, order] = await Promise.all([
    getProducts(sectionOrder, subgroupOrder),
    subgroupOrder > 0 ? getSubgroupInfo(sectionOrder, subgroupOrder) : getSectionInfo(sectionOrder),
    getOrder(userId)
  ])

  const totalPages = Math.ceil(products.length / PAGE_SIZE) || 1
  const pageProds  = products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const secName    = (info as Record<string,string>)?.section_name ?? ''
  const sgName     = (info as Record<string,string>)?.subgroup_name ?? ''
  const isVat      = (info as Record<string,boolean>)?.is_vat_included ?? false

  const prodRows = pageProds.map(p => {
    const qty = order[p.id] ?? 0
    return {
      type: 'box', layout: 'vertical', margin: 'sm', paddingAll: '8px',
      backgroundColor: qty > 0 ? '#f0fff4' : '#f8f8f8', cornerRadius: '8px',
      contents: [
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: p.product_name, size: 'sm', flex: 5, wrap: true, color: '#222222' },
            { type: 'text', text: qty > 0 ? `✅ ${qty}` : '—', size: 'sm', flex: 2, align: 'end', weight: 'bold', color: qty > 0 ? '#1a7f37' : '#cccccc' }
          ]
        },
        { type: 'text', text: `฿${fmt(p.unit_price)} / ชิ้น`, size: 'xs', color: '#888888', margin: 'xs' },
        {
          type: 'box', layout: 'horizontal', margin: 'sm', spacing: 'xs',
          contents: [
            { type: 'button', action: { type: 'postback', label: '+1',  data: `A:${p.id}:1`  }, height: 'sm', style: 'secondary', flex: 1 },
            { type: 'button', action: { type: 'postback', label: '+5',  data: `A:${p.id}:5`  }, height: 'sm', style: 'secondary', flex: 1 },
            { type: 'button', action: { type: 'postback', label: '+10', data: `A:${p.id}:10` }, height: 'sm', style: 'secondary', flex: 1 },
            { type: 'button', action: { type: 'postback', label: '+50', data: `A:${p.id}:50` }, height: 'sm', style: 'primary',   color: '#1a7f37', flex: 1 },
            { type: 'button', action: { type: 'postback', label: '✕',   data: `R:${p.id}`    }, height: 'sm', style: 'secondary', color: '#cc0000', flex: 1 }
          ]
        }
      ]
    }
  })

  const navBtns: object[] = []
  if (page > 0)
    navBtns.push({ type: 'button', action: { type: 'postback', label: '← หน้าก่อน', data: `SG:${sectionOrder}:${subgroupOrder}:${page-1}` }, style: 'secondary', height: 'sm', flex: 1 })
  if (page < totalPages - 1)
    navBtns.push({ type: 'button', action: { type: 'postback', label: 'หน้าถัดไป →', data: `SG:${sectionOrder}:${subgroupOrder}:${page+1}` }, style: 'secondary', height: 'sm', flex: 1 })

  const backData = subgroupOrder === 0 ? 'M' : `S:${sectionOrder}`
  const headerBg = isVat ? '#444444' : '#c06000'
  const title    = sgName ? `${secName} › ${sgName}` : secName

  return {
    type: 'flex', altText: `${title} — เลือกจำนวน`,
    contents: {
      type: 'bubble', size: 'giga',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: headerBg,
        contents: [
          { type: 'text', text: title, color: '#ffffff', weight: 'bold', size: 'sm', wrap: true },
          { type: 'text', text: `หน้า ${page+1}/${totalPages}  ·  กด +จำนวน แล้วกด "บันทึกและกลับ"`, color: '#ffffff99', size: 'xs' }
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'xs',
        contents: prodRows.length ? prodRows : [{ type: 'text', text: 'ไม่มีสินค้าในหมวดนี้', color: '#aaaaaa' }]
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          ...(navBtns.length ? [{ type: 'box', layout: 'horizontal', spacing: 'sm', contents: navBtns }] : []),
          { type: 'button', action: { type: 'postback', label: '✅ บันทึกและกลับ', data: backData }, style: 'primary', color: '#1a5c29', height: 'sm' }
        ]
      }
    }
  }
}

async function summaryView(userId: string) {
  const order = await getOrder(userId)
  const ids   = Object.keys(order).map(Number).filter(id => order[id] > 0)

  if (!ids.length) {
    return { type: 'text', text: 'ยังไม่มีรายการสั่งซื้อครับ\nกลับไปเลือกหมวดสินค้าก่อนนะครับ' }
  }

  const { rows: products } = await pool.query(`
    SELECT id, product_name, unit_price, section_name, section_order, is_vat_included
    FROM booking_products WHERE id=ANY($1)
    ORDER BY section_order, subgroup_order, sort_order`, [ids])

  let grayTotal = 0, orangeTotal = 0
  const pMap = Object.fromEntries(products.map(p => [p.id, p]))
  const sections: Record<number, { name: string; items: { name: string; qty: number; total: number }[] }> = {}

  for (const id of ids) {
    const p = pMap[id]
    if (!p) continue
    const qty   = order[id]
    const total = p.unit_price * qty
    if (p.is_vat_included) grayTotal += total
    else orangeTotal += total
    if (!sections[p.section_order]) sections[p.section_order] = { name: p.section_name, items: [] }
    sections[p.section_order].items.push({ name: p.product_name, qty, total })
  }

  const noVat   = grayTotal + orangeTotal
  const withVat = grayTotal + orangeTotal * 1.07

  const bodyContents: object[] = [
    { type: 'box', layout: 'horizontal', contents: [
      { type: 'text', text: 'สินค้า', size: 'xs', color: '#aaaaaa', flex: 5, weight: 'bold' },
      { type: 'text', text: 'จน.', size: 'xs', color: '#aaaaaa', flex: 2, align: 'end', weight: 'bold' },
      { type: 'text', text: 'รวม (฿)', size: 'xs', color: '#aaaaaa', flex: 3, align: 'end', weight: 'bold' }
    ]},
    { type: 'separator' }
  ]

  for (const [, sec] of Object.entries(sections)) {
    bodyContents.push({ type: 'text', text: `— ${sec.name} —`, size: 'xs', color: '#888888', margin: 'md' })
    sec.items.forEach(item => {
      bodyContents.push({
        type: 'box', layout: 'horizontal',
        contents: [
          { type: 'text', text: item.name, size: 'xs', flex: 5, wrap: false, color: '#333333' },
          { type: 'text', text: `×${item.qty}`, size: 'xs', flex: 2, align: 'end', color: '#666666' },
          { type: 'text', text: fmt(item.total), size: 'xs', flex: 3, align: 'end', color: '#1a7f37' }
        ]
      })
    })
  }

  bodyContents.push(
    { type: 'separator', margin: 'lg' },
    { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
      { type: 'text', text: '🟠 ไม่มีใบกำกับภาษี', size: 'sm', flex: 5, weight: 'bold', color: '#c05000' },
      { type: 'text', text: `${fmt(noVat)} ฿`, size: 'sm', flex: 5, align: 'end', weight: 'bold', color: '#c05000' }
    ]},
    { type: 'box', layout: 'horizontal', contents: [
      { type: 'text', text: '🔘 มีใบกำกับภาษี', size: 'sm', flex: 5, weight: 'bold', color: '#444444' },
      { type: 'text', text: `${fmt(withVat)} ฿`, size: 'sm', flex: 5, align: 'end', weight: 'bold', color: '#444444' }
    ]}
  )

  return {
    type: 'flex', altText: '🧾 สรุปรายการสั่งซื้อ',
    contents: {
      type: 'bubble', size: 'giga',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#1a5c29',
        contents: [
          { type: 'text', text: '🧾 สรุปรายการสั่งซื้อ', color: '#ffffff', weight: 'bold', size: 'md' },
          { type: 'text', text: `${ids.length} รายการ`, color: '#aaffaa', size: 'xs' }
        ]
      },
      body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: bodyContents },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          { type: 'button', action: { type: 'postback', label: '📄 ส่งใบจองเป็นรูปภาพ', data: 'IMG' }, style: 'primary', color: '#1a3a6c', height: 'sm' },
          { type: 'button', action: { type: 'postback', label: '← แก้ไขรายการ', data: 'M' }, style: 'secondary', height: 'sm' },
          { type: 'button', action: { type: 'postback', label: '🗑 ล้างรายการทั้งหมด', data: 'CLEAR' }, style: 'secondary', height: 'sm' }
        ]
      }
    }
  }
}

// ── Postback handler ──────────────────────────────────────────────────────────

async function handlePostback(data: string, userId: string, replyToken: string) {
  // MENU
  if (data === 'M') {
    return reply(replyToken, [await mainMenu(userId)])
  }

  // CONFIRM
  if (data === 'C') {
    return reply(replyToken, [await summaryView(userId)])
  }

  // CLEAR
  if (data === 'CLEAR') {
    await saveOrder(userId, {})
    return reply(replyToken, [
      { type: 'text', text: '🗑 ล้างรายการทั้งหมดแล้วครับ' },
      await mainMenu(userId)
    ])
  }

  // IMAGE
  if (data === 'IMG') {
    const imageUrl = `${BASE_URL}/api/line/image?userId=${encodeURIComponent(userId)}&t=${Date.now()}`
    return reply(replyToken, [
      {
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      }
    ])
  }

  // SECTION: S:{n}
  if (data.startsWith('S:')) {
    const sec = parseInt(data.split(':')[1])
    return reply(replyToken, [await sectionMenu(sec, userId)])
  }

  // SUBGROUP: SG:{sec}:{sg}:{page}
  if (data.startsWith('SG:')) {
    const [, sec, sg, pg] = data.split(':').map(Number)
    return reply(replyToken, [await productsView(sec, sg, pg, userId)])
  }

  // ADD: A:{id}:{qty}
  if (data.startsWith('A:')) {
    const [, idStr, qtyStr] = data.split(':')
    const id  = Number(idStr)
    const add = Number(qtyStr)
    const order = await getOrder(userId)
    order[id]   = (order[id] ?? 0) + add
    await saveOrder(userId, order)

    // Find which page this product is on and refresh
    const { rows } = await pool.query(
      'SELECT section_order, subgroup_order FROM booking_products WHERE id=$1', [id])
    if (rows[0]) {
      const { section_order: sec, subgroup_order: sg } = rows[0]
      const allProds = await getProducts(sec, sg)
      const idx  = allProds.findIndex(p => p.id === id)
      const page = Math.floor(idx / PAGE_SIZE)
      return reply(replyToken, [await productsView(sec, sg, page, userId)])
    }
    return reply(replyToken, [{ type: 'text', text: `✅ เพิ่ม ${add} ชิ้นแล้ว` }])
  }

  // RESET: R:{id}
  if (data.startsWith('R:')) {
    const id    = Number(data.split(':')[1])
    const order = await getOrder(userId)
    delete order[id]
    await saveOrder(userId, order)

    const { rows } = await pool.query(
      'SELECT section_order, subgroup_order FROM booking_products WHERE id=$1', [id])
    if (rows[0]) {
      const { section_order: sec, subgroup_order: sg } = rows[0]
      const allProds = await getProducts(sec, sg)
      const idx  = allProds.findIndex(p => p.id === id)
      const page = Math.floor(Math.max(idx, 0) / PAGE_SIZE)
      return reply(replyToken, [await productsView(sec, sg, page, userId)])
    }
    return reply(replyToken, [{ type: 'text', text: '✕ รีเซ็ตจำนวนแล้ว' }])
  }
}

// ── Text handler ──────────────────────────────────────────────────────────────

async function handleText(text: string, userId: string, replyToken: string) {
  const t = text.trim().toLowerCase()

  if (['ใบจอง', 'จอง', 'สั่งสินค้า', 'order', 'booking', 'เมนู', 'menu'].includes(t)) {
    return reply(replyToken, [await mainMenu(userId)])
  }
  if (['สรุป', 'ยืนยัน', 'confirm', 'c', 'summary'].includes(t)) {
    return reply(replyToken, [await summaryView(userId)])
  }
  if (['ล้าง', 'clear', 'reset', 'ลบทั้งหมด'].includes(t)) {
    await saveOrder(userId, {})
    return reply(replyToken, [{ type: 'text', text: '🗑 ล้างรายการแล้วครับ' }, await mainMenu(userId)])
  }

  // Old commands still work
  if (['ขาย', 'sell'].includes(t)) {
    const { rows } = await pool.query('SELECT date,product_name,total_value FROM sell_transactions ORDER BY date DESC,id DESC LIMIT 10')
    const lines = rows.map(r => `${new Date(r.date).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'})}  ${r.product_name}  ${fmt(r.total_value)}฿`).join('\n')
    return reply(replyToken, [{ type: 'text', text: `📊 ยอดขายล่าสุด:\n${lines || 'ไม่มีข้อมูล'}` }])
  }
  if (['คงเหลือ', 'stock'].includes(t)) {
    const { rows } = await pool.query('SELECT product_name,stock_qty,min_quantity,unit FROM inventory_view ORDER BY product_name')
    const low = rows.filter(r => r.stock_qty < r.min_quantity)
    const msg = low.length ? low.map(r => `⚠️ ${r.product_name}: ${r.stock_qty} ${r.unit} (ขั้นต่ำ ${r.min_quantity})`).join('\n') : '✅ Stock ทุกรายการอยู่ในเกณฑ์ดี'
    return reply(replyToken, [{ type: 'text', text: `📊 Stock ต่ำ:\n${msg}` }])
  }
  if (['เป้าหมาย', 'เป้า', 'target'].includes(t)) {
    const { rows } = await pool.query('SELECT year_month,target,actual,achievement_pct FROM targets ORDER BY year_month DESC LIMIT 3')
    const lines = rows.map(r => `${r.year_month}: เป้า ${fmt(r.target)} | จริง ${fmt(r.actual)} | ${parseFloat(r.achievement_pct).toFixed(1)}%`).join('\n')
    return reply(replyToken, [{ type: 'text', text: `🎯 เป้าหมาย:\n${lines || 'ไม่มีข้อมูล'}` }])
  }

  // Default
  return reply(replyToken, [{
    type: 'text',
    text: 'พิมพ์ "ใบจอง" เพื่อเริ่มสั่งสินค้า\nหรือ "สรุป" เพื่อดูรายการที่เลือกไว้ครับ 😊'
  }])
}

// ── Webhook entry ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('x-line-signature') ?? ''
  if (!verifySignature(body, sig))
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })

  const { events = [] } = JSON.parse(body)

  await Promise.all(events.map(async (ev: Record<string, unknown>) => {
    const userId     = (ev.source as Record<string, string>)?.userId ?? ''
    const replyToken = ev.replyToken as string

    if (ev.type === 'postback') {
      const data = (ev.postback as Record<string, string>)?.data ?? ''
      await handlePostback(data, userId, replyToken)
    } else if (ev.type === 'message') {
      const msg = ev.message as Record<string, unknown>
      if (msg?.type === 'text') await handleText(msg.text as string, userId, replyToken)
    }
  }))

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'LINE webhook active' })
}
