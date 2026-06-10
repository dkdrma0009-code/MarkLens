import { NextResponse } from "next/server"

// 간단한 인메모리 슬라이딩 윈도우 레이트 리미터.
// 서버리스에서는 인스턴스별로 카운트가 분리되므로 완벽한 글로벌 제한은 아니지만,
// 단일 IP의 폭주(루프/스크립트 호출)와 우발적 AI 비용 폭증을 막는 1차 방어선으로 충분하다.
const hits = new Map<string, number[]>()

function clientId(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

interface Options {
  key: string
  limit: number
  windowMs: number
}

// 통과하면 null, 막히면 429 응답을 반환. 라우트 첫 줄에서 호출해 early-return.
export function checkRateLimit(req: Request, opts: Options): NextResponse | null {
  const id = `${opts.key}:${clientId(req)}`
  const now = Date.now()
  const arr = (hits.get(id) ?? []).filter(t => now - t < opts.windowMs)

  if (arr.length >= opts.limit) {
    hits.set(id, arr)
    const retryAfter = Math.ceil((opts.windowMs - (now - arr[0])) / 1000)
    return NextResponse.json(
      { error: "요청이 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  arr.push(now)
  hits.set(id, arr)

  // Map 무한 증식 방지 — 항목이 많아지면 만료된 키 정리
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every(t => now - t >= opts.windowMs)) hits.delete(k)
    }
  }

  return null
}
