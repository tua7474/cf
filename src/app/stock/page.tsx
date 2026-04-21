import Link from 'next/link'

export default function StockPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-green-800 text-white px-6 py-3 shadow flex items-center gap-3">
        <Link href="/" className="text-green-200 hover:text-white text-sm transition-colors">
          ← กลับหน้าหลัก
        </Link>
        <div>
          <h1 className="text-xl font-bold">สต้อคกระดาษฝอย</h1>
          <p className="text-green-200 text-xs mt-0.5">รายละเอียดจะเพิ่มในภายหลัง</p>
        </div>
      </header>
      <main className="flex items-center justify-center h-[60vh] text-gray-400 text-lg">
        อยู่ระหว่างพัฒนา
      </main>
    </div>
  )
}
