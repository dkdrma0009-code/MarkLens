import { ImageResponse } from "next/og"
import { PDFDocument } from "pdf-lib"
import { loadFonts } from "@/lib/cardnews/fonts"
import { renderInterviewSheet, SHEET_W, SHEET_H } from "@/lib/lead-magnet/sheet"

export const maxDuration = 60

// 리드마그넷 PDF — Satori로 치트시트 PNG 렌더 후 pdf-lib가 이미지 한 장으로 PDF화 (폰트 임베드 불필요)
export async function GET() {
  const png = Buffer.from(
    await new ImageResponse(renderInterviewSheet(), { width: SHEET_W, height: SHEET_H, fonts: await loadFonts() }).arrayBuffer()
  )

  const pdf = await PDFDocument.create()
  const img = await pdf.embedPng(png)
  const pageW = 595.28 // A4 폭(pt)
  const pageH = (img.height / img.width) * pageW
  const page = pdf.addPage([pageW, pageH])
  page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH })
  const bytes = await pdf.save()

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="marklens-marketing-interview-questions.pdf"',
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  })
}
