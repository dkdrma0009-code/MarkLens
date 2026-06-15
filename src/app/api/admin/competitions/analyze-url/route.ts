import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { analyzeCompetition } from "@/lib/competitions/analyze"
import { fetchViaJina } from "@/lib/competitions/scrape"
import { NextResponse } from "next/server"

export const maxDuration = 120
// 서울 리전 선호 — 한국 사이트 접근성. 단 Hobby 플랜은 미국 고정(무시됨), Pro 전환 시 자동 적용.
export const preferredRegion = "icn1"

// 주최사/공모전 URL 입력 기반 분석 (수집 이원화의 주축).
// URL fetch → 본문 텍스트 추출 → LLM 분류(description 자체 재작성) → competitions insert.
async function isAuthorized(req: Request): Promise<boolean> {
  const { searchParams } = new URL(req.url)
  if (searchParams.get("secret") === process.env.N8N_WEBHOOK_SECRET) return true
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  return !!user && user.email?.trim().toLowerCase() === adminEmail
}

// 페이지에서 제목 + 본문 텍스트 추출 (외부 이미지는 가져오지 않음 — 텍스트 썸네일 정책)
// 표준 브라우저 UA 사용: 다수 사이트가 비표준 UA를 차단(robots는 Allow여도 WAF가 막음).
// 사용자가 입력한 단건 공개 페이지를 가져오는 용도 — 대량 크롤링 아님.
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

async function fetchPageText(url: string): Promise<{ title: string; text: string; image: string | null }> {
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, "Accept-Language": "ko-KR,ko;q=0.9" },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`페이지 응답 오류 (${res.status})`)
  const html = await res.text()

  const meta = (re: RegExp) => html.match(re)?.[1]?.trim()
  const ogTitle = meta(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  const titleTag = meta(/<title[^>]*>([^<]+)<\/title>/i)
  const ogDesc = meta(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
  const title = ogTitle ?? titleTag ?? "(제목 없음)"

  // 원본 포스터(og:image) — 관행 기준 출처·원문 링크와 함께 사용. 상대경로는 절대화.
  let image: string | null = null
  const ogImage = meta(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? meta(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (ogImage) { try { image = new URL(ogImage, url).href } catch { image = null } }

  // 스크립트·스타일 제거 후 태그 제거, 공백 정규화
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000)

  return { title, text: `${title}\n${ogDesc ?? ""}\n${body}`, image }
}

export async function POST(req: Request) {
  if (!await isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // url: 원문 링크(필수, 저장용). text: 본문 직접 입력(선택). imageUrl: 포스터 이미지 주소(선택).
  // Hobby 플랜은 함수 리전이 미국 고정 → 한국 사이트 자동 fetch 불가. 본문/이미지 직접 입력이 주력.
  const { url, text, imageUrl } = await req.json().catch(() => ({}))
  if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "유효한 URL을 입력하세요" }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 중복 체크 (source_url unique)
  const { data: dup } = await supabase.from("competitions").select("id").eq("source_url", url).maybeSingle()
  if (dup) return NextResponse.json({ error: "이미 등록된 URL입니다", id: dup.id }, { status: 409 })

  let page: { title: string; text: string; image: string | null }
  if (typeof text === "string" && text.trim().length > 30) {
    // 본문 직접 입력 — fetch 스킵 (차단 사이트 우회). 원본 이미지 없음 → 텍스트 썸네일.
    page = { title: text.trim().split("\n")[0].slice(0, 80), text: text.trim(), image: null }
  } else {
    try {
      page = await fetchPageText(url)
    } catch {
      // 직접 fetch 실패(한국 사이트 IP 차단·봇 차단) → Jina Reader 폴백
      try {
        page = await fetchViaJina(url)
      } catch (e2) {
        return NextResponse.json({
          error: `페이지를 가져오지 못했습니다 (${e2 instanceof Error ? e2.message : e2}). 본문을 복사해 'text' 필드로 함께 보내면 분석할 수 있습니다.`,
        }, { status: 502 })
      }
    }
  }

  const analysis = await analyzeCompetition({ title: page.title, content: page.text, url })
  if (!analysis?.title) return NextResponse.json({ error: "분석에 실패했습니다" }, { status: 500 })

  let sourceName = "직접 등록"
  try { sourceName = new URL(url).hostname.replace(/^www\./, "") } catch { /* keep default */ }

  // 썸네일: 명시적 imageUrl(직접 입력) 우선, 없으면 fetch한 og:image
  const thumbnail = (typeof imageUrl === "string" && /^https?:\/\//.test(imageUrl)) ? imageUrl : page.image

  const { data, error } = await supabase.from("competitions").insert({
    title: analysis.title,
    organizer: analysis.organizer,
    source_url: url,
    source_name: sourceName,
    thumbnail_url: thumbnail,
    description: analysis.description,
    category: analysis.category,
    deadline: analysis.deadline,
    start_date: analysis.start_date,
    prize: analysis.prize,
    eligibility: analysis.eligibility,
    job_fit: analysis.job_fit ?? [],
    difficulty: analysis.difficulty,
    status: "pending",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, competition: data })
}
