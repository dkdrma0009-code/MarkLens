import { ImageResponse } from "next/og"
import { loadFonts } from "@/lib/cardnews/fonts"
import { renderQuoteCard, renderStatCard, NL_CARD } from "@/lib/newsletter/visual-cards"

export const maxDuration = 60

// 뉴스레터 본문 삽입용 타이포 비주얼 카드 (가로 16:9). 이메일에서 <img>로 안전하게 표시.
// 공개 접근 — 발송된 이메일이 인증 없이 로드해야 하므로 (내용이 비식별 타이포라 노출 무방).
//   ?type=quote&text=...
//   ?type=stat&number=...&label=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type")

  let element
  if (type === "quote") {
    const text = searchParams.get("text")?.slice(0, 120) ?? ""
    if (!text) return new Response("text required", { status: 400 })
    element = renderQuoteCard(text)
  } else if (type === "stat") {
    const number = searchParams.get("number")?.slice(0, 16) ?? ""
    const label = searchParams.get("label")?.slice(0, 60) ?? ""
    if (!number) return new Response("number required", { status: 400 })
    element = renderStatCard(number, label)
  } else {
    return new Response("type must be quote|stat", { status: 400 })
  }

  return new ImageResponse(element, {
    width: NL_CARD.WIDTH,
    height: NL_CARD.HEIGHT,
    fonts: await loadFonts(),
    headers: { "cache-control": "public, max-age=2592000, immutable" }, // 같은 파라미터=같은 이미지, 30일 캐시
  })
}
